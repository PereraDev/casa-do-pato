// Baixa de estoque de insumo por venda — chamada tanto pelo checkout do
// cliente (POST /api/pedidos) quanto pelo PDV do admin (POST /api/pedidos/pdv),
// ver routes/pedidos.js. Ponto único de verdade (ao contrário do dish.estoque
// antigo, duplicado em data.js/admin.html por não ter back-end).
import { serializarInsumo } from "./serializers.js";

// itens: [{itemId, qtd, ...}] — mesmo formato de Order.itens. Prato sem
// ficha técnica cadastrada é ignorado silenciosamente (recurso opt-in).
export async function baixarEstoquePorVenda(prisma, io, pedidoIdFormatado, itens) {
  for (const it of itens || []) {
    if (!it?.itemId || !(Number(it.qtd) > 0)) continue;
    const receitas = await prisma.recipeItem.findMany({
      where: { itemId: it.itemId },
      include: { insumo: true },
    });
    for (const receita of receitas) {
      const consumo = Number(receita.quantidade) * Number(it.qtd);
      const insumo = await prisma.insumo.update({
        where: { seq: receita.insumoId },
        data: { estoqueAtual: { decrement: consumo } },
      });
      await prisma.movimentoEstoque.create({
        data: {
          insumoId: receita.insumoId,
          tipo: "saida",
          quantidade: consumo,
          motivo: "venda:" + pedidoIdFormatado,
        },
      });
      if (
        insumo.estoqueMinimo != null &&
        Number(insumo.estoqueAtual) <= Number(insumo.estoqueMinimo)
      ) {
        io.to("admin").emit("estoque:baixo", serializarInsumo(insumo));
      }
    }
  }
}
