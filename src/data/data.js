/* ==========================================================================
   Casa do Pato — dados do cardápio (protótipo de TCC)
   Mesmo conteúdo de tanamesa/js/data.js, só que como módulo ES (export)
   em vez de scripts globais, pra poder ser importado pelos componentes React.
   NOTA: as URLs de imagem abaixo são fotos de banco de imagens (Unsplash)
   usadas como placeholder. Substitua por fotos reais do estabelecimento.
   ========================================================================== */

// Dados-base do catálogo (cardápio, cupons, avaliações mock): fonte única,
// também lida pelo painel admin via scripts/gerar-catalogo-admin.mjs.
import { ADDON_GROUPS_BASE, CATEGORIES_BASE, COUPONS, MENU_BASE, REVIEWS_MOCK } from "./catalogoBase.js";
export { COUPONS, REVIEWS_MOCK };

// Abas de navegação principal (barra horizontal deslizante no topo)
export const NAV_TABS = [
  { id: "inicio", label: "Início", icon: "🏠", cats: null },
  { id: "combos", label: "Combos", icon: "🍔", cats: ["combos"] },
  {
    id: "hamburgueres",
    label: "Hambúrgueres",
    icon: "🍔",
    cats: ["tradicionais", "autorais"],
  },
  {
    id: "lancamentos",
    label: "Lançamentos",
    icon: "✨",
    cats: ["lancamentos", "campanha"],
  },
  {
    id: "acompanhamentos",
    label: "Acompanhamentos",
    icon: "🍟",
    cats: ["acompanhamentos"],
  },
  { id: "sobremesas", label: "Sobremesas", icon: "🍮", cats: ["sobremesas"] },
  { id: "bebidas", label: "Bebidas", icon: "🥤", cats: ["bebidas"] },
];

// Aplica edições do painel admin (aba "Categorias") por cima das categorias
// base: só o rótulo das categorias base pode ser renomeado (os ids são
// referenciados por NAV_TABS e pelos itens do cardápio, então não podem
// sumir); categorias extras criadas no admin são anexadas por inteiro, e
// podem ser removidas de volta (`tnm_admin_categorias`, chave espelhada em
// public/admin.html). Lido 1x no carregamento do módulo, igual ao catálogo.
function aplicarCategoriasAdmin(base) {
  if (typeof localStorage === "undefined") return base;
  let dados = {};
  try {
    dados = JSON.parse(localStorage.getItem("tnm_admin_categorias") || "{}");
  } catch {
    dados = {};
  }
  const overrides = dados.overrides || {};
  const extras = dados.extras || [];
  const comOverrides = base.map((c) =>
    overrides[c.id]?.label ? { ...c, label: overrides[c.id].label } : c,
  );
  return [...comOverrides, ...extras];
}

export const CATEGORIES = aplicarCategoriasAdmin(CATEGORIES_BASE);

// Ids de itens sugeridos no componente de up-sell/cross-sell (acompanhamentos e bebidas)
export const UPSELL_IDS = ["ac01", "ac02", "bb01", "bb02"];

// Aplica edições do painel admin (aba "Adicionais Globais") por cima dos
// grupos base: grupos base só têm nome/min/max/itens sobrescritos por
// inteiro (o grupo em si nunca some, porque itens do cardápio referenciam
// o id em `addons`); grupos extras criados no admin são anexados/removidos
// livremente. Mesma chave lida/escrita por public/admin.html
// (`tnm_admin_addon_groups`).
function aplicarAddonsAdmin(base) {
  if (typeof localStorage === "undefined") return base;
  let dados = {};
  try {
    dados = JSON.parse(localStorage.getItem("tnm_admin_addon_groups") || "{}");
  } catch {
    dados = {};
  }
  const overrides = dados.overrides || {};
  const extras = dados.extras || [];
  const comOverrides = { ...base };
  for (const id of Object.keys(comOverrides)) {
    if (overrides[id]) comOverrides[id] = { ...comOverrides[id], ...overrides[id] };
  }
  for (const grupo of extras) {
    comOverrides[grupo.id] = grupo;
  }
  return comOverrides;
}

export const ADDON_GROUPS = aplicarAddonsAdmin(ADDON_GROUPS_BASE);

// Aplica as edições feitas no painel administrativo (brasa-sal-admin.html /
// public/admin.html) por cima do cardápio mockado acima: prato marcado como
// "esgotado" some do cardápio do cliente, edição de nome/preço/descrição é
// aplicada, e pratos criados no admin (que não existem aqui) são anexados.
// Lido 1x no carregamento do módulo — para ver uma edição feita no admin,
// recarregue a página do cliente. Ver tnm_admin_menu_overrides/
// tnm_admin_menu_extra em brasa-sal-admin.html (campos nome/preço/descrição
// usam os nomes do admin — name/price/desc — por isso o mapeamento abaixo).
function aplicarCatalogoAdmin(base) {
  if (typeof localStorage === "undefined") return base;

  let overrides = {};
  try {
    overrides = JSON.parse(
      localStorage.getItem("tnm_admin_menu_overrides") || "{}",
    );
  } catch {
    overrides = {};
  }

  let extras = [];
  try {
    extras = JSON.parse(localStorage.getItem("tnm_admin_menu_extra") || "[]");
  } catch {
    extras = [];
  }

  const comOverrides = base
    .filter(
      (item) =>
        overrides[item.id]?.available !== false &&
        overrides[item.id]?.estoque !== 0,
    )
    .map((item) => {
      const o = overrides[item.id];
      if (!o) return item;
      return {
        ...item,
        ...(o.name !== undefined ? { nome: o.name } : {}),
        ...(o.price !== undefined ? { preco: o.price } : {}),
        ...(o.desc !== undefined ? { desc: o.desc } : {}),
        ...(o.foto !== undefined ? { imgUrl: o.foto } : {}),
      };
    });
  const itensExtras = extras
    .filter((item) => item.available !== false && item.estoque !== 0)
    .map((item) => ({
      id: item.id,
      cat: item.cat,
      nome: item.name,
      desc: item.desc,
      preco: item.price,
      icon: "🍽️",
      img: "🍽️",
      imgUrl: item.foto,
      addons: [],
    }));

  return [...comOverrides, ...itensExtras];
}

export const MENU = aplicarCatalogoAdmin(MENU_BASE);

// Debita o estoque controlado pelo admin (tnm_admin_menu_overrides/_extra)
// quando um pedido é finalizado — só afeta itens em que o admin definiu um
// número de estoque; itens sem controle (estoque undefined) são ignorados.
// Chamado por AppContext ao gravar o pedido em `pedidos` (ver finalizarPedido).
export function baixarEstoque(itensPedido) {
  if (typeof localStorage === "undefined") return;

  let overrides = {};
  try {
    overrides = JSON.parse(
      localStorage.getItem("tnm_admin_menu_overrides") || "{}",
    );
  } catch {
    overrides = {};
  }
  let extras = [];
  try {
    extras = JSON.parse(localStorage.getItem("tnm_admin_menu_extra") || "[]");
  } catch {
    extras = [];
  }

  let overridesMudou = false;
  let extrasMudou = false;
  for (const { itemId, qtd } of itensPedido) {
    if (typeof overrides[itemId]?.estoque === "number") {
      overrides[itemId] = {
        ...overrides[itemId],
        estoque: Math.max(0, overrides[itemId].estoque - qtd),
      };
      overridesMudou = true;
      continue;
    }
    const extraIdx = extras.findIndex((e) => e.id === itemId);
    if (extraIdx !== -1 && typeof extras[extraIdx].estoque === "number") {
      extras[extraIdx] = {
        ...extras[extraIdx],
        estoque: Math.max(0, extras[extraIdx].estoque - qtd),
      };
      extrasMudou = true;
    }
  }
  if (overridesMudou) {
    localStorage.setItem(
      "tnm_admin_menu_overrides",
      JSON.stringify(overrides),
    );
  }
  if (extrasMudou) {
    localStorage.setItem("tnm_admin_menu_extra", JSON.stringify(extras));
  }
}
