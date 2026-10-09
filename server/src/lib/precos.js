// Confere um pedido contra o catálogo do servidor: preço de cada prato e adicional, cupom,
// disponibilidade e estoque por prato. O cliente manda o que montou; aqui o preço é sempre
// recalculado — nunca confiado.
import { precoBase } from "../../../src/data/catalogoAplicar.js";
import { COUPONS } from "./catalogo.js";

const ASSINATURA_PCT = 10; // espelha ASSINATURA_DESCONTO_PCT do cliente (clube Casa do Pato+)
const TOLERANCIA = 0.05; // arredondamento de centavos entre cliente e servidor
const arredonda = (n) => Math.round(n * 100) / 100;
const recusa = (status, erro) => ({ status, erro });

// Devolve { erro, status } ou { itens, subtotal, desconto, taxaEntrega, totalMinimo, totalMaximo, porPrato }.
// opcoes: { pdv, logado } — logado = há conta na sessão (só conta tem cashback/assinatura).
// verificarTotal=false: só disponibilidade/estoque (pré-checagem antes do checkout, sem total ainda).
export function conferirPedido({ menu, addonGroups }, estoque, body, { pdv = false, logado = false, verificarTotal = true } = {}) {
  const porId = new Map(menu.map((m) => [m.id, m]));
  const itens = [];
  const porPrato = new Map(); // itemId -> quantidade total no pedido
  let subtotal = 0;

  for (const it of body.itens) {
    const prato = porId.get(it.itemId);
    if (!prato) {
      const nome = typeof it.nome === "string" ? it.nome.slice(0, 60) : "Um item";
      return recusa(409, `"${nome}" não está mais disponível no cardápio. Remova-o do carrinho para continuar.`);
    }
    const opcoes = (prato.addons || []).flatMap((gid) => addonGroups[gid]?.itens || []);
    const addons = [];
    if (it.addons != null && (!Array.isArray(it.addons) || it.addons.length > 30)) return recusa(400, "Adicionais inválidos");
    for (const a of it.addons || []) {
      const opcao = a && typeof a.nome === "string" ? opcoes.find((o) => o.nome === a.nome) : null;
      if (!opcao || !Number.isInteger(a.qtd) || a.qtd < 1 || a.qtd > 20) {
        return recusa(400, `Adicional inválido em "${prato.nome}". Atualize a página e tente de novo.`);
      }
      addons.push({ nome: opcao.nome, qtd: a.qtd, preco: opcao.preco });
    }
    const removidos = Array.isArray(it.ingredientesRemovidos)
      ? it.ingredientesRemovidos.filter((x) => typeof x === "string").slice(0, 20).map((x) => x.slice(0, 60))
      : [];
    const unitario = precoBase(prato) + addons.reduce((s, a) => s + a.preco * a.qtd, 0);
    const linha = arredonda(unitario * it.qtd);
    subtotal += linha;
    porPrato.set(it.itemId, (porPrato.get(it.itemId) || 0) + it.qtd);
    itens.push({
      itemId: it.itemId,
      nome: prato.nome,
      qtd: it.qtd,
      subtotal: linha,
      participanteNome: typeof it.participanteNome === "string" ? it.participanteNome.slice(0, 60) : undefined,
      ...(addons.length ? { addons } : {}),
      ...(removidos.length ? { ingredientesRemovidos: removidos } : {}),
    });
  }
  subtotal = arredonda(subtotal);

  // Estoque por prato (controle opcional do admin): "só restam N".
  for (const [itemId, qtd] of porPrato) {
    if (estoque[itemId] !== undefined && qtd > estoque[itemId]) {
      return recusa(409, `Só restam ${estoque[itemId]} de "${porId.get(itemId).nome}". Reduza a quantidade para continuar.`);
    }
  }

  // Desconto: cupom (conferido) ou, sem cupom, até o desconto da assinatura (só conta logada).
  let desconto = 0;
  if (body.cupom) {
    const cupom = COUPONS[String(body.cupom).toUpperCase()];
    if (!cupom) return recusa(400, "Cupom inválido");
    desconto = Math.min(cupom.tipo === "pct" ? (subtotal * cupom.valor) / 100 : cupom.valor, subtotal);
  } else if (!pdv && logado) {
    desconto = (subtotal * ASSINATURA_PCT) / 100;
  }

  const cashback = Number(body.cashbackUsado ?? 0);
  if (!Number.isFinite(cashback) || cashback < 0) return recusa(400, "Cashback inválido");
  if (cashback > 0 && (pdv || !logado)) return recusa(400, "Cashback só vale para conta logada");

  const taxaEntrega = pdv ? Math.min(Math.max(Number(body.taxaEntrega) || 0, 0), 100) : 0;
  const totalMinimo = Math.max(0, arredonda(subtotal - desconto - cashback)) + taxaEntrega;
  const totalMaximo = subtotal + taxaEntrega;
  const total = Number(body.total);
  if (verificarTotal && (!(total >= totalMinimo - TOLERANCIA) || total > totalMaximo + TOLERANCIA)) {
    return recusa(400, "O total não confere com os preços atuais do cardápio. Atualize a página e tente de novo.");
  }
  return { itens, subtotal, porPrato };
}
