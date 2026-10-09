// nav.js — shell, menu lateral (rail) e orquestração de re-render entre
// seções. É quem decide "o que renderizar quando": importa a função
// render* de TODOS os arquivos de área, porque renderAll()/goTo() (e, mais
// abaixo, rerenderSecaoAtiva()/rerenderRelogio()) precisam chamar qualquer
// seção a qualquer momento — natural pra um orquestrador, não é
// acoplamento acidental.
import { state, esc, ICONS, SECTIONS, secoesPermitidas, MONTHS } from "./core.js";
import { renderDashboard, renderProdutosDesempenho, renderGarcons } from "./desempenho.js";
import { renderPratos, renderCategorias, renderAdicionais, renderInsumos, renderFichaTecnica } from "./produtos.js";
import { renderFornecedores, renderCompras } from "./compras.js";
import { renderPdv, renderCozinha, renderMesas, renderDelivery } from "./operacao.js";
import { renderAvaliacoes, renderPedidos, renderCaixas } from "./vendas.js";
import { renderContasPagar, renderContasReceber, renderRelatorios } from "./financeiro.js";
import { renderClientes, renderFidelidade, renderFuncionarios } from "./gestao.js";
import { renderFinanceiro, renderConfiguracoes } from "./sistema.js";

// Grupos recolhidos ficam guardados por navegador (não por funcionário —
// é só uma preferência de tela, sem relação com secoesPermitidas). Junto
// com a busca em #railSearch, é o que evita ter que escanear os ~8
// grupos/25 seções toda vez que alguém só quer chegar rápido a "PDV" ou
// "Compras".
export function getRailColapsados() {
  try { return JSON.parse(localStorage.getItem("tnm_admin_rail_colapsado") || "[]"); } catch { return []; }
}
export function setRailColapsados(lista) {
  try { localStorage.setItem("tnm_admin_rail_colapsado", JSON.stringify(lista)); } catch {}
}
export function toggleRailGroup(nomeGrupo) {
  var lista = getRailColapsados();
  var i = lista.indexOf(nomeGrupo);
  var grupoEl = document.querySelector('.rail-group[data-group="' + CSS.escape(nomeGrupo) + '"]');
  if (i === -1) { lista.push(nomeGrupo); if (grupoEl) grupoEl.classList.add("collapsed"); }
  else { lista.splice(i, 1); if (grupoEl) grupoEl.classList.remove("collapsed"); }
  setRailColapsados(lista);
}

// Filtra os botões do trilho pelo texto de #railSearch. Enquanto há
// termo digitado, ignora grupos recolhidos (senão um resultado dentro de
// um grupo fechado simplesmente sumiria) — some com grupo inteiro só
// quando nenhum item dele bate com a busca.
export function aplicarFiltroRail() {
  var input = document.getElementById("railSearch");
  var termo = input ? input.value.trim().toLowerCase() : "";
  document.querySelectorAll(".rail-group").forEach(function (grupoEl) {
    var algumVisivel = false;
    grupoEl.querySelectorAll(".rail-btn").forEach(function (btn) {
      var bate = !termo || btn.getAttribute("data-label").indexOf(termo) !== -1;
      btn.style.display = bate ? "" : "none";
      if (bate) algumVisivel = true;
    });
    grupoEl.style.display = algumVisivel ? "" : "none";
    grupoEl.querySelector(".rail-group-items").style.display = (termo && algumVisivel) ? "flex" : "";
  });
}

// Monta o menu lateral inteiro a partir de SECTIONS, agrupado por
// `group` (na ordem em que aparecem no array) e filtrado pelas seções que
// o funcionário logado pode ver (secoesPermitidas) — chamado de novo a
// cada login, já que a função (e o acesso) pode ter mudado.
export function buildNav() {
  var nav = document.getElementById("railNav");
  var permitidas = secoesPermitidas(state.usuarioLogado || "admin");
  var visiveis = SECTIONS.filter(function (s) { return permitidas.indexOf(s.key) !== -1; });
  var grupos = [];
  visiveis.forEach(function (s) {
    var atual = grupos[grupos.length - 1];
    if (!atual || atual.nome !== s.group) { atual = {nome: s.group, itens: []}; grupos.push(atual); }
    atual.itens.push(s);
  });
  var colapsados = getRailColapsados();
  nav.innerHTML = grupos.map(function (g) {
    var collapsed = colapsados.indexOf(g.nome) !== -1;
    return '<div class="rail-group' + (collapsed ? ' collapsed' : '') + '" data-group="' + esc(g.nome) + '">'
      +   '<button type="button" class="rail-group-label" data-toggle-group="' + esc(g.nome) + '">'
      +     '<span>' + esc(g.nome) + '</span>'
      +     '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>'
      +   '</button>'
      +   '<div class="rail-group-items">'
      +     g.itens.map(function (s) {
              return '<button class="rail-btn" data-section="' + s.key + '" data-label="' + esc(s.label.toLowerCase()) + '">'
                + '<span class="ic">' + ICONS[s.key] + '</span>' + s.label + '</button>';
            }).join("")
      +   '</div>'
      + '</div>';
  }).join("");
  nav.querySelectorAll(".rail-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { goTo(btn.getAttribute("data-section")); });
  });
  nav.querySelectorAll("[data-toggle-group]").forEach(function (btn) {
    btn.addEventListener("click", function () { toggleRailGroup(btn.getAttribute("data-toggle-group")); });
  });
  aplicarFiltroRail();
}

export function goTo(key) {
  var permitidas = secoesPermitidas(state.usuarioLogado || "admin");
  if (permitidas.indexOf(key) === -1) key = permitidas[0];
  state.activeSection = key;
  document.querySelectorAll(".rail-btn").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-section") === key);
  });
  document.querySelectorAll("section.view").forEach(function (v) {
    v.classList.toggle("active", v.id === "view-" + key);
  });
  var meta = SECTIONS.filter(function (s) { return s.key === key; })[0];
  document.getElementById("viewTitle").textContent = meta.label;
  document.getElementById("viewSub").textContent = meta.sub;
  document.getElementById("periodStamp").style.display =
    (key === "dashboard" || key === "pedidos" || key === "financeiro" || key === "produtosDesempenho" || key === "relatorios") ? "flex" : "none";
  // Seções de ERP ficam de fora do poll de 3s (rerenderRelogio, ver
  // initSocket) pra não apagar formulário em preenchimento — então, ao
  // contrário de Dashboard/Mesas/etc., elas só se auto-corrigem sozinhas
  // se um evento de socket chegar enquanto já estão ativas. Re-renderizar
  // aqui, ao entrar na aba, garante que mostrem o cache mais atual (que
  // pode ter mudado enquanto o usuário estava em outra seção) sem
  // reintroduzir o problema do poll.
  var RENDER_AO_ENTRAR = {
    insumos: renderInsumos, fichaTecnica: renderFichaTecnica, fornecedores: renderFornecedores,
    compras: renderCompras, contasPagar: renderContasPagar, contasReceber: renderContasReceber,
    relatorios: renderRelatorios
  };
  if (RENDER_AO_ENTRAR[key]) RENDER_AO_ENTRAR[key]();
  closeRail();
}

export function openRail() {
  document.getElementById("rail").classList.add("open");
  document.getElementById("railOverlay").classList.add("open");
}
export function closeRail() {
  document.getElementById("rail").classList.remove("open");
  document.getElementById("railOverlay").classList.remove("open");
}

export function buildFilters() {
  var mSel = document.getElementById("filterMonth");
  mSel.innerHTML = MONTHS.map(function (m, i) { return '<option value="' + (i+1) + '">' + m + '</option>'; }).join("");
  mSel.value = state.period.month;
  var ySel = document.getElementById("filterYear");
  var anos = [];
  for (var a = 2025; a <= Math.max(2026, new Date().getFullYear()); a++) anos.push(String(a));
  ySel.innerHTML = anos.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join("");
  ySel.value = state.period.year;
  mSel.addEventListener("change", function () { state.period.month = parseInt(mSel.value,10); renderPeriodDependent(); });
  ySel.addEventListener("change", function () { state.period.year = parseInt(ySel.value,10); renderPeriodDependent(); });
}

/* ============ RENDER: SHELL ============ */
export function buildShell() {
  var content = document.getElementById("content");
  content.innerHTML = SECTIONS.map(function (s) {
    return '<section class="view" id="view-' + s.key + '"></section>';
  }).join("");
}

export function renderPeriodDependent() { renderDashboard(); renderPedidos(); renderFinanceiro(); renderProdutosDesempenho(); renderRelatorios(); }
export function renderAll() {
  renderDashboard(); renderPdv(); renderCozinha(); renderPratos(); renderAvaliacoes(); renderMesas(); renderPedidos(); renderClientes(); renderFidelidade(); renderFinanceiro(); renderFuncionarios();
  renderCategorias(); renderAdicionais(); renderDelivery(); renderCaixas(); renderProdutosDesempenho(); renderGarcons(); renderConfiguracoes();
  renderInsumos(); renderFichaTecnica(); renderFornecedores(); renderCompras(); renderContasPagar(); renderContasReceber(); renderRelatorios();
}

// Usada pelos handlers de socket (evento real chegou, precisa refletir na
// hora, não importa a seção). NÃO é a mesma função usada pelo poll de 3s
// (ver rerenderRelogio abaixo) — as seções de ERP só mudam por ação
// do usuário ou evento de socket (já tratados aqui), nunca sozinhas com o
// tempo, então re-renderizá-las no poll apagaria formulário em
// preenchimento (Nova compra, Ajustar insumo etc.) a cada 3s.
export function rerenderSecaoAtiva() {
  if (state.activeSection === "dashboard") renderDashboard();
  if (state.activeSection === "pedidos") renderPedidos();
  if (state.activeSection === "mesas") renderMesas();
  if (state.activeSection === "cozinha") renderCozinha();
  if (state.activeSection === "delivery") renderDelivery();
  if (state.activeSection === "garcons") renderGarcons();
  if (state.activeSection === "insumos") renderInsumos();
  if (state.activeSection === "compras") renderCompras();
  if (state.activeSection === "contasPagar") renderContasPagar();
  if (state.activeSection === "contasReceber") renderContasReceber();
}
// Poll de 3s (fallback pro relógio de status — ver statusPedidoReal/
// mesasComStatus): só as seções cujo conteúdo muda sozinho com o tempo.
export function rerenderRelogio() {
  if (state.activeSection === "dashboard") renderDashboard();
  if (state.activeSection === "pedidos") renderPedidos();
  if (state.activeSection === "mesas") renderMesas();
  if (state.activeSection === "cozinha") renderCozinha();
  if (state.activeSection === "delivery") renderDelivery();
  if (state.activeSection === "garcons") renderGarcons();
}
