// sistema.js — grupo "Sistema" do menu: Financeiro (folha de pagamento) e
// Configurações.
import { state, esc, brl, MONTHS, statusPill, initials, exportarCSV, getConfigLoja, lojaAberta, saveConfigLoja, CONFIG_LOJA_PADRAO } from "./core.js";
import { kpi } from "./desempenho.js";
import { renderPdv } from "./operacao.js";

/* ============ FINANCEIRO ============ */
// Folha de pagamento mockada, sem nenhum equivalente no app cliente (dado só
// de back-office) — `state.employees` é uma lista à parte, só em memória,
// sem relação com `tnm_admin_funcionarios` (login do painel, aba
// Funcionários) nem com nenhuma tabela do back-end.
export function renderFinanceiro() {
  var rows = state.employees.map(function (e) {
    var p = e.payments.filter(function (x) { return x.m === state.period.month && x.y === state.period.year; })[0];
    return {emp:e, payment:p};
  });
  var total = rows.reduce(function (s,r) { return s + (r.payment ? r.payment.amount : 0); }, 0);
  var pendCount = rows.filter(function (r) { return r.payment && r.payment.status === "pendente"; }).length;

  var html = ''
    + '<div class="grid kpis-3">'
    +   kpi("Folha do período", brl(total), MONTHS[state.period.month-1] + "/" + state.period.year)
    +   kpi("Funcionários ativos", state.employees.length, "equipe completa")
    +   kpi("Pagamentos pendentes", pendCount, pendCount>0 ? "aguardando repasse" : "tudo em dia")
    + '</div>'
    + '<div class="panel-head" style="margin-bottom:14px;"><span></span><button class="btn small" id="btnExportarFinanceiro">Exportar CSV</button></div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Funcionário</th><th>Cargo</th><th>Salário base</th><th>Pagamento do período</th><th>Status</th></tr></thead><tbody>'
    +   rows.map(function (r) {
          return '<tr><td><div class="name-cell"><span class="avatar-sm">' + initials(r.emp.name) + '</span>' + esc(r.emp.name) + '</div></td>'
            + '<td>' + esc(r.emp.role) + '</td><td class="num">' + brl(r.emp.salary) + '</td>'
            + '<td class="num">' + (r.payment ? brl(r.payment.amount) : '&mdash;') + '</td>'
            + '<td>' + (r.payment ? statusPill(r.payment.status) : '<span class="pill neutral">Sem registro</span>') + '</td></tr>';
        }).join("")
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-financeiro").innerHTML = html;
  document.getElementById("btnExportarFinanceiro").addEventListener("click", function () {
    var cabecalho = ["Funcionário","Cargo","Salário base","Pagamento do período","Status"];
    var linhas = rows.map(function (r) {
      return [r.emp.name, r.emp.role, r.emp.salary.toFixed(2).replace(".", ","),
        r.payment ? r.payment.amount.toFixed(2).replace(".", ",") : "", r.payment ? r.payment.status : "sem registro"];
    });
    exportarCSV("financeiro-" + MONTHS[state.period.month-1] + "-" + state.period.year + ".csv", cabecalho, linhas);
  });
}

/* ============ CONFIGURAÇÕES ============ */
export function renderConfiguracoes() {
  var config = getConfigLoja();
  var aberta = lojaAberta();

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Dados da loja</h2><span class="meta">horário e taxa de entrega usados no PDV</span></div>'
    +   '<div class="resumo-row"><span>Status agora</span>' + (aberta ? '<span class="pill good">Aberta</span>' : '<span class="pill bad">Fechada</span>') + '</div>'
    +   '<form id="configLojaForm" class="add-form" style="margin-top:14px;">'
    +     '<div class="full"><label for="cfgNome">Nome do restaurante</label><input id="cfgNome" value="' + esc(config.nome) + '" required></div>'
    +     '<div><label for="cfgAbertura">Abre às</label><input id="cfgAbertura" type="time" value="' + config.horaAbertura + '" required></div>'
    +     '<div><label for="cfgFechamento">Fecha às</label><input id="cfgFechamento" type="time" value="' + config.horaFechamento + '" required></div>'
    +     '<div><label for="cfgTaxa">Taxa de entrega (R$)</label><input id="cfgTaxa" type="number" min="0" step="0.5" value="' + config.taxaEntrega + '" required></div>'
    +     '<div><label for="cfgPreparo">Tempo médio de preparo (min)</label><input id="cfgPreparo" type="number" min="1" step="1" value="' + config.tempoPreparoMin + '" required></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Salvar configurações</button></div>'
    +   '</form>'
    +   '<div class="section-note" style="margin-top:10px;">A comparação de horário não trata virada de dia (ex.: abrir às 18h e fechar às 2h) — assume que a loja fecha ainda no mesmo dia, suficiente pro protótipo.</div>'
    + '</div>';

  document.getElementById("view-configuracoes").innerHTML = html;
  document.getElementById("configLojaForm").addEventListener("submit", function (e) {
    e.preventDefault();
    saveConfigLoja({
      nome: document.getElementById("cfgNome").value.trim() || CONFIG_LOJA_PADRAO.nome,
      horaAbertura: document.getElementById("cfgAbertura").value,
      horaFechamento: document.getElementById("cfgFechamento").value,
      taxaEntrega: parseFloat(document.getElementById("cfgTaxa").value || "0"),
      tempoPreparoMin: parseInt(document.getElementById("cfgPreparo").value || "25", 10)
    });
    renderConfiguracoes();
    // Horário e taxa de entrega são lidos de verdade pelo PDV (selo "Loja
    // aberta"/"Fechada" e soma na comanda de entrega) — re-renderiza pra
    // refletir na hora, sem precisar trocar de aba.
    renderPdv();
  });
}
