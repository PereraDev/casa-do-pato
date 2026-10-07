// Gera public/admin/catalogo.gerado.js a partir de src/data/catalogoBase.js.
// O admin é HTML solto servido de public/ (sem bundler, sem acesso a src/ em
// produção), então recebe uma cópia gerada em vez de manter um espelho à mão.
// Roda sozinho em `npm run dev`/`build` (predev/prebuild) — não editar o gerado.
import fs from "node:fs";
import { ADDON_GROUPS_BASE, CATEGORIES_BASE, COUPONS, MENU_BASE, REVIEWS_MOCK } from "../src/data/catalogoBase.js";

// Visões reduzidas que o admin usa: preço = o que o cliente de fato paga (promo ?? normal);
// categoria sem o ícone (só o app cliente desenha).
const itens = MENU_BASE.map((d) => ({ id: d.id, cat: d.cat, name: d.nome, price: d.precoPromo ?? d.preco, desc: d.desc }));
const categorias = CATEGORIES_BASE.map((c) => ({ id: c.id, label: c.label }));
const umPorLinha = (lista) => "[\n" + lista.map((x) => "  " + JSON.stringify(x)).join(",\n") + "\n]";
const json = (v) => JSON.stringify(v, null, 2);

const saida =
  "// GERADO por scripts/gerar-catalogo-admin.mjs a partir de src/data/catalogoBase.js — NÃO EDITE.\n" +
  `export var MENU_BASE = ${umPorLinha(itens)};\n` +
  `export var CATEGORIES_BASE = ${umPorLinha(categorias)};\n` +
  `export var ADDON_GROUPS_BASE = ${json(ADDON_GROUPS_BASE)};\n` +
  `export var COUPONS = ${json(COUPONS)};\n` +
  `export var REVIEWS_MOCK = ${json(REVIEWS_MOCK)};\n`;

fs.writeFileSync(new URL("../public/admin/catalogo.gerado.js", import.meta.url), saida);
console.log(
  `catalogo.gerado.js: ${itens.length} itens, ${categorias.length} categorias, ${Object.keys(ADDON_GROUPS_BASE).length} grupos de adicionais`,
);
