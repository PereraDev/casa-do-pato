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

// Catálogo EFETIVO (cardápio, categorias, grupos de adicionais): vem do servidor
// (GET /api/catalogo, ver AppContext) com as edições do admin e o estoque já aplicados.
// São objetos/arrays MUTÁVEIS exportados de propósito: `aplicarCatalogoServidor` troca o
// conteúdo no lugar, então todo `import { MENU }` enxerga o dado novo no próximo render.
// Começam com o catálogo-base, pra tela não nascer vazia (e pra funcionar se o servidor
// ainda não respondeu); o servidor continua sendo quem confere preço e disponibilidade.
export const CATEGORIES = [...CATEGORIES_BASE];
export const ADDON_GROUPS = { ...ADDON_GROUPS_BASE };
export const MENU = [...MENU_BASE];

// Ids de itens sugeridos no componente de up-sell/cross-sell (acompanhamentos e bebidas)
export const UPSELL_IDS = ["ac01", "ac02", "bb01", "bb02"];

export function aplicarCatalogoServidor({ menu, categories, addonGroups }) {
  MENU.splice(0, MENU.length, ...menu);
  CATEGORIES.splice(0, CATEGORIES.length, ...categories);
  for (const id of Object.keys(ADDON_GROUPS)) delete ADDON_GROUPS[id];
  Object.assign(ADDON_GROUPS, addonGroups);
}
