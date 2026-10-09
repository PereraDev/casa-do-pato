// Regras que transformam o catálogo-base + o que o admin editou no catálogo EFETIVO.
// Módulo puro, sem imports: o servidor (server/src/lib/catalogo.js) usa estas funções pra
// montar o cardápio e conferir preço de pedido, e o app cliente só recebe o resultado.
// As edições do admin vivem no Postgres (tabelas CatalogoConfig e EstoquePrato), não mais
// em localStorage. Ver CLAUDE.md, "Catálogo no servidor".

// Preço que o cliente de fato paga: promoção só vale se for menor que o normal.
export function precoBase(item) {
  return item.precoPromo != null && item.precoPromo < item.preco ? item.precoPromo : item.preco;
}

// overrides: { [id]: {available?, name?, price?, desc?, foto?} } — edição de prato base.
// extras:    [{id, cat, name, price, desc, foto?, available?}] — pratos criados no admin.
// estoque:   { [id]: número } — só pratos com controle; 0 = esgotado (some do cardápio).
export function aplicarCatalogo(base, { overrides = {}, extras = [], estoque = {} } = {}) {
  const ativo = (id, disponivel) => disponivel !== false && estoque[id] !== 0;
  const editados = base
    .filter((item) => ativo(item.id, overrides[item.id]?.available))
    .map((item) => {
      const o = overrides[item.id];
      if (!o) return item;
      return {
        ...item,
        ...(o.name !== undefined ? { nome: o.name } : {}),
        // Preço editado no admin vale como preço final: descarta a promoção do prato base
        // (senão precoBase() continuaria devolvendo o preço promocional antigo).
        ...(o.price !== undefined ? { preco: o.price, precoPromo: undefined, descontoPct: undefined } : {}),
        ...(o.desc !== undefined ? { desc: o.desc } : {}),
        ...(o.foto !== undefined ? { imgUrl: o.foto } : {}),
      };
    });
  const criados = extras
    .filter((item) => ativo(item.id, item.available))
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
  return [...editados, ...criados];
}

// dados: { overrides: {[id]: {label}}, extras: [categoria] } — só o rótulo da base é editável.
export function aplicarCategorias(base, { overrides = {}, extras = [] } = {}) {
  const editadas = base.map((c) => (overrides[c.id]?.label ? { ...c, label: overrides[c.id].label } : c));
  return [...editadas, ...extras];
}

// dados: { overrides: {[id]: patch}, extras: [grupo] } — grupo base nunca some (itens referenciam o id).
export function aplicarAddons(base, { overrides = {}, extras = [] } = {}) {
  const saida = { ...base };
  for (const id of Object.keys(saida)) {
    if (overrides[id]) saida[id] = { ...saida[id], ...overrides[id] };
  }
  for (const grupo of extras) saida[grupo.id] = grupo;
  return saida;
}
