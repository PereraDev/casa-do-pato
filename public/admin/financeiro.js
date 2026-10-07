// financeiro.js — grupo "Financeiro" do menu: Contas a Pagar, Contas a
// Receber e Relatórios (CMV/margem do ERP).
import {
  state, esc, brl, statusPill, api, dataInputParaTimestamp, statusContaVisual, exportarCSV, MONTHS,
  getPedidosReais, inPeriod, insumoLabel
} from "./core.js";
import { kpi } from "./desempenho.js";

/* ============ CONTAS A PAGAR / RECEBER ============ */
export function renderContasPagar() {
  var contas = state.contasPagarCache;
  var totalPendente = contas.filter(function (c) { return c.status === "pendente"; }).reduce(function (s,c) { return s + c.valor; }, 0);

  var html = ''
    + '<div class="grid kpis-3">'
    +   kpi("Em aberto", brl(totalPendente), contas.filter(function (c) { return c.status === "pendente"; }).length + " conta(s)")
    +   kpi("Vencidas", contas.filter(function (c) { return statusContaVisual(c) === "vencido"; }).length, "vencimento passado e ainda pendente")
    +   kpi("Pagas", contas.filter(function (c) { return c.status === "pago"; }).length, "no total")
    + '</div>'
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Nova conta a pagar</h2><span class="meta">lançamento manual — compras já geram a conta automaticamente</span></div>'
    +   '<form id="cpagarForm" class="add-form">'
    +     '<div><label for="pgDescricao">Descrição</label><input id="pgDescricao" required placeholder="Ex.: Aluguel"></div>'
    +     '<div><label for="pgValor">Valor (R$)</label><input id="pgValor" type="number" min="0" step="0.01" required></div>'
    +     '<div><label for="pgVencimento">Vencimento</label><input id="pgVencimento" type="date" required></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Lançar</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>'
    +   (contas.length ? contas.map(function (c) {
          return '<tr><td>' + esc(c.descricao) + (c.compraId ? ' <span class="pill neutral">' + esc(c.compraId) + '</span>' : '') + '</td>'
            + '<td class="num">' + brl(c.valor) + '</td><td class="num">' + new Date(c.vencimento).toLocaleDateString("pt-BR") + '</td>'
            + '<td>' + statusPill(statusContaVisual(c)) + '</td>'
            + '<td style="text-align:right; white-space:nowrap;">'
            +   (c.status === "pendente" ? '<button class="btn small pagar-conta" data-id="' + c.id + '">Marcar como pago</button>' : '')
            + '</td></tr>';
        }).join("") : '<tr><td colspan="5"><div class="empty">Nenhuma conta a pagar lançada.</div></td></tr>')
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-contasPagar").innerHTML = html;

  document.getElementById("cpagarForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var descricao = document.getElementById("pgDescricao").value.trim();
    var valor = parseFloat(document.getElementById("pgValor").value);
    var vencimento = document.getElementById("pgVencimento").value;
    if (!descricao || !(valor > 0) || !vencimento) return;
    api("/api/financeiro/contas-pagar", { method: "POST", body: {
      descricao: descricao, valor: valor, vencimento: dataInputParaTimestamp(vencimento)
    }}).then(function () {
      // Idem "compra:nova" acima — o socket "conta-pagar:nova" já cuida
      // do cache, evita duplicar a linha.
      renderContasPagar();
    }).catch(function (err) { alert(err.message); });
  });
  document.querySelectorAll(".pagar-conta").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      api("/api/financeiro/contas-pagar/" + id + "/pagar", { method: "PATCH" }).then(function (conta) {
        state.contasPagarCache = state.contasPagarCache.map(function (c) { return c.id === conta.id ? conta : c; });
        renderContasPagar();
      }).catch(function () {});
    });
  });
}

export function renderContasReceber() {
  var contas = state.contasReceberCache;
  var totalPendente = contas.filter(function (c) { return c.status === "pendente"; }).reduce(function (s,c) { return s + c.valor; }, 0);

  var html = ''
    + '<div class="grid kpis-3">'
    +   kpi("Em aberto", brl(totalPendente), contas.filter(function (c) { return c.status === "pendente"; }).length + " conta(s)")
    +   kpi("Vencidas", contas.filter(function (c) { return statusContaVisual(c) === "vencido"; }).length, "vencimento passado e ainda pendente")
    +   kpi("Recebidas", contas.filter(function (c) { return c.status === "recebido"; }).length, "no total")
    + '</div>'
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Nova conta a receber</h2><span class="meta">recebível avulso — pedidos do cliente já têm seu próprio pagamento</span></div>'
    +   '<form id="crecerberForm" class="add-form">'
    +     '<div><label for="rcDescricao">Descrição</label><input id="rcDescricao" required placeholder="Ex.: Evento fechado"></div>'
    +     '<div><label for="rcCliente">Cliente (opcional)</label><input id="rcCliente" placeholder="opcional"></div>'
    +     '<div><label for="rcValor">Valor (R$)</label><input id="rcValor" type="number" min="0" step="0.01" required></div>'
    +     '<div><label for="rcVencimento">Vencimento</label><input id="rcVencimento" type="date" required></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Lançar</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Descrição</th><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>'
    +   (contas.length ? contas.map(function (c) {
          return '<tr><td>' + esc(c.descricao) + '</td><td>' + esc(c.clienteNome || "—") + '</td>'
            + '<td class="num">' + brl(c.valor) + '</td><td class="num">' + new Date(c.vencimento).toLocaleDateString("pt-BR") + '</td>'
            + '<td>' + statusPill(statusContaVisual(c)) + '</td>'
            + '<td style="text-align:right; white-space:nowrap;">'
            +   (c.status === "pendente" ? '<button class="btn small receber-conta" data-id="' + c.id + '">Marcar como recebido</button>' : '')
            + '</td></tr>';
        }).join("") : '<tr><td colspan="6"><div class="empty">Nenhuma conta a receber lançada.</div></td></tr>')
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-contasReceber").innerHTML = html;

  document.getElementById("crecerberForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var descricao = document.getElementById("rcDescricao").value.trim();
    var valor = parseFloat(document.getElementById("rcValor").value);
    var vencimento = document.getElementById("rcVencimento").value;
    if (!descricao || !(valor > 0) || !vencimento) return;
    api("/api/financeiro/contas-receber", { method: "POST", body: {
      descricao: descricao,
      clienteNome: document.getElementById("rcCliente").value.trim() || null,
      valor: valor, vencimento: dataInputParaTimestamp(vencimento)
    }}).then(function () {
      // Idem acima — o socket "conta-receber:nova" já cuida do cache.
      renderContasReceber();
    }).catch(function (err) { alert(err.message); });
  });
  document.querySelectorAll(".receber-conta").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      api("/api/financeiro/contas-receber/" + id + "/receber", { method: "PATCH" }).then(function (conta) {
        state.contasReceberCache = state.contasReceberCache.map(function (c) { return c.id === conta.id ? conta : c; });
        renderContasReceber();
      }).catch(function () {});
    });
  });
}

/* ============ RELATÓRIOS (ERP) ============ */
// Cruza pedidosCache (receita) com movimentosCache × custoUnitario do
// insumo (CMV estimado) e as duas contas — tudo calculado aqui, client-side,
// a partir dos caches que já existem; não há endpoint de agregação dedicado
// no servidor pra isso (mesmo espírito do Dashboard de desempenho.js).
export function renderRelatorios() {
  var pedidosPeriodo = getPedidosReais().filter(function (o) { return inPeriod(o.m, o.y) && o.status !== "cancelado"; });
  var receita = pedidosPeriodo.reduce(function (s, o) { return s + o.total; }, 0);

  var custoPorInsumo = {};
  state.insumosCache.forEach(function (i) { custoPorInsumo[i.id] = i.custoUnitario || 0; });
  // motivo:"venda:<idDoPedido>" é o formato gravado por
  // server/src/lib/estoque.js#baixarEstoquePorVenda — filtra só as saídas
  // de estoque que vieram de venda (ignora ajuste manual/compra recebida).
  var movimentosPeriodo = state.movimentosCache.filter(function (m) {
    var d = new Date(m.criadoEm);
    return m.tipo === "saida" && (m.motivo || "").indexOf("venda:") === 0 && inPeriod(d.getMonth() + 1, d.getFullYear());
  });
  var cmv = movimentosPeriodo.reduce(function (s, m) { return s + m.quantidade * (custoPorInsumo[m.insumoId] || 0); }, 0);
  var margem = receita - cmv;

  var consumoPorInsumo = {};
  movimentosPeriodo.forEach(function (m) {
    consumoPorInsumo[m.insumoId] = (consumoPorInsumo[m.insumoId] || 0) + m.quantidade * (custoPorInsumo[m.insumoId] || 0);
  });
  var topInsumos = Object.keys(consumoPorInsumo).map(function (id) { return {id: id, custo: consumoPorInsumo[id]}; })
    .sort(function (a,b) { return b.custo - a.custo; }).slice(0, 5);
  var maxCusto = topInsumos.length ? topInsumos[0].custo : 1;

  var contasPagarAbertas = state.contasPagarCache.filter(function (c) { return c.status === "pendente"; }).reduce(function (s,c) { return s + c.valor; }, 0);
  var contasReceberAbertas = state.contasReceberCache.filter(function (c) { return c.status === "pendente"; }).reduce(function (s,c) { return s + c.valor; }, 0);

  var html = ''
    + '<div class="grid kpis">'
    +   kpi("Receita do período", brl(receita), pedidosPeriodo.length + " pedidos válidos")
    +   kpi("CMV estimado", brl(cmv), "consumo de insumos com ficha técnica")
    +   kpi("Margem bruta", brl(margem), receita > 0 ? Math.round(margem/receita*100) + "% da receita" : "—")
    +   kpi("Contas em aberto", brl(contasPagarAbertas) + " / " + brl(contasReceberAbertas), "a pagar / a receber")
    + '</div>'
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Insumos mais consumidos</h2><span class="meta">por custo, no período</span></div>'
    +   (topInsumos.length ? '<div class="bar-list">' + topInsumos.map(function (t) {
          return '<div class="row"><span>' + esc(insumoLabel(t.id)) + '</span><span class="num">' + brl(t.custo) + '</span>'
            + '<div class="bar-track"><div class="bar-fill" style="width:' + (t.custo/maxCusto*100) + '%"></div></div></div>';
        }).join("") + '</div>' : '<div class="empty">Sem consumo de insumo com ficha técnica no período.</div>')
    +   '<div class="panel-head" style="margin-top:14px;"><span></span><button class="btn small" id="btnExportarRelatorio">Exportar CSV</button></div>'
    + '</div>';

  document.getElementById("view-relatorios").innerHTML = html;
  document.getElementById("btnExportarRelatorio").addEventListener("click", function () {
    var cabecalho = ["Indicador", "Valor"];
    var linhas = [
      ["Receita do período", receita.toFixed(2)],
      ["CMV estimado", cmv.toFixed(2)],
      ["Margem bruta", margem.toFixed(2)],
      ["Contas a pagar em aberto", contasPagarAbertas.toFixed(2)],
      ["Contas a receber em aberto", contasReceberAbertas.toFixed(2)]
    ];
    exportarCSV("relatorio-" + MONTHS[state.period.month-1] + "-" + state.period.year + ".csv", cabecalho, linhas);
  });
}
