import { baixarEstoquePorVenda, validarEstoquePedido } from "../lib/estoque.js";
import { formatarIdPedido, seqDoId } from "../lib/ids.js";
import { serializarPedido, serializarPedidoFila } from "../lib/serializers.js";

// Campos comuns entre o checkout do cliente (QR) e a venda do PDV — o resto
// (identidade, origem, taxaEntrega/caixaId) é decidido por cada rota, nunca
// confiando cegamente no corpo da requisição pra quem fez o pedido.
function camposComuns(body) {
  return {
    total: body.total,
    tipo: body.tipo,
    mesa: body.mesa || null,
    endereco: body.endereco || null,
    pagamento: body.pagamento,
    cupom: body.cupom ?? null,
    cashbackUsado: body.cashbackUsado ?? 0,
    observacoes: body.observacoes || null,
    avaliado: false,
    itens: body.itens || [],
    divisao: body.divisao ?? null,
    agendamento: body.agendamento ?? null,
    grupoSnapshot: body.grupo ?? null,
  };
}

const TIPOS = ["balcao", "mesa", "entrega"];
const STATUS_KDS = ["recebido", "preparo", "pronto", "entregue"];
const texto = (v, max) => v == null || (typeof v === "string" && v.length <= max);

// Limites de sanidade na borda pública. Preço/total continuam vindos do
// cliente (o catálogo mora no front, ver CLAUDE.md) — aqui só barra lixo e abuso.
// ponytail: sem catálogo no servidor não dá pra recalcular o total; upgrade = mover MENU pro Postgres.
function pedidoValido(body, reply) {
  const itens = body?.itens;
  const erro =
    !Array.isArray(itens) || !itens.length || itens.length > 50
      ? "Pedido sem itens ou com itens demais"
      : !itens.every((it) => it && Number.isInteger(it.qtd) && it.qtd >= 1 && it.qtd <= 50)
        ? "Quantidade inválida"
        : !(Number.isFinite(Number(body.total)) && Number(body.total) >= 0 && Number(body.total) <= 100000)
          ? "Total inválido"
          : !TIPOS.includes(body.tipo) || typeof body.pagamento !== "string" || body.pagamento.length > 30
            ? "Pedido incompleto"
            : !texto(body.mesa, 20) || !texto(body.endereco, 300) || !texto(body.observacoes, 500)
              ? "Texto longo demais"
              : null;
  if (erro) {
    reply.code(400).send({ erro });
    return false;
  }
  return true;
}

export default async function pedidosRoutes(fastify) {
  const { prisma, io } = fastify;

  // 409 quando os ingredientes cadastrados não cobrem o pedido (ver lib/estoque.js).
  async function estoqueCobre(itens, reply) {
    const erro = await validarEstoquePedido(prisma, itens);
    if (erro) reply.code(409).send({ erro });
    return !erro;
  }

  // Pré-checagem sem gravar nada: o cliente chama antes de abrir o checkout, pra não
  // descobrir a falta de estoque só depois de "pagar".
  fastify.post("/api/pedidos/disponibilidade", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = request.body || {};
    if (!pedidoValido({ ...body, total: 0, tipo: "balcao", pagamento: "x" }, reply)) return;
    if (!(await estoqueCobre(body.itens, reply))) return;
    return { ok: true };
  });

  fastify.post("/api/pedidos", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = request.body || {};
    if (!pedidoValido(body, reply)) return;
    if (!(await estoqueCobre(body.itens, reply))) return;

    // Identidade sempre vem da sessão — nunca do corpo (evita um cliente
    // forjar `clienteEmail` de outra conta).
    const userId = request.session.get("userId");
    const guestId = userId ? null : request.session.get("guestId");
    let clienteEmail = null;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      clienteEmail = user ? user.email : null;
    }

    const order = await prisma.order.create({
      data: { ...camposComuns(body), userId, guestId, clienteEmail },
    });
    const pedido = serializarPedido(order);
    io.to("admin").emit("pedido:novo", pedido);
    await baixarEstoquePorVenda(prisma, io, formatarIdPedido(order.seq), body.itens);
    reply.code(201);
    return pedido;
  });

  // Venda feita pelo PDV do admin — sem conta de cliente logada; e-mail
  // opcional digitado pelo operador (ver CLAUDE.md, seção "PDV").
  fastify.post("/api/pedidos/pdv", { onRequest: fastify.exigirAdmin }, async (request, reply) => {
    const body = request.body || {};
    if (!pedidoValido(body, reply)) return;
    if (!(await estoqueCobre(body.itens, reply))) return;

    const order = await prisma.order.create({
      data: {
        ...camposComuns(body),
        clienteEmail: body.clienteEmail || null,
        origem: "pdv",
        taxaEntrega: body.taxaEntrega ?? null,
        caixaId: body.caixaId ?? null,
      },
    });
    const pedido = serializarPedido(order);
    io.to("admin").emit("pedido:novo", pedido);
    await baixarEstoquePorVenda(prisma, io, formatarIdPedido(order.seq), body.itens);
    reply.code(201);
    return pedido;
  });

  // Histórico de "meus pedidos" — conta logada ou visitante (guestId),
  // nunca bloqueado (ver CLAUDE.md, "Conta/sessão").
  fastify.get("/api/pedidos/meus", async (request) => {
    const userId = request.session.get("userId");
    const guestId = request.session.get("guestId");
    const where = userId ? { userId } : { guestId };
    const orders = await prisma.order.findMany({ where, orderBy: { criadoEm: "desc" } });
    return orders.map(serializarPedido);
  });

  // Fila pública mínima (sem itens/endereço de outros clientes) — alimenta
  // utils/pedidos.js#estimarTempoFila no cliente.
  fastify.get("/api/pedidos/fila", async () => {
    const orders = await prisma.order.findMany({
      where: { canceladoAdmin: false },
      orderBy: { criadoEm: "asc" },
    });
    return orders.map(serializarPedidoFila);
  });

  // Lista completa — usada pelo admin.html (Cozinha/Delivery/Mesas/Pedidos/
  // Dashboard), mesmo nível de confiança que o acesso direto ao localStorage
  // tinha antes (ver CLAUDE.md).
  fastify.get("/api/pedidos/todos", { onRequest: fastify.exigirAdmin }, async () => {
    const orders = await prisma.order.findMany({ orderBy: { criadoEm: "desc" } });
    return orders.map(serializarPedido);
  });

  // Notifica TODO MUNDO conectado (não só o dono do pedido — filtrar por
  // sala exigiria saber a room certa aqui) com um payload mínimo; o cliente
  // (AppContext.jsx) só faz patch se o pedido já existir na sua própria
  // lista local, então quem não é o dono simplesmente ignora o evento.
  function emitirAtualizacao(pedido) {
    io.emit("pedido:atualizado", {
      id: pedido.id,
      statusManual: pedido.statusManual,
      _canceladoAdmin: pedido._canceladoAdmin,
    });
  }

  // Painel de Cozinha (KDS) do admin — grava statusManual, que a partir daí
  // o cliente passa a ler em vez do relógio (ver utils/pedidos.js#statusPedido).
  fastify.patch("/api/pedidos/:id/status", { onRequest: fastify.exigirAdmin }, async (request, reply) => {
    const seq = seqDoId(request.params.id);
    const { statusManual } = request.body || {};
    if (seq == null || !STATUS_KDS.includes(statusManual)) {
      return reply.code(400).send({ erro: "Pedido ou status inválido" });
    }
    const order = await prisma.order.update({ where: { seq }, data: { statusManual } });
    const pedido = serializarPedido(order);
    emitirAtualizacao(pedido);
    return pedido;
  });

  // Alterna canceladoAdmin (não deleta o pedido) — dá pra desfazer um
  // cancelamento por engano clicando de novo.
  fastify.patch("/api/pedidos/:id/cancelar", { onRequest: fastify.exigirAdmin }, async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Pedido inválido" });
    const atual = await prisma.order.findUnique({ where: { seq } });
    if (!atual) return reply.code(404).send({ erro: "Pedido não encontrado" });
    const order = await prisma.order.update({
      where: { seq },
      data: { canceladoAdmin: !atual.canceladoAdmin },
    });
    const pedido = serializarPedido(order);
    emitirAtualizacao(pedido);
    return pedido;
  });
}
