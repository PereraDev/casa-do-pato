// desempenho.js — grupo "Desempenho" do menu: Visão Geral (dashboard),
// Produtos (ranking) e Garçons.
import { state, brl, MONTHS, esc, statusPill, initials, inPeriod, getPedidosReais, getReviews, chamadasPendentes, getChamadasGarcom, insumosBaixoEstoque, funcaoLabel } from "./core.js";
import { goTo } from "./nav.js";
import { mesasComStatus } from "./operacao.js";

/* ============ DASHBOARD ============ */
export function renderDashboard() {
  var allOrders = getPedidosReais();
  var periodOrders = allOrders.filter(function (o) { return inPeriod(o.m, o.y) && o.status !== "cancelado"; });
  var revenue = periodOrders.reduce(function (s, o) { return s + o.total; }, 0);
  var occupiedTables = mesasComStatus(allOrders);
  var occupied = occupiedTables.filter(function (t) { return t.status === "ocupada"; }).length;
  var reviews = getReviews();
  var avgRating = reviews.length ? (reviews.reduce(function (s, r) { return s + r.rating; }, 0) / reviews.length).toFixed(1) : "—";

  var monthsRevenue = [];
  for (var m = 1; m <= 12; m++) {
    var sum = allOrders.filter(function (o) { return o.m === m && o.y === state.period.year && o.status !== "cancelado"; })
      .reduce(function (s, o) { return s + o.total; }, 0);
    monthsRevenue.push(sum);
  }

  var dishCount = {};
  periodOrders.forEach(function (o) {
    (o.itens || []).forEach(function (it) {
      dishCount[it.nome] = (dishCount[it.nome] || 0) + it.qtd;
    });
  });
  var topDishes = Object.keys(dishCount).map(function (k) { return {name:k, qty:dishCount[k]}; })
    .sort(function (a,b) { return b.qty - a.qty; }).slice(0,5);
  var maxQty = topDishes.length ? topDishes[0].qty : 1;

  var recent = allOrders.slice().sort(function(a,b){
    return b.criadoEm - a.criadoEm;
  }).slice(0,5);
  var chamadas = chamadasPendentes();
  var baixoEstoque = insumosBaixoEstoque();

  var html = ''
    + (chamadas.length ? '<div class="card panel" style="border-color:var(--warn); margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">'
        + '<span>🔔 <b>' + chamadas.length + '</b> chamado(s) de garçom pendente(s)</span>'
        + '<button class="btn small" data-goto="mesas" id="btnVerChamadas">Ver na aba Mesas</button>'
        + '</div>' : '')
    + (baixoEstoque.length ? '<div class="card panel" style="border-color:var(--warn); margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">'
        + '<span>📦 <b>' + baixoEstoque.length + '</b> insumo(s) com estoque baixo</span>'
        + '<button class="btn small" id="btnVerInsumos">Ver na aba Insumos</button>'
        + '</div>' : '')
    + '<div class="grid kpis">'
    +   kpi("Faturamento no período", brl(revenue), periodOrders.length + " pedidos válidos")
    +   kpi("Pedidos no período", periodOrders.length, MONTHS[state.period.month-1] + "/" + state.period.year)
    +   kpi("Mesas ocupadas agora", occupied + " / " + occupiedTables.length, Math.round(occupied/occupiedTables.length*100) + "% de ocupação")
    +   kpi("Avaliação média", avgRating + " &#9733;", reviews.length + " avaliações no total")
    + '</div>'
    + '<div class="grid two-col">'
    +   '<div class="card panel">'
    +     '<div class="panel-head"><h2>Faturamento — ' + state.period.year + '</h2><span class="meta">por mês, exceto cancelados</span></div>'
    +     '<div class="chart-wrap"><canvas id="revenueChart"></canvas></div>'
    +   '</div>'
    +   '<div class="card panel">'
    +     '<div class="panel-head"><h2>Pratos mais vendidos</h2><span class="meta">no período</span></div>'
    +     (topDishes.length ? '<div class="bar-list">' + topDishes.map(function (d) {
            return '<div class="row"><span>' + esc(d.name) + '</span><span class="num">' + d.qty + '</span>'
              + '<div class="bar-track"><div class="bar-fill" style="width:' + (d.qty/maxQty*100) + '%"></div></div></div>';
          }).join("") + '</div>' : '<div class="empty">Sem vendas registradas neste período.</div>')
    +   '</div>'
    + '</div>'
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Últimos pedidos</h2><span class="meta">todas as mesas — em tempo real (app cliente + PDV)</span></div>'
    +   '<div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Tipo</th><th>Total</th><th>Status</th><th>Data</th></tr></thead><tbody>'
    +   (recent.length ? recent.map(function (o) {
          return '<tr><td class="num">#' + esc(o.id) + '</td><td>' + esc(o.tipo === "mesa" ? "Mesa " + o.mesa : o.tipoLabel) + '</td>'
            + '<td class="num">' + brl(o.total) + '</td><td>' + statusPill(o.status) + '</td>'
            + '<td class="num">' + String(o.d_).padStart(2,'0') + '/' + String(o.m).padStart(2,'0') + '/' + o.y + '</td></tr>';
        }).join("") : '<tr><td colspan="5"><div class="empty">Nenhum pedido feito no app cliente ainda.</div></td></tr>')
    +   '</tbody></table></div>'
    + '</div>';

  document.getElementById("view-dashboard").innerHTML = html;
  drawRevenueChart(monthsRevenue, state.period.month);
  var btnVerChamadas = document.getElementById("btnVerChamadas");
  if (btnVerChamadas) btnVerChamadas.addEventListener("click", function () { goTo("mesas"); });
  var btnVerInsumos = document.getElementById("btnVerInsumos");
  if (btnVerInsumos) btnVerInsumos.addEventListener("click", function () { goTo("insumos"); });
}

// Também usada por sistema.js#renderFinanceiro (folha de pagamento) — é o
// mesmo cartão de KPI genérico, sem sentido duplicar.
export function kpi(label, value, delta) {
  return '<div class="card kpi"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="delta">' + delta + '</div></div>';
}

// Gráfico de barras do faturamento por mês, desenhado à mão em <canvas>
// (sem lib de gráfico) — lê as cores atuais do tema via CSS custom
// properties, então já respeita alto contraste/claro-escuro sem lógica
// própria. Redesenhado a cada render do Dashboard (inclusive no resize,
// ver window.addEventListener("resize") em init.js).
function drawRevenueChart(values, highlightMonth) {
  var canvas = document.getElementById("revenueChart");
  if (!canvas) return;
  var cssW = canvas.clientWidth || 600, cssH = 190;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  var ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  var styles = getComputedStyle(document.documentElement);
  var border = styles.getPropertyValue("--border").trim();
  var accent = styles.getPropertyValue("--accent").trim();
  var muted = styles.getPropertyValue("--ink-muted").trim();

  ctx.clearRect(0,0,cssW,cssH);
  var padL = 8, padR = 8, padT = 10, padB = 22;
  var chartH = cssH - padT - padB;
  var max = Math.max.apply(null, values.concat([1]));
  var n = values.length;
  var gap = 8;
  var barW = (cssW - padL - padR - gap*(n-1)) / n;

  // grid lines
  ctx.strokeStyle = border; ctx.lineWidth = 1;
  for (var g = 0; g <= 3; g++) {
    var gy = padT + chartH * (g/3);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(cssW-padR, gy); ctx.stroke();
  }

  values.forEach(function (v, i) {
    var h = max > 0 ? (v/max) * chartH : 0;
    var x = padL + i*(barW+gap);
    var y = padT + chartH - h;
    var isHi = (i+1) === highlightMonth;
    ctx.fillStyle = isHi ? accent : border;
    var r = 3;
    ctx.beginPath();
    ctx.moveTo(x, y+h);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.lineTo(x+barW-r, y);
    ctx.quadraticCurveTo(x+barW, y, x+barW, y+r);
    ctx.lineTo(x+barW, y+h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = muted;
    ctx.font = "10px Karla, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(MONTHS[i], x+barW/2, cssH-6);
  });
}

/* ============ PRODUTOS (DESEMPENHO) ============ */
export function renderProdutosDesempenho() {
  var periodOrders = getPedidosReais().filter(function (o) { return inPeriod(o.m, o.y) && o.status !== "cancelado"; });
  var porItem = {};
  periodOrders.forEach(function (o) {
    (o.itens || []).forEach(function (it) {
      if (!porItem[it.nome]) porItem[it.nome] = {nome: it.nome, qtd: 0, receita: 0};
      porItem[it.nome].qtd += it.qtd;
      porItem[it.nome].receita += it.subtotal || 0;
    });
  });
  var ordenarPor = state.produtosDesempenho.ordenarPor;
  var lista = Object.keys(porItem).map(function (k) { return porItem[k]; })
    .sort(function (a,b) { return b[ordenarPor] - a[ordenarPor]; });
  var maxVal = lista.length ? lista[0][ordenarPor] : 1;

  var html = ''
    + '<div class="chip-row" style="margin-bottom:14px;">'
    +   '<button class="chip prod-ord-chip' + (ordenarPor==="qtd"?" active":"") + '" data-ord="qtd">Mais vendidos</button>'
    +   '<button class="chip prod-ord-chip' + (ordenarPor==="receita"?" active":"") + '" data-ord="receita">Maior receita</button>'
    + '</div>'
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Ranking de produtos — ' + MONTHS[state.period.month-1] + '/' + state.period.year + '</h2><span class="meta">' + lista.length + ' produto(s) diferentes vendidos</span></div>'
    +   (lista.length ? '<div class="bar-list">' + lista.map(function (d, i) {
          return '<div class="row"><span>' + (i+1) + '. ' + esc(d.nome) + '</span><span class="num">' + (ordenarPor === "qtd" ? d.qtd + "x" : brl(d.receita)) + '</span>'
            + '<div class="bar-track"><div class="bar-fill" style="width:' + (d[ordenarPor]/maxVal*100) + '%"></div></div></div>';
        }).join("") + '</div>' : '<div class="empty">Sem vendas registradas neste período.</div>')
    +   '</div>'
    + '<div class="card table-wrap" style="margin-top:16px;">'
    +   '<table><thead><tr><th>#</th><th>Produto</th><th>Qtd. vendida</th><th>Receita</th><th>Ticket médio</th></tr></thead><tbody>'
    +   (lista.length ? lista.map(function (d, i) {
          return '<tr><td class="num">' + (i+1) + '</td><td>' + esc(d.nome) + '</td><td class="num">' + d.qtd + '</td>'
            + '<td class="num">' + brl(d.receita) + '</td><td class="num">' + brl(d.receita / d.qtd) + '</td></tr>';
        }).join("") : '<tr><td colspan="5"><div class="empty">Sem dados.</div></td></tr>')
    +   '</tbody></table></div>';

  document.getElementById("view-produtosDesempenho").innerHTML = html;
  document.querySelectorAll(".prod-ord-chip").forEach(function (b) {
    b.addEventListener("click", function () { state.produtosDesempenho.ordenarPor = b.getAttribute("data-ord"); renderProdutosDesempenho(); });
  });
}

/* ============ GARÇONS (DESEMPENHO) ============ */
export function renderGarcons() {
  var chamadas = getChamadasGarcom().filter(function (c) { return c.atendidoEm && c.atendidoPor; });
  var porPessoa = {};
  chamadas.forEach(function (c) {
    var chave = c.atendidoPor.id || c.atendidoPor.nome;
    if (!porPessoa[chave]) porPessoa[chave] = {nome: c.atendidoPor.nome, funcao: c.atendidoPor.funcao, atendimentos: 0, somaTempo: 0, ultimoEm: 0, somaNotas: 0, qtdNotas: 0};
    porPessoa[chave].atendimentos += 1;
    porPessoa[chave].somaTempo += (c.atendidoEm - c.criadoEm);
    porPessoa[chave].ultimoEm = Math.max(porPessoa[chave].ultimoEm, c.atendidoEm);
    if (typeof c.notaCliente === "number") {
      porPessoa[chave].somaNotas += c.notaCliente;
      porPessoa[chave].qtdNotas += 1;
    }
  });
  var lista = Object.keys(porPessoa).map(function (k) { return porPessoa[k]; })
    .sort(function (a,b) { return b.atendimentos - a.atendimentos; });
  var pendentes = chamadasPendentes().length;
  var totalNotas = lista.reduce(function (s, p) { return s + p.qtdNotas; }, 0);
  var mediaGeral = totalNotas ? (lista.reduce(function (s, p) { return s + p.somaNotas; }, 0) / totalNotas).toFixed(1) : "—";

  // Placar: ranking por nota média do cliente (não por volume de
  // atendimento) — exige pelo menos 2 avaliações pra entrar no pódio, pra
  // não deixar 1 nota isolada decidir o 1º lugar. Empate de nota desempata
  // por quem atendeu mais chamados. Gamifica a EQUIPE pela qualidade do
  // atendimento, o oposto da lógica de todo app de fidelidade do cliente.
  var MEDALHAS = ["&#129351;", "&#129352;", "&#129353;"];
  var ranking = lista.filter(function (p) { return p.qtdNotas >= 2; })
    .map(function (p) { return Object.assign({}, p, { media: p.somaNotas / p.qtdNotas }); })
    .sort(function (a, b) { return b.media - a.media || b.atendimentos - a.atendimentos; })
    .slice(0, 3);
  var medalhaPorNome = {};
  ranking.forEach(function (p, i) { medalhaPorNome[p.nome] = MEDALHAS[i]; });

  var placarHtml = ranking.length
    ? '<div class="placar-row">' + ranking.map(function (p, i) {
        return '<div class="placar-card pos-' + (i + 1) + '">'
          +   '<span class="placar-medalha">' + MEDALHAS[i] + '</span>'
          +   '<span class="placar-nome">' + esc(p.nome) + '</span>'
          +   '<span class="placar-nota">' + p.media.toFixed(1) + ' &#9733;</span>'
          +   '<span class="placar-sub">' + p.qtdNotas + ' avaliação(ões) · ' + p.atendimentos + ' atendimento(s)</span>'
          + '</div>';
      }).join("") + '</div>'
    : '<div class="card panel"><div class="empty">Placar aparece assim que algum funcionário tiver pelo menos 2 chamados avaliados pelo cliente.</div></div>';

  var html = ''
    + '<div class="grid kpis" style="margin-bottom:16px;">'
    +   kpi("Chamados atendidos", chamadas.length, "no total")
    +   kpi("Chamados pendentes agora", pendentes, pendentes ? "aguardando atendimento" : "tudo em dia")
    +   kpi("Funcionários com atendimentos", lista.length, "que já atenderam ao menos 1 chamado")
    +   kpi("Nota média do cliente", mediaGeral + (totalNotas ? " &#9733;" : ""), totalNotas + " avaliação(ões) recebida(s)")
    + '</div>'
    + placarHtml
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Funcionário</th><th>Função</th><th>Atendimentos</th><th>Tempo médio de resposta</th><th>Nota do cliente</th><th>Último atendimento</th></tr></thead><tbody>'
    +   (lista.length ? lista.map(function (p) {
          var mediaSeg = Math.round(p.somaTempo / p.atendimentos / 1000);
          var mediaNota = p.qtdNotas ? (p.somaNotas / p.qtdNotas).toFixed(1) : null;
          return '<tr><td><div class="name-cell"><span class="avatar-sm">' + initials(p.nome) + '</span>' + (medalhaPorNome[p.nome] ? '<span class="medalha-inline">' + medalhaPorNome[p.nome] + '</span>' : '') + esc(p.nome) + '</div></td>'
            + '<td>' + esc(funcaoLabel(p.funcao)) + '</td>'
            + '<td class="num">' + p.atendimentos + '</td>'
            + '<td class="num">' + mediaSeg + 's</td>'
            + '<td class="num">' + (mediaNota ? mediaNota + ' &#9733; (' + p.qtdNotas + ')' : '—') + '</td>'
            + '<td class="num">' + new Date(p.ultimoEm).toLocaleString("pt-BR") + '</td></tr>';
        }).join("") : '<tr><td colspan="6"><div class="empty">Nenhum chamado atendido ainda (chamados de antes desta atualização não têm o funcionário registrado).</div></td></tr>')
    +   '</tbody></table></div>';

  document.getElementById("view-garcons").innerHTML = html;
}
