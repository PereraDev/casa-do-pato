import crypto from "node:crypto";
import { serializarGrupo, serializarItemGrupo } from "../lib/serializers.js";

// Mesmo alfabeto de utils/grupo.js do cliente (sem 0/O/1/I, difícil de
// confundir na hora de digitar o código).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function gerarCodigo() {
  let codigo = "";
  for (let i = 0; i < 5; i++) {
    codigo += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return codigo;
}

async function buscarGrupo(prisma, codigo) {
  return prisma.groupOrder.findUnique({
    where: { codigo },
    include: { participantes: true, itens: true },
  });
}

// Pedido em grupo — carrinho compartilhado por código, agora sincronizado de
// verdade entre dispositivos via Socket.IO (room "grupo:<codigo>"), em vez
// do evento `storage` do navegador que só funcionava entre abas do MESMO
// navegador (ver CLAUDE.md, "Pedido em grupo").
const LIMITE_GRUPO = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };
const nomeValido = (n) => typeof n === "string" && n.trim() && n.length <= 40;

export default async function grupoRoutes(fastify) {
  const { prisma, io } = fastify;

  // Cria um grupo novo com um código único de 5 caracteres (tenta de novo em
  // caso de colisão — muito raro, mas o banco garante unicidade de verdade)
  // e já registra quem criou como o 1º participante.
  fastify.post("/api/grupo", LIMITE_GRUPO, async (request, reply) => {
    const { nome } = request.body || {};
    if (!nomeValido(nome)) return reply.code(400).send({ erro: "Informe seu nome" });

    let grupo = null;
    for (let tentativa = 0; tentativa < 5 && !grupo; tentativa++) {
      const codigo = gerarCodigo();
      try {
        grupo = await prisma.groupOrder.create({
          data: { codigo, participantes: { create: [{ nome }] } },
          include: { participantes: true, itens: true },
        });
      } catch (err) {
        if (err.code !== "P2002") throw err; // colisão de código único — tenta outro
      }
    }
    if (!grupo) {
      return reply.code(500).send({ erro: "Não foi possível criar o grupo, tente novamente" });
    }

    reply.code(201);
    return { ...serializarGrupo(grupo), participanteId: grupo.participantes[0].id };
  });

  fastify.post("/api/grupo/:codigo/entrar", LIMITE_GRUPO, async (request, reply) => {
    const codigo = request.params.codigo.toUpperCase();
    const { nome } = request.body || {};
    if (!nomeValido(nome)) return reply.code(400).send({ erro: "Informe seu nome" });
    const grupo = await buscarGrupo(prisma, codigo);
    if (!grupo) return reply.code(404).send({ erro: "Código de grupo não encontrado." });

    const participante = await prisma.groupParticipant.create({
      data: { grupoCodigo: codigo, nome },
    });
    io.to("grupo:" + codigo).emit("grupo:participante-entrou", {
      id: participante.id,
      nome: participante.nome,
    });
    reply.code(201);
    return { codigo, participanteId: participante.id };
  });

  fastify.post("/api/grupo/:codigo/sair", async (request, reply) => {
    const codigo = request.params.codigo.toUpperCase();
    const { participanteId } = request.body || {};
    if (!participanteId) return reply.code(400).send({ erro: "participanteId obrigatório" });
    await prisma.groupParticipant.deleteMany({
      where: { id: participanteId, grupoCodigo: codigo },
    });
    io.to("grupo:" + codigo).emit("grupo:participante-saiu", { id: participanteId });
    return { ok: true };
  });

  // Snapshot completo do grupo (participantes + itens) — chamado ao entrar/
  // criar; depois disso o front só recebe diffs via socket (ver AppContext.jsx#grupoObj).
  fastify.get("/api/grupo/:codigo", LIMITE_GRUPO, async (request, reply) => {
    const codigo = request.params.codigo.toUpperCase();
    const grupo = await buscarGrupo(prisma, codigo);
    if (!grupo) return reply.code(404).send({ erro: "Código de grupo não encontrado." });
    return serializarGrupo(grupo);
  });

  fastify.post("/api/grupo/:codigo/itens", async (request, reply) => {
    const codigo = request.params.codigo.toUpperCase();
    const grupo = await buscarGrupo(prisma, codigo);
    if (!grupo) return reply.code(404).send({ erro: "Código de grupo não encontrado." });

    const { itemId, qtd, addons, ingredientesRemovidos, precoUnitario, participanteId, participanteNome } =
      request.body || {};
    if (
      typeof itemId !== "string" || itemId.length > 60 || !Number.isInteger(qtd) || qtd < 1 || qtd > 50 ||
      !nomeValido(participanteNome) || !(Number(precoUnitario) >= 0 && Number(precoUnitario) <= 10000)
    ) {
      return reply.code(400).send({ erro: "Item inválido" });
    }

    const item = await prisma.groupItem.create({
      data: {
        grupoCodigo: codigo,
        itemId,
        qtd,
        addons: addons || [],
        ingredientesRemovidos: ingredientesRemovidos || [],
        precoUnitario,
        participanteId: participanteId || null,
        participanteNome,
      },
    });
    const serial = serializarItemGrupo(item);
    io.to("grupo:" + codigo).emit("grupo:item-adicionado", serial);
    reply.code(201);
    return serial;
  });

  fastify.delete("/api/grupo/:codigo/itens/:itemId", async (request, reply) => {
    const codigo = request.params.codigo.toUpperCase();
    const { itemId } = request.params;
    const item = await prisma.groupItem.findFirst({ where: { id: itemId, grupoCodigo: codigo } });
    if (!item) return reply.code(404).send({ erro: "Item não encontrado" });
    await prisma.groupItem.delete({ where: { id: itemId } });
    io.to("grupo:" + codigo).emit("grupo:item-removido", { id: itemId });
    return { ok: true };
  });

  // Corpo: {delta} — mesmo padrão de alterarQtdItemGrupo(codigo, idx, delta)
  // no cliente; qtd chegando a 0 remove o item.
  // O incremento é feito direto no banco (`{ increment }`, não lê-e-escreve
  // qtd em JS) pra ser atômico: 2 participantes tocando "+1" quase ao mesmo
  // tempo não podem mais fazer um incremento sumir por causa de um "select"
  // desatualizado.
  fastify.patch("/api/grupo/:codigo/itens/:itemId", async (request, reply) => {
    const codigo = request.params.codigo.toUpperCase();
    const { itemId } = request.params;
    const incremento = Math.max(-50, Math.min(50, Math.trunc(Number(request.body?.delta)) || 0));

    const { count } = await prisma.groupItem.updateMany({
      where: { id: itemId, grupoCodigo: codigo },
      data: { qtd: { increment: incremento } },
    });
    if (!count) return reply.code(404).send({ erro: "Item não encontrado" });

    const atualizado = await prisma.groupItem.findUnique({ where: { id: itemId } });
    if (!atualizado || atualizado.qtd <= 0) {
      try {
        await prisma.groupItem.delete({ where: { id: itemId } });
      } catch (err) {
        if (err.code !== "P2025") throw err; // já removido por uma alteração concorrente
      }
      io.to("grupo:" + codigo).emit("grupo:item-removido", { id: itemId });
      return { ok: true, removido: true };
    }
    const serial = serializarItemGrupo(atualizado);
    io.to("grupo:" + codigo).emit("grupo:item-alterado", serial);
    return serial;
  });

  // Esvazia os itens depois do checkout, mantém grupo/participantes — dá
  // pra pedir de novo com o mesmo código sem recriar o grupo inteiro.
  fastify.post("/api/grupo/:codigo/limpar", async (request) => {
    const codigo = request.params.codigo.toUpperCase();
    await prisma.groupItem.deleteMany({ where: { grupoCodigo: codigo } });
    io.to("grupo:" + codigo).emit("grupo:limpo", {});
    return { ok: true };
  });
}
