// Catálogo no servidor: o catálogo-base (src/data/catalogoBase.js, mesma fonte do app e do
// painel) + as edições do admin guardadas no Postgres (CatalogoConfig, EstoquePrato).
// Daqui saem o cardápio servido ao cliente e a lista de preços usada pra conferir pedidos.
import { ADDON_GROUPS_BASE, CATEGORIES_BASE, COUPONS, MENU_BASE } from "../../../src/data/catalogoBase.js";
import { aplicarAddons, aplicarCatalogo, aplicarCategorias } from "../../../src/data/catalogoAplicar.js";

export { COUPONS };

export const CHAVES_CONFIG = ["menu_overrides", "menu_extra", "categorias", "addon_groups"];
const PADRAO = {
  menu_overrides: {},
  menu_extra: [],
  categorias: { overrides: {}, extras: [] },
  addon_groups: { overrides: {}, extras: [] },
};

// db = prisma ou um cliente de transação. Devolve as 4 chaves + estoque { [itemId]: n }.
export async function carregarConfig(db) {
  const [linhas, estoques] = await Promise.all([db.catalogoConfig.findMany(), db.estoquePrato.findMany()]);
  return {
    ...PADRAO,
    ...Object.fromEntries(linhas.map((l) => [l.chave, l.valor])),
    estoque: Object.fromEntries(estoques.map((e) => [e.itemId, e.quantidade])),
  };
}

export function catalogoEfetivo(cfg) {
  return {
    menu: aplicarCatalogo(MENU_BASE, { overrides: cfg.menu_overrides, extras: cfg.menu_extra, estoque: cfg.estoque }),
    categories: aplicarCategorias(CATEGORIES_BASE, cfg.categorias),
    addonGroups: aplicarAddons(ADDON_GROUPS_BASE, cfg.addon_groups),
  };
}

const texto = (v, max) => typeof v === "string" && v.length <= max;
const preco = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10000;
const foto = (v) => v == null || (texto(v, 400_000) && /^(data:image\/|https?:\/\/)/.test(v));

// Valida o formato antes de gravar: o admin é de confiança, mas um valor torto aqui
// derrubaria o cardápio inteiro (aplicarCatalogo roda em toda leitura).
export function validarConfig(chave, v) {
  const objeto = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (chave === "menu_overrides") {
    if (!objeto(v)) return "Formato inválido";
    for (const [id, o] of Object.entries(v)) {
      if (!texto(id, 40) || !objeto(o)) return "Formato inválido";
      if (o.name !== undefined && !texto(o.name, 120)) return "Nome inválido";
      if (o.price !== undefined && !preco(o.price)) return "Preço inválido";
      if (o.desc !== undefined && !texto(o.desc, 500)) return "Descrição inválida";
      if (o.available !== undefined && typeof o.available !== "boolean") return "Formato inválido";
      if (!foto(o.foto)) return "Foto inválida ou grande demais";
    }
    return null;
  }
  if (chave === "menu_extra") {
    if (!Array.isArray(v) || v.length > 300) return "Formato inválido";
    for (const d of v) {
      if (!objeto(d) || !texto(d.id, 40) || !texto(d.cat, 40) || !texto(d.name, 120) || !preco(d.price)) return "Prato inválido";
      if (d.desc != null && !texto(d.desc, 500)) return "Descrição inválida";
      if (!foto(d.foto)) return "Foto inválida ou grande demais";
    }
    return null;
  }
  if (chave === "categorias") {
    if (!objeto(v) || (v.extras && !Array.isArray(v.extras))) return "Formato inválido";
    if (!(v.extras || []).every((c) => objeto(c) && texto(c.id, 40) && texto(c.label, 80))) return "Categoria inválida";
    return null;
  }
  // addon_groups
  if (!objeto(v) || (v.extras && !Array.isArray(v.extras))) return "Formato inválido";
  const grupoOk = (g) =>
    objeto(g) && texto(g.id, 40) && texto(g.nome, 80) && Number.isInteger(g.min) && Number.isInteger(g.max) &&
    Array.isArray(g.itens) && g.itens.length <= 60 && g.itens.every((i) => objeto(i) && texto(i.id, 40) && texto(i.nome, 80) && preco(i.preco));
  const patches = Object.values(v.overrides || {});
  if (!(v.extras || []).every(grupoOk)) return "Grupo de adicionais inválido";
  if (!patches.every((p) => objeto(p) && (p.itens === undefined || (Array.isArray(p.itens) && p.itens.every((i) => objeto(i) && texto(i.id, 40) && texto(i.nome, 80) && preco(i.preco)))))) {
    return "Grupo de adicionais inválido";
  }
  return null;
}
