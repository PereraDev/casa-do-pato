import { formatarIdCompra, seqDoId } from "../lib/ids.js";
import {
  serializarCompra,
  serializarContaPagar,
  serializarFornecedor,
  serializarInsumo,
} from "../lib/serializers.js";

// Fornecedores e Compras (pedidos de compra) — módulo ERP. Criar uma compra
// já gera a ContaPagar vinculada; "receber" credita o estoque dos insumos
// (tudo-ou-nada, sem recebimento parcial nesta etapa — ver CLAUDE.md).
export default async function comprasRoutes(fastify) {
  fastify.addHook("onRequest", fastify.exigirAdmin); // módulo 100% admin
  const { prisma, io } = fastify;

  fastify.get("/api/fornecedores", async () => {
    const fornecedores = await prisma.fornecedor.findMany({ orderBy: { nome: "asc" } });
    return fornecedores.map(serializarFornecedor);
  });

  fastify.post("/api/fornecedores", async (request, reply) => {
    const body = request.body || {};
    if (!body.nome) return reply.code(400).send({ erro: "Nome é obrigatório" });
    const fornecedor = await prisma.fornecedor.create({
      data: {
        nome: body.nome,
        documento: body.documento || null,
        telefone: body.telefone || null,
        email: body.email || null,
        endereco: body.endereco || null,
      },
    });
    reply.code(201);
    return serializarFornecedor(fornecedor);
  });

  fastify.patch("/api/fornecedores/:id", async (request) => {
    const { id } = request.params;
    const body = request.body || {};
    const fornecedor = await prisma.fornecedor.update({
      where: { id },
      data: {
        nome: body.nome,
        documento: body.documento || null,
        telefone: body.telefone || null,
        email: body.email || null,
        endereco: body.endereco || null,
      },
    });
    return serializarFornecedor(fornecedor);
  });

  fastify.delete("/api/fornecedores/:id", async (request) => {
    const { id } = request.params;
    const fornecedor = await prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
    return serializarFornecedor(fornecedor);
  });

  fastify.get("/api/compras", async () => {
    const compras = await prisma.purchaseOrder.findMany({
      include: { itens: true },
      orderBy: { criadoEm: "desc" },
    });
    return compras.map(serializarCompra);
  });

  // Cria a compra E a ContaPagar vinculada na mesma escrita aninhada do
  // Prisma (ambas nascem juntas — ver schema.prisma, PurchaseOrder.contaPagar).
  fastify.post("/api/compras", async (request, reply) => {
    const body = request.body || {};
    const itens = Array.isArray(body.itens) ? body.itens : [];
    if (!body.fornecedorId || !itens.length || !body.vencimentoContaPagar) {
      return reply.code(400).send({ erro: "Compra incompleta" });
    }
    for (const it of itens) {
      if (seqDoId(it.insumoId) == null || !(Number(it.quantidade) > 0) || !(Number(it.precoUnitario) >= 0)) {
        return reply.code(400).send({ erro: "Item de compra inválido" });
      }
    }
    const total = itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.precoUnitario), 0);

    const compra = await prisma.purchaseOrder.create({
      data: {
        fornecedorId: body.fornecedorId,
        total,
        observacoes: body.observacoes || null,
        itens: {
          create: itens.map((it) => ({
            insumoId: seqDoId(it.insumoId),
            quantidade: it.quantidade,
            precoUnitario: it.precoUnitario,
          })),
        },
        contaPagar: {
          create: {
            descricao: "Compra de insumos",
            categoria: "fornecedor",
            fornecedorId: body.fornecedorId,
            valor: total,
            vencimento: new Date(body.vencimentoContaPagar),
          },
        },
      },
      include: { itens: true },
    });
    const serial = serializarCompra(compra);
    io.to("admin").emit("compra:nova", serial);
    reply.code(201);
    return serial;
  });

  // "Receber" é tudo-ou-nada (sem recebimento parcial, ver CLAUDE.md):
  // credita o estoque de CADA item da compra e grava um movimento de
  // entrada por insumo — só permitido em compra ainda "pendente".
  fastify.patch("/api/compras/:id/receber", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Compra inválida" });
    const atual = await prisma.purchaseOrder.findUnique({ where: { seq }, include: { itens: true } });
    if (!atual) return reply.code(404).send({ erro: "Compra não encontrada" });
    if (atual.status !== "pendente") {
      return reply.code(400).send({ erro: "Só é possível receber uma compra pendente" });
    }

    const insumosAfetados = [];
    for (const item of atual.itens) {
      const insumo = await prisma.insumo.update({
        where: { seq: item.insumoId },
        data: { estoqueAtual: { increment: item.quantidade } },
      });
      await prisma.movimentoEstoque.create({
        data: {
          insumoId: item.insumoId,
          tipo: "entrada",
          quantidade: item.quantidade,
          motivo: "compra:" + formatarIdCompra(seq),
        },
      });
      insumosAfetados.push(insumo);
    }
    const compra = await prisma.purchaseOrder.update({
      where: { seq },
      data: { status: "recebido", recebidoEm: new Date() },
      include: { itens: true },
    });
    const serial = serializarCompra(compra);
    io.to("admin").emit("compra:recebida", serial);
    io.to("admin").emit("estoque:atualizado", insumosAfetados.map(serializarInsumo));
    return serial;
  });

  // Cancela a compra e a ContaPagar vinculada juntas, numa transação (evita
  // ficar com uma conta a pagar "órfã" pendente pra uma compra cancelada).
  fastify.patch("/api/compras/:id/cancelar", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Compra inválida" });
    const atual = await prisma.purchaseOrder.findUnique({ where: { seq } });
    if (!atual) return reply.code(404).send({ erro: "Compra não encontrada" });
    if (atual.status !== "pendente") {
      return reply.code(400).send({ erro: "Só é possível cancelar uma compra pendente" });
    }
    const [compra] = await prisma.$transaction([
      prisma.purchaseOrder.update({ where: { seq }, data: { status: "cancelado" }, include: { itens: true } }),
      prisma.contaPagar.updateMany({
        where: { compraId: seq, status: "pendente" },
        data: { status: "cancelado" },
      }),
    ]);
    const serial = serializarCompra(compra);
    io.to("admin").emit("compra:cancelada", serial);
    const contaPagar = await prisma.contaPagar.findUnique({ where: { compraId: seq } });
    if (contaPagar) io.to("admin").emit("conta-pagar:atualizada", serializarContaPagar(contaPagar));
    return serial;
  });
}
