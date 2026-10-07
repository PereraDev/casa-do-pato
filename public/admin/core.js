// core.js — TUDO que não é render*/nav/init: estado global, acesso a dado
// (localStorage + back-end) e helpers genéricos, compartilhados por todos
// os arquivos de área. Mesmo princípio do utils/utils.js do cliente React:
// reúne toda a camada de dado/estado num arquivo só, sem tentar adivinhar
// "dono único" pra função lida por várias áreas diferentes (é a norma
// aqui, não exceção). Ver CLAUDE.md — "Integração com o painel
// administrativo" pra contexto arquitetural completo.
import { rerenderSecaoAtiva } from "./nav.js";
// Catálogo-base, cupons e avaliações mock: GERADOS de src/data/catalogoBase.js
// (npm run gerar:catalogo, roda sozinho em predev/prebuild). Edições feitas
// aqui (preço/descrição/disponibilidade) vão pra tnm_admin_menu_overrides e
// itens novos pra tnm_admin_menu_extra — lidos de volta pelo app cliente.
import { MENU_BASE, CATEGORIES_BASE, ADDON_GROUPS_BASE, COUPONS, REVIEWS_MOCK } from "./catalogo.gerado.js";
export { COUPONS };

/* ============ ÍCONES (inline SVG, stroke=currentColor) ============ */
export var ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  pratos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/></svg>',
  avaliacoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.3l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z"/></svg>',
  mesas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v7M19 12v7"/></svg>',
  pedidos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h12l1 5.5a5.5 5.5 0 01-11 0z"/><path d="M12 8.5V21"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="8.5" r="2.6"/><path d="M15.8 14.3c2.9.4 5.2 2.5 5.2 5.7"/></svg>',
  financeiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15.2 9.2c0-1.4-1.4-2.4-3.2-2.4-2 0-3.2 1-3.2 2.3 0 3.1 6.4 1.5 6.4 4.6 0 1.4-1.4 2.4-3.2 2.4-1.8 0-3.2-1-3.2-2.4"/></svg>',
  pdv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/><path d="M7 8h4M7 11h2"/></svg>',
  fidelidade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8.5" r="5.2"/><path d="M8.5 13 7 21l5-2.6L17 21l-1.5-8"/></svg>',
  cozinha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v6M9 3v6M6 6h3M12 3c0 3-2 3-2 6v12h4V9c0-3-2-3-2-6z"/></svg>',
  funcionarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4.1 3.4-6.8 7.5-6.8s7.5 2.7 7.5 6.8"/></svg>',
  categorias: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  adicionais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/></svg>',
  delivery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
  caixas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 11h18M8 3.5h8"/></svg>',
  produtosDesempenho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  garcons: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="7" r="3.4"/><path d="M5.5 20c0-3.9 2.9-6.4 6.5-6.4s6.5 2.5 6.5 6.4"/><path d="M9 13.6V21M15 13.6V21"/></svg>',
  configuracoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.7 7.7 0 000-3l1.9-1.5-2-3.4-2.2.9a7.6 7.6 0 00-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 00-2.6 1.5l-2.2-.9-2 3.4L4.6 10.5a7.7 7.7 0 000 3L2.7 15l2 3.4 2.2-.9c.76.66 1.64 1.17 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 002.6-1.5l2.2.9 2-3.4z"/></svg>',
  insumos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.5l8 4.4v10.2l-8 4.4-8-4.4V6.9z"/><path d="M4 6.9l8 4.4 8-4.4M12 11.3V21"/></svg>',
  fichaTecnica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 2.5h9l3 3V21.5H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
  fornecedores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
  compras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2.5 3h2.5l2.4 12.2a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 7H6"/></svg>',
  contasPagar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18M8 14.5h4" stroke-linejoin="round"/><path d="M15 3v4M9 3v4"/></svg>',
  contasReceber: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18M12 13.5v3M10 15h4"/></svg>',
  relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 21V3M4 21h17"/><path d="M8 17V11M12.5 17V7M17 17v-5"/></svg>'
};

export var MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

/* ============ INTEGRAÇÃO COM O APP CLIENTE (localStorage tnm_*) ============
   Este painel roda como HTML solto, mas lê e escreve nas MESMAS chaves de
   localStorage usadas pelo app React "Casa do Pato" (ver Cliente/.../src/data
   e AppContext.jsx) — por isso só reflete pedidos/avaliações/contas reais
   quando servido na MESMA origem do app (ex.: http://localhost:5173/admin.html
   durante o `npm run dev`, cópia mantida em public/admin.html). Aberto
   direto como arquivo (file://) ele funciona normalmente, só que "vazio"
   (sem pedidos/contas ainda), pois localStorage é isolado por origem. */
export function lsGet(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignora (ex.: storage cheio) */ }
}

/* ---- Back-end (server/) — só pedidos e chamado de garçom migraram pra
   cá; cardápio/estoque, PDV (preço/cupom), caixa, funcionários e fidelidade
   continuam 100% localStorage acima. Mesma origem do admin.html (sem CORS,
   ver vite.config.js em dev / server/src/plugins/staticFrontend.js em
   produção), por isso URL relativa. ---- */
export function api(path, options) {
  options = options || {};
  var fetchOptions = { method: options.method || "GET", credentials: "include" };
  // Só manda Content-Type/body quando existe body de verdade — o Fastify
  // rejeita (FST_ERR_CTP_EMPTY_JSON_BODY) uma requisição com Content-Type
  // application/json e corpo vazio, o que quebrava ações sem payload tipo
  // "cancelar"/"receber"/"pagar" (`api(url, {method:"PATCH"})`).
  if (options.body !== undefined) {
    fetchOptions.headers = {"Content-Type": "application/json"};
    fetchOptions.body = JSON.stringify(options.body);
  }
  return fetch(path, fetchOptions).then(function (resp) {
    return resp.text().then(function (texto) {
      var dados = texto ? JSON.parse(texto) : null;
      if (!resp.ok) throw new Error((dados && dados.erro) || "Erro de comunicação com o servidor");
      return dados;
    });
  });
}

/* ---- Categorias (tnm_admin_categorias) — aba "Categorias". Categorias
   base só têm o rótulo renomeável (o id é referenciado pelas abas do
   cliente e pelos pratos, não pode sumir); categorias extras criadas
   aqui podem ser removidas de volta, contanto que nenhum prato as use
   mais. Mesma chave lida por data.js#aplicarCategoriasAdmin no cliente. */
export function getCategoriasDados() { return lsGet("tnm_admin_categorias", {overrides:{}, extras:[]}); }
export function saveCategoriasDados(dados) { lsSet("tnm_admin_categorias", dados); }
export function getCategorias() {
  var dados = getCategoriasDados();
  var overrides = dados.overrides || {};
  var comOverrides = CATEGORIES_BASE.map(function (c) {
    return (overrides[c.id] && overrides[c.id].label) ? Object.assign({}, c, {label: overrides[c.id].label}) : c;
  });
  return comOverrides.concat(dados.extras || []);
}
export function isCategoriaBase(id) { return CATEGORIES_BASE.some(function (c) { return c.id === id; }); }
export function catLabel(id) {
  var c = getCategorias().filter(function (x) { return x.id === id; })[0];
  return c ? c.label : id;
}



export function getAddonDados() { return lsGet("tnm_admin_addon_groups", {overrides:{}, extras:[]}); }
export function saveAddonDados(dados) { lsSet("tnm_admin_addon_groups", dados); }
export function getAddonGroups() {
  var dados = getAddonDados();
  var overrides = dados.overrides || {};
  var out = {};
  Object.keys(ADDON_GROUPS_BASE).forEach(function (id) {
    out[id] = overrides[id] ? Object.assign({}, ADDON_GROUPS_BASE[id], overrides[id]) : ADDON_GROUPS_BASE[id];
  });
  (dados.extras || []).forEach(function (g) { out[g.id] = g; });
  return out;
}
export function isAddonGroupBase(id) { return !!ADDON_GROUPS_BASE[id]; }
export function saveAddonGroupOverride(id, patch) {
  var dados = getAddonDados();
  dados.overrides = dados.overrides || {};
  dados.overrides[id] = Object.assign({}, dados.overrides[id], patch);
  saveAddonDados(dados);
}
export function saveAddonGroupExtra(grupo) {
  var dados = getAddonDados();
  dados.extras = (dados.extras || []).map(function (g) { return g.id === grupo.id ? grupo : g; });
  if (!dados.extras.some(function (g) { return g.id === grupo.id; })) dados.extras.push(grupo);
  saveAddonDados(dados);
}
export function removeAddonGroupExtra(id) {
  var dados = getAddonDados();
  dados.extras = (dados.extras || []).filter(function (g) { return g.id !== id; });
  saveAddonDados(dados);
}


/* ---- Pratos: catálogo efetivo = MENU_BASE + overrides + extras (admin) ---- */
export function getDishes() {
  // Mostra TODOS os pratos aqui (inclusive esgotados, com botão "Reabrir")
  // — quem esconde um prato indisponível do cardápio do cliente é o
  // data.js do app React (aplicarOverridesAdmin), não esta tela.
  var overrides = lsGet("tnm_admin_menu_overrides", {});
  var extras = lsGet("tnm_admin_menu_extra", []);
  var base = MENU_BASE.map(function (d) {
    var o = overrides[d.id];
    return o ? Object.assign({available:true}, d, o) : Object.assign({available:true}, d);
  });
  return base.concat(extras);
}
export function saveDishOverride(id, patch) {
  var overrides = lsGet("tnm_admin_menu_overrides", {});
  overrides[id] = Object.assign({}, overrides[id], patch);
  lsSet("tnm_admin_menu_overrides", overrides);
}
export function addDishExtra(dish) {
  var extras = lsGet("tnm_admin_menu_extra", []);
  extras.push(dish);
  lsSet("tnm_admin_menu_extra", extras);
}
export function removeDishExtra(id) {
  var extras = lsGet("tnm_admin_menu_extra", []).filter(function (d) { return d.id !== id; });
  lsSet("tnm_admin_menu_extra", extras);
}
export function isBaseDish(id) { return MENU_BASE.some(function (d) { return d.id === id; }); }

/* ---- Avaliações reais (tnm_reviews_user) + mockadas (REVIEWS_MOCK) ---- */
export function getReviews() {
  var userReviews = lsGet("tnm_reviews_user", {});
  var dishById = {};
  getDishes().concat(MENU_BASE).forEach(function (d) { dishById[d.id] = d.name; });
  var out = [];
  var ids = Object.keys(Object.assign({}, REVIEWS_MOCK, userReviews));
  ids.forEach(function (itemId) {
    var lista = (userReviews[itemId] || []).concat(REVIEWS_MOCK[itemId] || []);
    lista.forEach(function (r) {
      out.push({
        customer: r.autor,
        rating: r.estrelas,
        dish: dishById[itemId] || itemId,
        date: r.data,
        text: r.comentario
      });
    });
  });
  return out;
}

/* ---- Pedidos — migraram pro back-end (server/), não vêm mais de
   tnm_pedidos. state.pedidosCache é populado 1x no init() e mantido em dia
   por eventos de socket ("pedido:novo"/"pedido:atualizado", ver initSocket
   mais abaixo) — getPedidosReais() continua SÍNCRONA com o mesmo formato
   de retorno de antes, então as ~15 renderX() que já chamam ela não
   precisam mudar nada. ---- */
export function statusPedidoReal(pedido) {
  if (pedido._canceladoAdmin) return "cancelado";
  if (pedido.statusManual) return pedido.statusManual;
  var decorrido = (Date.now() - pedido.criadoEm) / 1000;
  if (decorrido < 10) return "recebido";
  if (decorrido < 30) return "preparo";
  if (decorrido < 50) return "pronto";
  return "entregue";
}
export var TIPO_PEDIDO_LABEL = { balcao: "Retirar no balcão", mesa: "Na mesa", entrega: "Entrega" };
export var PAGAMENTO_LABEL = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito", dividido: "Dividido" };
// Formas de pagamento oferecidas por pessoa ao dividir a conta no PDV —
// mais granular que o pagamento único (pix/cartao/dinheiro), porque ali
// faz sentido diferenciar débito de crédito por maquininha.
export var DIVISAO_PAGAMENTOS = ["pix", "debito", "credito", "dinheiro"];
export function getPedidosReais() {
  return state.pedidosCache.map(function (p) {
    var d = new Date(p.criadoEm);
    return Object.assign({}, p, {
      status: statusPedidoReal(p),
      m: d.getMonth() + 1, y: d.getFullYear(), d_: d.getDate(),
      time: String(d.getHours()).padStart(2,'0') + ":" + String(d.getMinutes()).padStart(2,'0'),
      itemsLabel: (p.itens || []).map(function (it) { return it.qtd + "x " + it.nome; }).join(", "),
      tipoLabel: TIPO_PEDIDO_LABEL[p.tipo] || p.tipo
    });
  });
}
export function carregarPedidosCache() {
  return api("/api/pedidos/todos").then(function (pedidos) { state.pedidosCache = pedidos; });
}
export function patchPedidoCache(id, patch) {
  state.pedidosCache = state.pedidosCache.map(function (p) {
    return p.id === id ? Object.assign({}, p, patch) : p;
  });
}
export function toggleCancelPedido(id) {
  var atual = state.pedidosCache.filter(function (p) { return p.id === id; })[0];
  if (!atual) return;
  // Patch otimista no cache (mantém a UI instantânea, como antes) — o
  // eco do evento de socket que volta é só uma confirmação (no-op).
  patchPedidoCache(id, { _canceladoAdmin: !atual._canceladoAdmin });
  api("/api/pedidos/" + id + "/cancelar", { method: "PATCH" }).catch(function () {});
}
// Painel de Cozinha (KDS): grava um status manual no próprio pedido —
// dali em diante o relógio (statusPedido/statusPedidoReal) é ignorado
// pra sempre nesse pedido, no cliente e no admin (ver utils/pedidos.js).
export function avancarStatusPedido(id, novoStatus) {
  patchPedidoCache(id, { statusManual: novoStatus });
  api("/api/pedidos/" + id + "/status", { method: "PATCH", body: { statusManual: novoStatus } }).catch(function () {});
}

/* ---- Chamados de garçom — migraram pro back-end (server/), mesmo padrão
   de cache que os pedidos acima. Quem atende fica gravado no próprio
   chamado (`atendidoPor`) — é o funcionário logado no momento do clique em
   "Atender", sem formulário extra — e alimenta a aba Desempenho > Garçons
   (ver renderGarcons). ---- */
// Espelho de MOTIVO_GARCOM (utils/pedidos.js do cliente) — só pra exibir
// o motivo do chamado de forma legível aqui.
export var MOTIVO_GARCOM = {
  presenca: "Só chamando",
  talheres: "Preciso de talheres/guardanapo",
  conta: "Pedir a conta",
  duvida: "Dúvida no cardápio",
  outro: "Outro motivo"
};
export function getChamadasGarcom() { return state.chamadasCache; }
export function chamadasPendentes() { return getChamadasGarcom().filter(function (c) { return !c.atendidoEm; }); }
export function carregarChamadasCache() {
  return api("/api/garcom/chamadas").then(function (chamadas) { state.chamadasCache = chamadas; });
}
export function atenderChamada(id) {
  var quem = state.usuarioLogado ? {id: state.usuarioLogado.id, nome: state.usuarioLogado.nome, funcao: state.usuarioLogado.funcao} : null;
  state.chamadasCache = state.chamadasCache.map(function (c) {
    return c.id === id ? Object.assign({}, c, {atendidoEm: Date.now(), atendidoPor: quem}) : c;
  });
  api("/api/garcom/chamadas/" + id + "/atender", { method: "PATCH", body: { funcionario: quem } }).catch(function () {});
}

/* ---- Funções do painel (tnm_admin_funcoes) — antes era uma lista fixa
   (admin/cozinha/pdv/garcom, cada uma com um conjunto fixo de seções via
   ROLE_SECOES); agora é editável na aba Funcionários: dá pra criar uma
   função nova ou apagar uma que não esteja mais em uso por ninguém.
   Cada função carrega um conjunto PADRÃO de seções liberadas
   (`secoesPadrao`), usado só pra pré-marcar o checklist ao cadastrar
   alguém com essa função — o funcionário em si pode ter
   `secoesPermitidas` próprias que sobrescrevem esse padrão (ver
   secoesPermitidas() abaixo). "admin" sempre enxerga tudo
   (secoesPadrao: null) e não pode ser editada/apagada. */
export var FUNCOES_PADRAO = [
  { id: "admin", label: "Administrador", secoesPadrao: null },
  { id: "cozinha", label: "Cozinha", secoesPadrao: ["cozinha"] },
  { id: "pdv", label: "PDV", secoesPadrao: ["pdv"] },
  { id: "garcom", label: "Garçom", secoesPadrao: ["mesas"] },
];
export function getFuncoes() {
  var lista = lsGet("tnm_admin_funcoes", null);
  if (!lista) {
    lista = FUNCOES_PADRAO;
    lsSet("tnm_admin_funcoes", lista);
  }
  return lista;
}
export function saveFuncoes(lista) { lsSet("tnm_admin_funcoes", lista); }
export function funcaoLabel(id) {
  var f = getFuncoes().filter(function (x) { return x.id === id; })[0];
  return f ? f.label : id;
}

/* ---- Funcionários do painel (tnm_admin_funcionarios) ----
   Login/senha + função de cada membro da equipe com acesso ao admin.
   `secoesPermitidas` (opcional, array de chaves de SECTIONS) sobrescreve
   o padrão da função pra ESSE funcionário específico — cadastrado na
   hora de criar/editar (ver renderFuncionarios); sem isso, cai no
   secoesPadrao da função. Sem equivalente no cliente: só existe pra
   controlar o próprio painel. */
export function getFuncionarios() {
  var lista = lsGet("tnm_admin_funcionarios", null);
  if (!lista) {
    lista = [{id:"f-admin", nome:"Administrador", usuario:"admin@casadopato.com", senha:"senha123", funcao:"admin"}];
    lsSet("tnm_admin_funcionarios", lista);
  }
  // Migração única da troca de nome (Tá na Mesa → Casa do Pato): logins já
  // salvos neste navegador com o domínio antigo passam pro novo.
  if (lista.some(function (f) { return /@tanamesa\.com$/i.test(f.usuario); })) {
    lista = lista.map(function (f) {
      return Object.assign({}, f, {usuario: f.usuario.replace(/@tanamesa\.com$/i, "@casadopato.com")});
    });
    lsSet("tnm_admin_funcionarios", lista);
  }
  return lista;
}
export function saveFuncionarios(lista) { lsSet("tnm_admin_funcionarios", lista); }
export function autenticarFuncionario(usuario, senha) {
  usuario = (usuario || "").trim().toLowerCase();
  return getFuncionarios().filter(function (f) {
    return f.usuario.toLowerCase() === usuario && f.senha === senha;
  })[0] || null;
}
// Aceita o funcionário inteiro (respeita secoesPermitidas próprias, se
// cadastradas) ou só o id da função (cai no padrão dela) — ver chamadas
// em initSession/goTo.
export function secoesPermitidas(funcionarioOuFuncaoId) {
  var funcionario = funcionarioOuFuncaoId && typeof funcionarioOuFuncaoId === "object" ? funcionarioOuFuncaoId : null;
  if (funcionario && Array.isArray(funcionario.secoesPermitidas)) return funcionario.secoesPermitidas;
  var funcaoId = funcionario ? funcionario.funcao : funcionarioOuFuncaoId;
  // "admin" é a ÚNICA função com acesso total (secoesPadrao: null, de
  // propósito) — checado pelo id explicitamente. Uma função apagada/
  // renomeada que sobrou num funcionário (ou um funcaoId digitado errado)
  // cai em "nenhum acesso", nunca em acesso total por engano.
  if (funcaoId === "admin") return SECTIONS.map(function (s) { return s.key; });
  var funcao = getFuncoes().filter(function (f) { return f.id === funcaoId; })[0];
  return funcao && Array.isArray(funcao.secoesPadrao) ? funcao.secoesPadrao : [];
}

/* ---- Contas reais — migraram pro back-end junto com login/cadastro do
   cliente (ver CLAUDE.md, "Back-end (server/)"); não vêm mais de
   tnm_usuarios. Mesmo padrão de cache que pedidos/chamados: síncrona,
   lendo de state.usuariosCache, populada 1x no init(). Sem push em tempo
   real (cadastro de cliente não é uma preocupação de operação ao vivo pra
   equipe) — atualiza a cada vez que a seção Clientes/Fidelidade é aberta
   de novo (init()/renderAll()). ---- */
export function getUsuarios() {
  return state.usuariosCache.map(function (u) { return { email: u.email, name: u.nome }; });
}
export function carregarUsuariosCache() {
  return api("/api/auth/usuarios").then(function (usuarios) { state.usuariosCache = usuarios; });
}

/* ============ ERP (Insumos / Compras / Financeiro) ============
   Módulo administrativo novo, 100% back-end (server/) desde o início —
   nunca existiu em localStorage. Mesmo padrão de cache síncrono das
   seções acima: populado no init()/carregarErpCache(), mantido em dia
   por eventos de socket (ver initSocket). ---- */
export function getInsumos() { return state.insumosCache.filter(function (i) { return i.ativo; }); }
export function insumoLabel(id) {
  var i = state.insumosCache.filter(function (x) { return x.id === id; })[0];
  return i ? i.nome + " (" + i.unidade + ")" : id;
}
export function insumosBaixoEstoque() {
  return getInsumos().filter(function (i) { return i.estoqueMinimo != null && i.estoqueAtual <= i.estoqueMinimo; });
}
export function getFornecedores() { return state.fornecedoresCache.filter(function (f) { return f.ativo; }); }
export function fornecedorLabel(id) {
  var f = state.fornecedoresCache.filter(function (x) { return x.id === id; })[0];
  return f ? f.nome : "—";
}
// "vencido" é um estado visual derivado (comparação com a data atual),
// nunca gravado no banco — mesmo espírito de statusPedidoReal calculado
// pelo relógio em vez de guardado.
export function statusContaVisual(conta) {
  if (conta.status === "pendente" && conta.vencimento < Date.now()) return "vencido";
  return conta.status;
}

export function carregarInsumosCache() { return api("/api/estoque/insumos").then(function (r) { state.insumosCache = r; }); }
export function carregarMovimentosCache() { return api("/api/estoque/movimentos").then(function (r) { state.movimentosCache = r; }); }
export function carregarFornecedoresCache() { return api("/api/fornecedores").then(function (r) { state.fornecedoresCache = r; }); }
export function carregarComprasCache() { return api("/api/compras").then(function (r) { state.comprasCache = r; }); }
export function carregarContasPagarCache() { return api("/api/financeiro/contas-pagar").then(function (r) { state.contasPagarCache = r; }); }
export function carregarContasReceberCache() { return api("/api/financeiro/contas-receber").then(function (r) { state.contasReceberCache = r; }); }
export function carregarErpCache() {
  return Promise.all([
    carregarInsumosCache(), carregarMovimentosCache(), carregarFornecedoresCache(),
    carregarComprasCache(), carregarContasPagarCache(), carregarContasReceberCache()
  ]);
}

/* ---- Configurações da loja (tnm_admin_config_loja) — aba "Configurações".
   Só existe no admin; a taxa de entrega e o indicador aberto/fechado são
   usados aqui mesmo (PDV), sem equivalente do lado do cliente. ---- */
export var CONFIG_LOJA_PADRAO = {
  nome: "Casa do Pato",
  horaAbertura: "18:00",
  horaFechamento: "23:30",
  taxaEntrega: 8.0,
  tempoPreparoMin: 25
};
export function getConfigLoja() { return Object.assign({}, CONFIG_LOJA_PADRAO, lsGet("tnm_admin_config_loja", {})); }
export function saveConfigLoja(config) { lsSet("tnm_admin_config_loja", config); }
// Compara só o relógio (HH:MM) do momento com a janela configurada —
// não trata virada de dia (ex.: abre 18:00 fecha 02:00), suficiente pro
// protótipo. Loja sem configuração salva assume o padrão acima.
export function lojaAberta() {
  var config = getConfigLoja();
  var agora = new Date();
  var hhmm = String(agora.getHours()).padStart(2,'0') + ":" + String(agora.getMinutes()).padStart(2,'0');
  return hhmm >= config.horaAbertura && hhmm <= config.horaFechamento;
}

/* ---- Estoque (mora dentro dos mesmos overrides/extra do cardápio) ----
   dish.estoque === undefined  -> sem controle de estoque (sempre disponível)
   dish.estoque === número     -> controlado; chega a 0 = some do cardápio
   do cliente também (ver aplicarCatalogoAdmin em data.js). */
export function setEstoqueDish(dish, valor) {
  valor = valor === "" || valor === null ? undefined : Math.max(0, parseInt(valor, 10) || 0);
  if (isBaseDish(dish.id)) {
    saveDishOverride(dish.id, {estoque: valor});
  } else {
    var extras = lsGet("tnm_admin_menu_extra", []).map(function (d) {
      return d.id === dish.id ? Object.assign({}, d, {estoque: valor}) : d;
    });
    lsSet("tnm_admin_menu_extra", extras);
  }
}
// Mesma lógica de data.js#baixarEstoque, duplicada aqui porque o painel é
// HTML solto (não importa o módulo ES do cliente) — usada tanto por vendas
// do PDV quanto (indiretamente, do lado do cliente) por finalizarPedido.
export function decrementarEstoque(itens) {
  var overrides = lsGet("tnm_admin_menu_overrides", {});
  var extras = lsGet("tnm_admin_menu_extra", []);
  var overridesMudou = false, extrasMudou = false;
  itens.forEach(function (it) {
    if (typeof (overrides[it.itemId] || {}).estoque === "number") {
      overrides[it.itemId] = Object.assign({}, overrides[it.itemId], {estoque: Math.max(0, overrides[it.itemId].estoque - it.qtd)});
      overridesMudou = true;
      return;
    }
    var idx = extras.findIndex(function (e) { return e.id === it.itemId; });
    if (idx !== -1 && typeof extras[idx].estoque === "number") {
      extras[idx] = Object.assign({}, extras[idx], {estoque: Math.max(0, extras[idx].estoque - it.qtd)});
      extrasMudou = true;
    }
  });
  if (overridesMudou) lsSet("tnm_admin_menu_overrides", overrides);
  if (extrasMudou) lsSet("tnm_admin_menu_extra", extras);
}

/* ---- Caixa / sangria (tnm_admin_caixas) — só existe no admin, o app
   cliente não tem esse conceito. Um "caixa" agrupa as vendas feitas pelo
   PDV entre abertura e fechamento de turno. ---- */
export function getCaixas() { return lsGet("tnm_admin_caixas", []); }
export function saveCaixas(list) { lsSet("tnm_admin_caixas", list); }
export function getCaixaAberto() {
  var caixas = getCaixas();
  return caixas.find(function (c) { return !c.fechamento; }) || null;
}
export function abrirCaixa(operador, valorInicial) {
  var caixas = getCaixas();
  var caixa = {
    id: "CX-" + Date.now(),
    operador: operador,
    abertoEm: Date.now(),
    valorInicial: valorInicial,
    sangrias: [],
    vendaIds: [],
    fechamento: null
  };
  caixas.push(caixa);
  saveCaixas(caixas);
  return caixa;
}
export function registrarSangria(caixaId, valor, motivo) {
  var caixas = getCaixas().map(function (c) {
    if (c.id !== caixaId) return c;
    return Object.assign({}, c, {sangrias: c.sangrias.concat([{valor: valor, motivo: motivo, em: Date.now()}])});
  });
  saveCaixas(caixas);
}
export function registrarVendaNoCaixa(caixaId, pedidoId) {
  var caixas = getCaixas().map(function (c) {
    if (c.id !== caixaId) return c;
    return Object.assign({}, c, {vendaIds: c.vendaIds.concat([pedidoId])});
  });
  saveCaixas(caixas);
}
export function resumoCaixa(caixa) {
  // Pedidos agora vêm do back-end (state.pedidosCache, ver init()), não
  // mais de tnm_pedidos.
  var pedidos = state.pedidosCache.filter(function (p) { return caixa.vendaIds.indexOf(p.id) !== -1 && !p._canceladoAdmin; });
  var porPagamento = {pix: 0, cartao: 0, dinheiro: 0, debito: 0, credito: 0};
  // Venda dividida não tem 1 forma de pagamento só — distribui o valor de
  // cada pessoa na sua própria forma (essencial pro "esperado em dinheiro"
  // da gaveta bater, já que só a fatia em dinheiro de uma conta dividida
  // conta pra isso, não o total da comanda).
  pedidos.forEach(function (p) {
    if (p.divisao) {
      p.divisao.forEach(function (d) { porPagamento[d.pagamento] = (porPagamento[d.pagamento] || 0) + d.valor; });
    } else {
      porPagamento[p.pagamento] = (porPagamento[p.pagamento] || 0) + p.total;
    }
  });
  var totalSangrias = caixa.sangrias.reduce(function (s, x) { return s + x.valor; }, 0);
  var valorEsperadoDinheiro = caixa.valorInicial + porPagamento.dinheiro - totalSangrias;
  return {
    pedidos: pedidos,
    porPagamento: porPagamento,
    totalVendas: pedidos.reduce(function (s, p) { return s + p.total; }, 0),
    totalSangrias: totalSangrias,
    valorEsperadoDinheiro: valorEsperadoDinheiro
  };
}
export function fecharCaixa(caixaId, valorContado) {
  var caixas = getCaixas();
  var caixa = caixas.find(function (c) { return c.id === caixaId; });
  var resumo = resumoCaixa(caixa);
  var atualizadas = caixas.map(function (c) {
    if (c.id !== caixaId) return c;
    return Object.assign({}, c, {
      fechamento: {
        em: Date.now(),
        valorContado: valorContado,
        valorEsperado: resumo.valorEsperadoDinheiro,
        diferenca: valorContado - resumo.valorEsperadoDinheiro
      }
    });
  });
  saveCaixas(atualizadas);
  return resumo;
}

/* ---- Clube de fidelidade + cashback (espelho de src/utils/fidelidade.js
   do app cliente — mesmas chaves de localStorage, mesma lógica de FIFO
   pra consumir pontos e de validade por lote). ---- */
export var NIVEIS_PADRAO_FID = [
  {id:"bronze", nome:"Bronze", minPontosVitalicios:0, multiplicador:1},
  {id:"prata", nome:"Prata", minPontosVitalicios:500, multiplicador:1.2},
  {id:"ouro", nome:"Ouro", minPontosVitalicios:1500, multiplicador:1.5}
];
export var CONFIG_PADRAO_FID = {
  pontosPorReal: 1,
  validadePontosDias: 90,
  cashbackPct: 5,
  niveis: NIVEIS_PADRAO_FID,
  recompensas: [
    {id:"rc-fritas", nome:"Batata Frita Média grátis", custoPontos:300},
    {id:"rc-refri", nome:"Refrigerante Lata grátis", custoPontos:150},
    {id:"rc-desc10", nome:"R$ 10 de desconto", custoPontos:500}
  ]
};
export function getConfigFidelidade() {
  var salva = lsGet("tnm_admin_fidelidade_config", {});
  return Object.assign({}, CONFIG_PADRAO_FID, salva, {
    niveis: (salva.niveis && salva.niveis.length) ? salva.niveis : NIVEIS_PADRAO_FID
  });
}
export function saveConfigFidelidade(config) { lsSet("tnm_admin_fidelidade_config", config); }
export function getContasFidelidade() { return lsGet("tnm_fidelidade", {}); }
export function contaFidVazia() { return {pontosLotes: [], pontosVitalicios: 0, cashback: 0, historico: []}; }
export function getContaFidelidade(email) { return getContasFidelidade()[email] || contaFidVazia(); }
export function saveContaFidelidade(email, conta) {
  var todas = getContasFidelidade();
  todas[email] = conta;
  lsSet("tnm_fidelidade", todas);
}
export function getNivelFid(pontosVitalicios, niveis) {
  var lista = (niveis && niveis.length) ? niveis : NIVEIS_PADRAO_FID;
  var ordenados = lista.slice().sort(function (a,b) { return a.minPontosVitalicios - b.minPontosVitalicios; });
  var atingidos = ordenados.filter(function (n) { return pontosVitalicios >= n.minPontosVitalicios; });
  return atingidos.length ? atingidos[atingidos.length-1] : ordenados[0];
}
export function saldoPontosFid(conta) {
  var agora = Date.now();
  return conta.pontosLotes.filter(function (l) { return l.validoAte >= agora; })
    .reduce(function (s,l) { return s + l.restante; }, 0);
}
export function consumirPontosFIFO(lotes, quantidade) {
  var agora = Date.now();
  var restante = quantidade;
  var copia = lotes.slice().sort(function (a,b) { return a.ganhoEm - b.ganhoEm; }).map(function (l) { return Object.assign({}, l); });
  copia.forEach(function (lote) {
    if (restante <= 0) return;
    if (lote.validoAte < agora || lote.restante <= 0) return;
    var usar = Math.min(lote.restante, restante);
    lote.restante -= usar;
    restante -= usar;
  });
  return copia;
}
// Ajuste manual da equipe (cortesia, correção etc.) — igual ao ganho/uso
// automático, só que com motivo registrado no extrato.
export function ajusteManualFidelidade(email, pontos, cashback, motivo) {
  var config = getConfigFidelidade();
  var conta = getContaFidelidade(email);
  var agora = Date.now();
  var nova = Object.assign({}, conta);
  if (pontos > 0) {
    nova.pontosLotes = conta.pontosLotes.concat([{
      qtd: pontos, restante: pontos, ganhoEm: agora,
      validoAte: agora + config.validadePontosDias * 86400000
    }]);
    nova.pontosVitalicios = conta.pontosVitalicios + pontos;
  } else if (pontos < 0) {
    nova.pontosLotes = consumirPontosFIFO(conta.pontosLotes, -pontos);
  } else {
    nova.pontosLotes = conta.pontosLotes;
  }
  nova.cashback = Math.round((conta.cashback + cashback) * 100) / 100;
  nova.historico = conta.historico.concat([{tipo:"ajuste-admin", pontos: pontos, cashback: cashback, motivo: motivo, em: agora}]);
  saveContaFidelidade(email, nova);
}
// Espelho de creditarCompra (utils/fidelidade.js do cliente) — usado pelo
// PDV quando o operador informa o e-mail do cliente na venda.
export function creditarCompraFid(email, totalPedido, pedidoId) {
  if (!email || !(totalPedido > 0)) return;
  var config = getConfigFidelidade();
  var conta = getContaFidelidade(email);
  var nivel = getNivelFid(conta.pontosVitalicios, config.niveis);
  var pontosGanhos = Math.round(totalPedido * config.pontosPorReal * nivel.multiplicador);
  var cashbackGanho = Math.round(totalPedido * (config.cashbackPct / 100) * 100) / 100;
  var agora = Date.now();
  var nova = Object.assign({}, conta);
  if (pontosGanhos > 0) {
    nova.pontosLotes = conta.pontosLotes.concat([{
      qtd: pontosGanhos, restante: pontosGanhos, ganhoEm: agora,
      validoAte: agora + config.validadePontosDias * 86400000
    }]);
  }
  nova.pontosVitalicios = conta.pontosVitalicios + pontosGanhos;
  nova.cashback = Math.round((conta.cashback + cashbackGanho) * 100) / 100;
  nova.historico = conta.historico.concat([{tipo:"compra", pontos: pontosGanhos, cashback: cashbackGanho, pedidoId: pedidoId, em: agora}]);
  saveContaFidelidade(email, nova);
}

/* ============ ESTADO DA UI (só a interação do painel, não os dados) ============ */
export var state = {
  activeSection: "dashboard",
  period: { month: 8, year: 2026 },
  dishFilter: "Todos",
  reviewFilter: 0,
  usuarioLogado: null,
  funcionarios: { editandoId: null },

  // Cache em memória dos pedidos e chamados de garçom (agora vêm do
  // back-end, server/) — populado no init() e mantido em dia por eventos
  // de socket (ver initSocket). getPedidosReais()/getChamadasGarcom() leem
  // daqui, não mais de localStorage.
  pedidosCache: [],
  chamadasCache: [],
  usuariosCache: [],

  // ERP — mesmo padrão de cache acima (populado no init(), mantido em dia
  // por socket, ver initSocket).
  insumosCache: [],
  movimentosCache: [],
  fornecedoresCache: [],
  comprasCache: [],
  contasPagarCache: [],
  contasReceberCache: [],
  insumos: { editandoId: null, ajustandoId: null },
  fornecedores: { editandoId: null },
  compras: { itensForm: [] },
  contasPagar: { editandoId: null },
  contasReceber: { editandoId: null },
  fichaTecnica: { pratoId: null, itensForm: [] },

  // PDV: só existe em memória — se recarregar a página no meio de uma
  // venda, a comanda atual se perde (caixa/pedidos já salvos continuam).
  pdv: {
    comanda: [],
    tipo: "balcao",
    mesa: "",
    pagamento: "pix",
    valorRecebido: "",
    cupomCodigo: "",
    clienteEmail: "",
    catFiltro: "Todos",
    busca: "",
    dividir: false,
    pessoas: 2,
    divisaoPagamentos: ["pix", "pix"],
    sangriaOpen: false,
    fecharCaixaOpen: false,
    reciboPedido: null
  },

  fidelidade: { ajusteEmail: null },
  pratos: { editandoId: null },
  categorias: { editandoId: null },
  adicionais: { editandoGrupoId: null },
  produtosDesempenho: { ordenarPor: "qtd" },

  tables: [
    {id:1, number:1, capacity:2, manualStatus:"livre"},
    {id:2, number:2, capacity:2, manualStatus:"livre"},
    {id:3, number:3, capacity:4, manualStatus:"livre"},
    {id:4, number:4, capacity:4, manualStatus:"livre"},
    {id:5, number:5, capacity:4, manualStatus:"livre"},
    {id:6, number:6, capacity:6, manualStatus:"livre"},
    {id:7, number:7, capacity:6, manualStatus:"livre"},
    {id:8, number:8, capacity:8, manualStatus:"livre"}
  ],

  employees: [
    {id:1, name:"Marina Cabral", role:"Gerente geral", salary:6200,
      payments:[{m:6,y:2026,amount:6200,status:"pago"},{m:7,y:2026,amount:6200,status:"pago"},{m:8,y:2026,amount:6200,status:"pendente"}]},
    {id:2, name:"Diego Fontenele", role:"Chef de cozinha", salary:5400,
      payments:[{m:6,y:2026,amount:5400,status:"pago"},{m:7,y:2026,amount:5600,status:"pago"},{m:8,y:2026,amount:5400,status:"pendente"}]},
    {id:3, name:"Priscila Andrade", role:"Sous chef", salary:3800,
      payments:[{m:6,y:2026,amount:3800,status:"pago"},{m:7,y:2026,amount:3800,status:"pago"},{m:8,y:2026,amount:3800,status:"pago"}]},
    {id:4, name:"Vitor Hugo Ramos", role:"Garçom", salary:2400,
      payments:[{m:6,y:2026,amount:2400,status:"pago"},{m:7,y:2026,amount:2650,status:"pago"},{m:8,y:2026,amount:2400,status:"pendente"}]},
    {id:5, name:"Aline Peixoto", role:"Garçonete", salary:2400,
      payments:[{m:6,y:2026,amount:2400,status:"pago"},{m:7,y:2026,amount:2400,status:"pago"},{m:8,y:2026,amount:2400,status:"pago"}]},
    {id:6, name:"Wesley Tavares", role:"Caixa", salary:2200,
      payments:[{m:6,y:2026,amount:2200,status:"pago"},{m:7,y:2026,amount:2200,status:"pago"},{m:8,y:2026,amount:2200,status:"pendente"}]}
  ]
};

/* ============ HELPERS ============ */
export function brl(n) { return "R$ " + n.toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
export function initials(name) { return name.split(" ").filter(Boolean).slice(0,2).map(function(w){return w[0];}).join("").toUpperCase(); }
export function dateBR(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
// `new Date("2026-09-05")` sozinho é interpretado como meia-noite UTC —
// em fuso negativo (ex.: Brasil) isso vira 04/09 21h local, um dia pra
// trás. Anexar "T00:00:00" força meia-noite no fuso local, corrigindo o
// vencimento de contas a pagar/receber e de compras.
export function dataInputParaTimestamp(v) { return new Date(v + "T00:00:00").getTime(); }
// Escapa também aspas: esc() é usado dentro de value="..." e data-*="..." (atributo).
var ESC_MAP = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
export function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; }); }

// Exporta um relatório simples em CSV (Excel/Sheets abrem direto).
// `linhas` é array de arrays já na ordem das colunas de `cabecalho`.
export function exportarCSV(nomeArquivo, cabecalho, linhas) {
  function campo(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  var csv = [cabecalho].concat(linhas).map(function (linha) {
    return linha.map(campo).join(";");
  }).join("\r\n");
  var blob = new Blob(["﻿" + csv], {type: "text/csv;charset=utf-8;"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function statusPill(status) {
  var map = {
    "em preparo": ["warn","Em preparo"], "pronto": ["good","Pronto"],
    "entregue": ["neutral","Entregue"], "cancelado": ["bad","Cancelado"],
    "livre": ["good","Livre"], "ocupada": ["warn","Ocupada"], "reservada": ["neutral","Reservada"],
    "pago": ["good","Pago"], "pendente": ["warn","Pendente"],
    "disponível": ["good","Disponível"], "esgotado": ["bad","Esgotado"],
    "pdv": ["neutral","PDV"], "cliente": ["good","Cliente (QR)"],
    "recebido": ["good","Recebido"], "vencido": ["bad","Vencido"]
  };
  var m = map[status] || ["neutral", status];
  return '<span class="pill ' + m[0] + '">' + esc(m[1]) + '</span>';
}

export function starRow(rating, size) {
  var out = "";
  for (var i = 1; i <= 5; i++) out += (i <= rating) ? "&#9733;" : '<span class="off">&#9733;</span>';
  return '<span class="stars" style="' + (size ? "font-size:" + size : "") + '">' + out + "</span>";
}

export function inPeriod(m, y) { return m === state.period.month && y === state.period.year; }

/* ============ NAV (metadados — a lógica de montar o menu mora em nav.js) ============ */
export var SECTIONS = [
  {key:"dashboard", label:"Visão Geral", sub:"Visão geral do restaurante", group:"Desempenho"},
  {key:"produtosDesempenho", label:"Produtos", sub:"Ranking completo de produtos vendidos no período", group:"Desempenho"},
  {key:"garcons", label:"Garçons", sub:"Atendimentos de mesa por funcionário", group:"Desempenho"},
  {key:"categorias", label:"Categorias", sub:"Categorias do cardápio", group:"Produtos"},
  {key:"pratos", label:"Pratos", sub:"Cardápio — adicionar, editar e remover itens", group:"Produtos"},
  {key:"adicionais", label:"Adicionais Globais", sub:"Grupos de adicionais reutilizáveis entre pratos", group:"Produtos"},
  {key:"insumos", label:"Insumos", sub:"Matéria-prima e estoque", group:"Produtos"},
  {key:"fichaTecnica", label:"Ficha Técnica", sub:"Consumo de insumos por prato", group:"Produtos"},
  {key:"fornecedores", label:"Fornecedores", sub:"Cadastro de fornecedores", group:"Compras"},
  {key:"compras", label:"Compras", sub:"Pedidos de compra e recebimento", group:"Compras"},
  {key:"pdv", label:"PDV", sub:"Ponto de venda — abrir caixa, vender e fechar o dia", group:"Operação"},
  {key:"cozinha", label:"Cozinha", sub:"Painel de preparo — avance o status dos pedidos", group:"Operação"},
  {key:"mesas", label:"Mesas", sub:"Status do salão em tempo real", group:"Operação"},
  {key:"delivery", label:"Delivery", sub:"Pedidos de entrega em andamento", group:"Operação"},
  {key:"pedidos", label:"Pedidos", sub:"Comandas ativas e histórico", group:"Vendas"},
  {key:"caixas", label:"Histórico de Caixas", sub:"Todos os caixas já abertos e fechados", group:"Vendas"},
  {key:"avaliacoes", label:"Avaliações", sub:"Feedback dos clientes", group:"Vendas"},
  {key:"contasPagar", label:"Contas a Pagar", sub:"Obrigações com fornecedores e outras despesas", group:"Financeiro"},
  {key:"contasReceber", label:"Contas a Receber", sub:"Recebíveis avulsos", group:"Financeiro"},
  {key:"relatorios", label:"Relatórios", sub:"Receita, CMV e margem do período", group:"Financeiro"},
  {key:"funcionarios", label:"Funcionários", sub:"Equipe com acesso ao painel e suas funções", group:"Gestão"},
  {key:"clientes", label:"Clientes", sub:"Base de clientes e consumo", group:"Gestão"},
  {key:"fidelidade", label:"Fidelidade", sub:"Clube de pontos, níveis e cashback", group:"Gestão"},
  {key:"financeiro", label:"Financeiro", sub:"Folha de pagamento da equipe", group:"Sistema"},
  {key:"configuracoes", label:"Configurações", sub:"Dados da loja, horário e taxa de entrega", group:"Sistema"}
];

/* ============ SOCKET.IO — tempo real (pedidos + chamado de garçom) ============
   Room "admin" — pedidos/chamados novos ou atualizados (KDS, cancelar,
   atender, avaliar) chegam aqui na hora, sem depender do poll de 3s (que
   continua existindo só como fallback, ver setInterval no init()). ---- */
export var socket = io({ path: "/socket.io" });

export function carregarCachesEmTempoReal() {
  return Promise.all([carregarPedidosCache(), carregarChamadasCache()]);
}
// Registrado 1x só (ver jaInicializado em init.js) — religar estes
// listeners a cada login duplicaria as reações a cada evento.
export function initSocket() {
  // O socket já pode estar conectado quando initSocket() roda (autoConnect
  // acontece no load do módulo, bem antes do login acontecer) — nesse caso
  // o evento "connect" já disparou e nunca mais dispara de novo até uma
  // reconexão, então "admin:entrar" tem que ser emitido aqui direto
  // também, não só dentro do handler de "connect" (que cobre reconexões
  // futuras).
  function entrarNaSalaAdmin() {
    socket.emit("admin:entrar");
    // Conectou (1ª vez ou reconectando) — refaz os 2 caches por inteiro,
    // cobre eventos perdidos enquanto o painel esteve desconectado.
    carregarCachesEmTempoReal().then(rerenderSecaoAtiva);
  }
  if (socket.connected) entrarNaSalaAdmin();
  socket.on("connect", entrarNaSalaAdmin);
  socket.on("pedido:novo", function (pedido) {
    state.pedidosCache = [pedido].concat(state.pedidosCache);
    rerenderSecaoAtiva();
  });
  socket.on("pedido:atualizado", function (patch) {
    patchPedidoCache(patch.id, patch);
    rerenderSecaoAtiva();
  });
  socket.on("garcom:nova", function (chamada) {
    state.chamadasCache = [chamada].concat(state.chamadasCache);
    rerenderSecaoAtiva();
  });
  socket.on("garcom:atendida", function (chamada) {
    state.chamadasCache = state.chamadasCache.map(function (c) { return c.id === chamada.id ? chamada : c; });
    rerenderSecaoAtiva();
  });
  socket.on("garcom:avaliada", function (chamada) {
    state.chamadasCache = state.chamadasCache.map(function (c) { return c.id === chamada.id ? chamada : c; });
    rerenderSecaoAtiva();
  });
  // ERP — mesmo padrão de patch de cache dos eventos acima.
  socket.on("estoque:baixo", function () { carregarInsumosCache().then(rerenderSecaoAtiva); });
  socket.on("estoque:atualizado", function (insumos) {
    insumos.forEach(function (novo) {
      state.insumosCache = state.insumosCache.map(function (i) { return i.id === novo.id ? novo : i; });
    });
    rerenderSecaoAtiva();
  });
  socket.on("compra:nova", function (compra) {
    state.comprasCache = [compra].concat(state.comprasCache);
    rerenderSecaoAtiva();
  });
  ["compra:recebida", "compra:cancelada"].forEach(function (evento) {
    socket.on(evento, function (compra) {
      state.comprasCache = state.comprasCache.map(function (c) { return c.id === compra.id ? compra : c; });
      rerenderSecaoAtiva();
    });
  });
  socket.on("conta-pagar:nova", function (conta) {
    state.contasPagarCache = [conta].concat(state.contasPagarCache);
    rerenderSecaoAtiva();
  });
  socket.on("conta-pagar:atualizada", function (conta) {
    state.contasPagarCache = state.contasPagarCache.map(function (c) { return c.id === conta.id ? conta : c; });
    rerenderSecaoAtiva();
  });
  socket.on("conta-receber:nova", function (conta) {
    state.contasReceberCache = [conta].concat(state.contasReceberCache);
    rerenderSecaoAtiva();
  });
  socket.on("conta-receber:atualizada", function (conta) {
    state.contasReceberCache = state.contasReceberCache.map(function (c) { return c.id === conta.id ? conta : c; });
    rerenderSecaoAtiva();
  });
}
