// vendas.js — grupo "Vendas" do menu: Pedidos, Histórico de Caixas e
// Avaliações.
import {
  state, esc, brl, statusPill, starRow, dateBR, MONTHS, exportarCSV,
  getReviews, getPedidosReais, inPeriod, toggleCancelPedido, PAGAMENTO_LABEL,
  getCaixas, resumoCaixa
} from "./core.js";
import { renderDashboard, renderProdutosDesempenho } from "./desempenho.js";
import { renderMesas, renderDelivery } from "./operacao.js";

/* ============ AVALIAÇÕES ============ */
export function renderAvaliacoes() {
  var reviews = getReviews();
  var avg = reviews.length ? (reviews.reduce(function (s,r) { return s+r.rating; }, 0) / reviews.length).toFixed(1) : "—";
  var filters = [0,5,4,3,2,1];
  var filtered = reviews.filter(function (r) { return state.reviewFilter === 0 || r.rating === state.reviewFilter; })
    .slice().sort(function(a,b){ return new Date(b.date) - new Date(a.date); });

  var html = ''
    + '<div class="card panel rating-summary" style="align-items:center;">'
    +   '<div><div class="rating-big num">' + avg + '</div>' + starRow(Math.round(reviews.length ? avg : 0)) + '</div>'
    +   '<div class="section-note" style="margin:0;">Baseado em ' + reviews.length + ' avaliações (mock do cardápio + avaliações reais do banco)</div>'
    + '</div>'
    + '<div class="chip-row" style="margin-bottom:16px;">'
    +   filters.map(function (f) {
          return '<button class="chip rev-chip' + (state.reviewFilter===f?' active':'') + '" data-r="' + f + '">' + (f===0?"Todas":f+" &#9733;") + '</button>';
        }).join("")
    + '</div>'
    + '<div class="review-list">'
    +   filtered.map(function (r) {
          return '<div class="card review-card">'
            + '<div class="review-head"><span class="who">' + esc(r.customer) + '</span>' + starRow(r.rating,"0.85rem") + '<span class="when">' + dateBR(r.date) + '</span></div>'
            + '<div class="review-dish">' + esc(r.dish) + '</div>'
            + '<div class="review-text">' + esc(r.text) + '</div>'
            + '</div>';
        }).join("")
    + '</div>'
    + (filtered.length === 0 ? '<div class="empty">Nenhuma avaliação com esse filtro.</div>' : '');

  document.getElementById("view-avaliacoes").innerHTML = html;
  document.querySelectorAll(".rev-chip").forEach(function (b) {
    b.addEventListener("click", function () { state.reviewFilter = parseInt(b.getAttribute("data-r"),10); renderAvaliacoes(); });
  });
}

/* ============ PEDIDOS ============ */
export function renderPedidos() {
  var list = getPedidosReais().filter(function (o) { return inPeriod(o.m, o.y); })
    .slice().sort(function(a,b){ return b.criadoEm - a.criadoEm; });

  var html = ''
    + '<div class="panel-head" style="margin-bottom:14px;"><div><h2 style="font-size:1rem;">Pedidos de ' + MONTHS[state.period.month-1] + '/' + state.period.year + '</h2>'
    + '<span class="meta">' + list.length + ' pedido(s) — em tempo real (app cliente + PDV); use o filtro de período no topo</span></div>'
    + '<button class="btn small" id="btnExportarPedidos">Exportar CSV</button></div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Ticket</th><th>Canal</th><th>Tipo / Mesa</th><th>Itens</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Data / hora</th><th></th></tr></thead><tbody>'
    +   (list.length ? list.map(function (o) {
          return '<tr><td class="num">#' + esc(o.id) + '</td>'
            + '<td>' + statusPill(o.origem === "pdv" ? "pdv" : "cliente") + '</td>'
            + '<td>' + esc(o.tipo === "mesa" ? "Mesa " + o.mesa : o.tipoLabel) + '</td>'
            + '<td>' + esc(o.itemsLabel) + '</td><td class="num">' + brl(o.total) + '</td>'
            + '<td>' + esc(PAGAMENTO_LABEL[o.pagamento] || o.pagamento || "—") + '</td>'
            + '<td>' + statusPill(o.status) + '</td>'
            + '<td class="num">' + String(o.d_).padStart(2,'0') + '/' + String(o.m).padStart(2,'0') + '/' + o.y + ' &middot; ' + o.time + '</td>'
            + '<td>' + (o.status !== "entregue" ? '<button class="btn small toggle-pedido" data-id="' + esc(o.id) + '">' + (o.status === "cancelado" ? "Reabrir" : "Cancelar") + '</button>' : '') + '</td></tr>';
        }).join("") : '<tr><td colspan="9"><div class="empty">Nenhum pedido neste período.</div></td></tr>')
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-pedidos").innerHTML = html;
  document.getElementById("btnExportarPedidos").addEventListener("click", function () {
    var cabecalho = ["Ticket","Canal","Tipo","Mesa","Itens","Total","Pagamento","Status","Data","Hora"];
    var linhas = list.map(function (o) {
      return [o.id, o.origem === "pdv" ? "PDV" : "Cliente", o.tipoLabel, o.mesa || "", o.itemsLabel,
        o.total.toFixed(2).replace(".", ","), PAGAMENTO_LABEL[o.pagamento] || o.pagamento || "",
        o.status, String(o.d_).padStart(2,'0') + "/" + String(o.m).padStart(2,'0') + "/" + o.y, o.time];
    });
    exportarCSV("pedidos-" + MONTHS[state.period.month-1] + "-" + state.period.year + ".csv", cabecalho, linhas);
  });
  document.querySelectorAll(".toggle-pedido").forEach(function (b) {
    b.addEventListener("click", function () {
      // Cancelar/reabrir um pedido muda o total vendido, o ranking de
      // produtos, a ocupação de mesas e a fila de entrega — todas essas
      // seções derivam de state.pedidosCache, então precisam re-renderizar
      // junto pra não ficar com número desatualizado até trocar de aba.
      toggleCancelPedido(b.getAttribute("data-id"));
      renderPedidos();
      renderDashboard();
      renderMesas();
      renderProdutosDesempenho();
      renderDelivery();
    });
  });
}

/* ============ HISTÓRICO DE CAIXAS ============ */
export function renderCaixas() {
  var caixas = getCaixas().slice().sort(function (a,b) { return b.abertoEm - a.abertoEm; });

  var html = '<div class="card table-wrap">'
    + '<table><thead><tr><th>Operador(a)</th><th>Abertura</th><th>Fechamento</th><th>Fundo inicial</th><th>Vendas</th><th>Sangrias</th><th>Diferença</th></tr></thead><tbody>'
    + (caixas.length ? caixas.map(function (c) {
        var resumo = resumoCaixa(c);
        var totalSangrias = c.sangrias.reduce(function (s,x) { return s + x.valor; }, 0);
        return '<tr><td>' + esc(c.operador) + '</td>'
          + '<td class="num">' + new Date(c.abertoEm).toLocaleString("pt-BR") + '</td>'
          + '<td>' + (c.fechamento ? '<span class="num">' + new Date(c.fechamento.em).toLocaleString("pt-BR") + '</span>' : '<span class="pill warn">Aberto</span>') + '</td>'
          + '<td class="num">' + brl(c.valorInicial) + '</td>'
          + '<td class="num">' + brl(resumo.totalVendas) + ' <span class="section-note" style="margin:0;">(' + resumo.pedidos.length + ')</span></td>'
          + '<td class="num">' + brl(totalSangrias) + '</td>'
          + '<td class="num" style="color:' + (!c.fechamento ? "var(--ink-muted)" : (c.fechamento.diferenca === 0 ? "var(--good)" : (c.fechamento.diferenca > 0 ? "var(--good)" : "var(--bad)"))) + '">'
          +   (c.fechamento ? brl(Math.abs(c.fechamento.diferenca)) + (c.fechamento.diferenca < 0 ? " (falta)" : c.fechamento.diferenca > 0 ? " (sobra)" : "") : "—")
          + '</td></tr>';
      }).join("") : '<tr><td colspan="7"><div class="empty">Nenhum caixa aberto ainda.</div></td></tr>')
    + '</tbody></table></div>';

  document.getElementById("view-caixas").innerHTML = html;
}
