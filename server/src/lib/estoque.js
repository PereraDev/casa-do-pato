// Baixa de estoque de insumo por venda — chamada tanto pelo checkout do
// cliente (POST /api/pedidos) quanto pelo PDV do admin (POST /api/pedidos/pdv),
// ver routes/pedidos.js. Ponto único de verdade (ao contrário do dish.estoque
// antigo, duplicado em data.js/admin.html por não ter back-end).
import { serializarInsumo } from "./serializers.js";

// Limite de pedido pelo que está cadastrado: soma o consumo de cada insumo
// ATIVO na ficha técnica de todos os pratos do pedido e compara com o estoque
// atual. Devolve a mensagem de erro (string) ou null se cabe tudo.
// Prato sem ficha técnica, ou sem nenhum insumo ativo cadastrado, não tem o que
// limitar (recurso opt-in, mesmo critério da baixa) — nunca trava o restaurante
// inteiro só porque o cadastro ainda está vazio.
// ponytail: checa e baixa em passos separados; 2 pedidos simultâneos no último
// item podem passar juntos (estoque fica negativo por 1 pedido). Upgrade = decrement condicional numa transação.
export async function validarEstoquePedido(prisma, itens) {
  const linhas = (itens || []).filter((it) => it?.itemId && Number(it.qtd) > 0);
  if (!linhas.length) return null;
  const receitas = await prisma.recipeItem.findMany({
    where: { itemId: { in: linhas.map((it) => it.itemId) }, insumo: { ativo: true } },
    include: { insumo: true },
  });
  if (!receitas.length) return null;

  const falta = new Map(); // insumoId -> {insumo, necessario, pratos: Set}
  for (const it of linhas) {
    for (const r of receitas.filter((x) => x.itemId === it.itemId)) {
      const f = falta.get(r.insumoId) || { insumo: r.insumo, necessario: 0, pratos: new Set() };
      f.necessario += Number(r.quantidade) * Number(it.qtd);
      f.pratos.add(typeof it.nome === "string" && it.nome ? it.nome : it.itemId);
      falta.set(r.insumoId, f);
    }
  }
  const sem = [...falta.values()].filter((f) => f.necessario > Number(f.insumo.estoqueAtual));
  if (!sem.length) return null;
  const f = sem[0];
  const disponivel = Math.max(0, Number(f.insumo.estoqueAtual));
  return (
    `Sem estoque suficiente para ${[...f.pratos].join(", ")}: ` +
    `falta ${f.insumo.nome} (disponível ${disponivel} ${f.insumo.unidade}). Reduza a quantidade ou escolha outro item.`
  );
}

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
