import { seqDoId } from "../lib/ids.js";
import { serializarInsumo, serializarMovimento } from "../lib/serializers.js";

// Insumos (matéria-prima), ficha técnica (receita por prato) e o ledger de
// movimentos de estoque — módulo ERP (ver CLAUDE.md, "ERP administrativo").
// A baixa de estoque por venda mora em lib/estoque.js (chamada de dentro de
// routes/pedidos.js), não aqui — aqui é só CRUD/consulta.
const UNIDADES = ["kg", "g", "l", "ml", "un"]; // mesma lista do <select> do admin

export default async function estoqueRoutes(fastify) {
  fastify.addHook("onRequest", fastify.exigirAdmin); // módulo 100% admin
  const { prisma, io } = fastify;

  // CRUD de insumos (matéria-prima) — ids expostos como "IN-<seq>" (ver
  // lib/ids.js), nunca a chave numérica crua do banco.
  fastify.get("/api/estoque/insumos", async () => {
    const insumos = await prisma.insumo.findMany({ orderBy: { nome: "asc" } });
    return insumos.map(serializarInsumo);
  });

  fastify.post("/api/estoque/insumos", async (request, reply) => {
    const body = request.body || {};
    if (!body.nome || !UNIDADES.includes(body.unidade)) {
      return reply.code(400).send({ erro: "Nome e unidade válida são obrigatórios" });
    }
    const insumo = await prisma.insumo.create({
      data: {
        nome: body.nome,
        unidade: body.unidade,
        estoqueAtual: body.estoqueAtual ?? 0,
        estoqueMinimo: body.estoqueMinimo ?? null,
        custoUnitario: body.custoUnitario ?? null,
        fornecedorPadraoId: body.fornecedorPadraoId || null,
      },
    });
    reply.code(201);
    return serializarInsumo(insumo);
  });

  fastify.patch("/api/estoque/insumos/:id", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Insumo inválido" });
    const body = request.body || {};
    if (!UNIDADES.includes(body.unidade)) {
      return reply.code(400).send({ erro: "Unidade inválida" });
    }
    const insumo = await prisma.insumo.update({
      where: { seq },
      data: {
        nome: body.nome,
        unidade: body.unidade,
        estoqueMinimo: body.estoqueMinimo ?? null,
        custoUnitario: body.custoUnitario ?? null,
        fornecedorPadraoId: body.fornecedorPadraoId || null,
      },
    });
    return serializarInsumo(insumo);
  });

  // Ajuste manual de estoque (correção de contagem, perda, etc.) —
  // quantidade pode ser negativa; sempre grava no ledger.
  fastify.patch("/api/estoque/insumos/:id/ajuste", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    const quantidade = Number(request.body?.quantidade);
    const motivo = request.body?.motivo || "";
    if (seq == null || !quantidade) {
      return reply.code(400).send({ erro: "Quantidade inválida" });
    }
    const insumo = await prisma.insumo.update({
      where: { seq },
      data: { estoqueAtual: { increment: quantidade } },
    });
    await prisma.movimentoEstoque.create({
      data: {
        insumoId: seq,
        tipo: quantidade > 0 ? "entrada" : "saida",
        quantidade: Math.abs(quantidade),
        motivo: "ajuste: " + motivo,
      },
    });
    const serial = serializarInsumo(insumo);
    io.to("admin").emit("estoque:atualizado", [serial]);
    return serial;
  });

  // "Remover" é soft-delete (ativo:false) — preserva o histórico de
  // movimentos/receita já ligado a este insumo em vez de apagar linhas.
  fastify.delete("/api/estoque/insumos/:id", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Insumo inválido" });
    const insumo = await prisma.insumo.update({ where: { seq }, data: { ativo: false } });
    return serializarInsumo(insumo);
  });

  // Ledger de entradas/saídas — filtrável por insumo, limitado às 500 mais
  // recentes.
  fastify.get("/api/estoque/movimentos", async (request) => {
    const insumoId = seqDoId(request.query?.insumoId);
    const movimentos = await prisma.movimentoEstoque.findMany({
      where: insumoId != null ? { insumoId } : undefined,
      orderBy: { criadoEm: "desc" },
      take: 500,
    });
    return movimentos.map(serializarMovimento);
  });

  // Insumos ativos cujo estoque atual já cruzou o mínimo configurado —
  // alimenta o banner de alerta na Visão Geral do admin.
  fastify.get("/api/estoque/baixo-estoque", async () => {
    const insumos = await prisma.insumo.findMany({
      where: { ativo: true, estoqueMinimo: { not: null } },
    });
    return insumos
      .filter((i) => Number(i.estoqueAtual) <= Number(i.estoqueMinimo))
      .map(serializarInsumo);
  });

  // Ficha técnica de um prato — substitui a lista inteira a cada salvamento
  // (mais simples que diffing item a item).
  fastify.get("/api/estoque/receitas/:itemId", async (request) => {
    const receitas = await prisma.recipeItem.findMany({
      where: { itemId: request.params.itemId },
    });
    return receitas.map((r) => ({
      id: r.id,
      insumoId: "IN-" + r.insumoId,
      quantidade: Number(r.quantidade),
    }));
  });

  fastify.put("/api/estoque/receitas/:itemId", async (request, reply) => {
    const { itemId } = request.params;
    const itens = Array.isArray(request.body?.itens) ? request.body.itens : [];
    for (const it of itens) {
      if (seqDoId(it.insumoId) == null || !(Number(it.quantidade) > 0)) {
        return reply.code(400).send({ erro: "Item de receita inválido" });
      }
    }
    await prisma.$transaction([
      prisma.recipeItem.deleteMany({ where: { itemId } }),
      prisma.recipeItem.createMany({
        data: itens.map((it) => ({
          itemId,
          insumoId: seqDoId(it.insumoId),
          quantidade: it.quantidade,
        })),
      }),
    ]);
    const receitas = await prisma.recipeItem.findMany({ where: { itemId } });
    return receitas.map((r) => ({
      id: r.id,
      insumoId: "IN-" + r.insumoId,
      quantidade: Number(r.quantidade),
    }));
  });
}
