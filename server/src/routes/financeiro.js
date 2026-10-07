import { seqDoId } from "../lib/ids.js";
import { serializarContaPagar, serializarContaReceber } from "../lib/serializers.js";

// Contas a pagar/receber — módulo ERP. Contas a pagar geradas por uma
// Compra (compraId setado) só podem ser editadas/excluídas cancelando a
// compra em si (routes/compras.js), pra não perder o vínculo.
export default async function financeiroRoutes(fastify) {
  fastify.addHook("onRequest", fastify.exigirAdmin); // módulo 100% admin
  const { prisma, io } = fastify;

  fastify.get("/api/financeiro/contas-pagar", async () => {
    const contas = await prisma.contaPagar.findMany({ orderBy: { vencimento: "asc" } });
    return contas.map(serializarContaPagar);
  });

  fastify.post("/api/financeiro/contas-pagar", async (request, reply) => {
    const body = request.body || {};
    if (!body.descricao || !(Number(body.valor) > 0) || !body.vencimento) {
      return reply.code(400).send({ erro: "Conta a pagar incompleta" });
    }
    const conta = await prisma.contaPagar.create({
      data: {
        descricao: body.descricao,
        categoria: body.categoria || "outro",
        valor: body.valor,
        vencimento: new Date(body.vencimento),
      },
    });
    const serial = serializarContaPagar(conta);
    io.to("admin").emit("conta-pagar:nova", serial);
    reply.code(201);
    return serial;
  });

  fastify.patch("/api/financeiro/contas-pagar/:id", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Conta inválida" });
    const atual = await prisma.contaPagar.findUnique({ where: { seq } });
    if (!atual) return reply.code(404).send({ erro: "Conta não encontrada" });
    if (atual.compraId != null) {
      return reply.code(400).send({ erro: "Conta gerada por uma compra — edite/cancele a compra" });
    }
    const body = request.body || {};
    const conta = await prisma.contaPagar.update({
      where: { seq },
      data: {
        descricao: body.descricao,
        categoria: body.categoria || "outro",
        valor: body.valor,
        vencimento: body.vencimento ? new Date(body.vencimento) : undefined,
      },
    });
    const serial = serializarContaPagar(conta);
    io.to("admin").emit("conta-pagar:atualizada", serial);
    return serial;
  });

  fastify.patch("/api/financeiro/contas-pagar/:id/pagar", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Conta inválida" });
    const conta = await prisma.contaPagar.update({
      where: { seq },
      data: { status: "pago", pagoEm: new Date() },
    });
    const serial = serializarContaPagar(conta);
    io.to("admin").emit("conta-pagar:atualizada", serial);
    return serial;
  });

  fastify.delete("/api/financeiro/contas-pagar/:id", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Conta inválida" });
    const atual = await prisma.contaPagar.findUnique({ where: { seq } });
    if (!atual) return reply.code(404).send({ erro: "Conta não encontrada" });
    if (atual.compraId != null) {
      return reply.code(400).send({ erro: "Conta gerada por uma compra — cancele a compra" });
    }
    await prisma.contaPagar.delete({ where: { seq } });
    return { ok: true };
  });

  // Contas a receber são só recebíveis avulsos (nunca ligadas a um Order) —
  // o pedido do cliente já tem seu próprio ciclo de pagamento via
  // Pix/cartão/dinheiro/pendente-*, sem passar por aqui.
  fastify.get("/api/financeiro/contas-receber", async () => {
    const contas = await prisma.contaReceber.findMany({ orderBy: { vencimento: "asc" } });
    return contas.map(serializarContaReceber);
  });

  fastify.post("/api/financeiro/contas-receber", async (request, reply) => {
    const body = request.body || {};
    if (!body.descricao || !(Number(body.valor) > 0) || !body.vencimento) {
      return reply.code(400).send({ erro: "Conta a receber incompleta" });
    }
    const conta = await prisma.contaReceber.create({
      data: {
        descricao: body.descricao,
        clienteNome: body.clienteNome || null,
        valor: body.valor,
        vencimento: new Date(body.vencimento),
      },
    });
    const serial = serializarContaReceber(conta);
    io.to("admin").emit("conta-receber:nova", serial);
    reply.code(201);
    return serial;
  });

  fastify.patch("/api/financeiro/contas-receber/:id", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Conta inválida" });
    const body = request.body || {};
    const conta = await prisma.contaReceber.update({
      where: { seq },
      data: {
        descricao: body.descricao,
        clienteNome: body.clienteNome || null,
        valor: body.valor,
        vencimento: body.vencimento ? new Date(body.vencimento) : undefined,
      },
    });
    const serial = serializarContaReceber(conta);
    io.to("admin").emit("conta-receber:atualizada", serial);
    return serial;
  });

  fastify.patch("/api/financeiro/contas-receber/:id/receber", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Conta inválida" });
    const conta = await prisma.contaReceber.update({
      where: { seq },
      data: { status: "recebido", recebidoEm: new Date() },
    });
    const serial = serializarContaReceber(conta);
    io.to("admin").emit("conta-receber:atualizada", serial);
    return serial;
  });

  fastify.delete("/api/financeiro/contas-receber/:id", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Conta inválida" });
    await prisma.contaReceber.delete({ where: { seq } });
    return { ok: true };
  });
}
