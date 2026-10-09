// operacao.js — grupo "Operação" do menu: PDV, Cozinha, Mesas e Delivery.
// Juntar essas 4 seções no mesmo arquivo elimina de graça a circularidade
// Cozinha↔Delivery (documentada no CLAUDE.md) — viram só chamadas dentro
// do mesmo arquivo, sem import nenhum entre elas.
import {
  state, esc, brl, statusPill, api,
  getCategorias, getDishes,
  getPedidosReais, avancarStatusPedido,
  chamadasPendentes, atenderChamada, MOTIVO_GARCOM,
  getCaixaAberto, abrirCaixa, registrarSangria, registrarVendaNoCaixa, resumoCaixa, fecharCaixa,
  getConfigLoja, lojaAberta, creditarCompraFid,
  COUPONS, TIPO_PEDIDO_LABEL, PAGAMENTO_LABEL, DIVISAO_PAGAMENTOS
} from "./core.js";
import { renderDashboard, renderProdutosDesempenho, renderGarcons } from "./desempenho.js";
import { renderPedidos, renderCaixas } from "./vendas.js";

/* ============ PDV ============ */
// Disponível na grade do PDV: não marcado indisponível, e (se tiver
// controle de estoque) ainda com saldo > 0 — mesma regra que esconde o
// prato do cliente (ver data.js#aplicarCatalogoAdmin), reaproveitada aqui
// só pra decidir o selo "Disponível"/"Esgotado" no card.
export function pdvDisponivel(d) { return d.available !== false && (d.estoque === undefined || d.estoque > 0); }

export function pdvSubtotal() {
  var dishes = getDishes();
  return state.pdv.comanda.reduce(function (s, c) {
    var d = dishes.filter(function (x) { return x.id === c.itemId; })[0];
    return s + (d ? d.price * c.qtd : 0);
  }, 0);
}
export function pdvCupomValido() {
  var cod = (state.pdv.cupomCodigo || "").trim().toUpperCase();
  return cod && COUPONS[cod] ? COUPONS[cod] : null;
}
export function pdvDesconto() {
  var cupom = pdvCupomValido();
  if (!cupom) return 0;
  var sub = pdvSubtotal();
  return cupom.tipo === "pct" ? sub * (cupom.valor / 100) : Math.min(cupom.valor, sub);
}
// Taxa de entrega configurada em Configurações (tnm_admin_config_loja) —
// só entra no total quando o tipo do pedido é "entrega" (config aplicada
// igual pro cliente balcão/mesa, que não pagam taxa nenhuma).
export function pdvTaxaEntrega() { return state.pdv.tipo === "entrega" ? getConfigLoja().taxaEntrega : 0; }
export function pdvTotal() { return Math.max(0, pdvSubtotal() - pdvDesconto()) + pdvTaxaEntrega(); }

export function pdvAdicionar(itemId) {
  var existente = state.pdv.comanda.filter(function (c) { return c.itemId === itemId; })[0];
  if (existente) existente.qtd += 1;
  else state.pdv.comanda.push({itemId: itemId, qtd: 1});
  renderPdv();
}
export function pdvAlterarQtd(itemId, delta) {
  state.pdv.comanda = state.pdv.comanda
    .map(function (c) { return c.itemId === itemId ? Object.assign({}, c, {qtd: c.qtd + delta}) : c; })
    .filter(function (c) { return c.qtd > 0; });
  renderPdv();
}

// Divide `total` em `pessoas` partes iguais (arredondadas ao centavo) — a
// última pessoa leva o resto da divisão, pra soma bater exatamente com o
// total (em vez de perder/sobrar centavos por arredondamento).
export function pdvValoresDivisao(total, pessoas) {
  var base = Math.floor((total / pessoas) * 100) / 100;
  var valores = [];
  var soma = 0;
  for (var i = 0; i < pessoas - 1; i++) {
    valores.push(base);
    soma += base;
  }
  valores.push(Math.round((total - soma) * 100) / 100);
  return valores;
}
export function pdvDivisaoHtml(total) {
  var valores = pdvValoresDivisao(total, state.pdv.pessoas);
  return '<div class="pdv-divisao">'
    +   '<div class="pdv-divisao-cabecalho">'
    +     '<span>Dividir entre</span>'
    +     '<div class="qtd-ctrl">'
    +       '<button type="button" class="pdv-divpessoas" data-delta="-1" aria-label="Diminuir número de pessoas">−</button>'
    +       '<span>' + state.pdv.pessoas + '</span>'
    +       '<button type="button" class="pdv-divpessoas" data-delta="1" aria-label="Aumentar número de pessoas">+</button>'
    +     '</div>'
    +   '</div>'
    +   valores.map(function (valor, i) {
          return '<div class="pdv-divisao-pessoa">'
            +   '<span class="pdv-divisao-pessoa-nome">Pessoa ' + (i + 1) + ' · <b class="num">' + brl(valor) + '</b></span>'
            +   '<div class="pdv-toggle-row">'
            +     DIVISAO_PAGAMENTOS.map(function (p) {
                    var ativo = (state.pdv.divisaoPagamentos[i] || "pix") === p;
                    return '<button type="button" class="pdv-divpagto-btn' + (ativo ? ' active' : '') + '" data-idx="' + i + '" data-pagto="' + p + '">' + PAGAMENTO_LABEL[p] + '</button>';
                  }).join("")
            +   '</div>'
            + '</div>';
        }).join("")
    + '</div>';
}
export function pdvAjustarPessoas(delta) {
  var novo = Math.min(10, Math.max(2, state.pdv.pessoas + delta));
  state.pdv.pessoas = novo;
  var pagamentos = state.pdv.divisaoPagamentos.slice(0, novo);
  while (pagamentos.length < novo) pagamentos.push("pix");
  state.pdv.divisaoPagamentos = pagamentos;
  renderPdv();
}

// Fecha a venda: valida caixa/comanda/mesa/troco, grava o pedido no
// back-end (origem "pdv"), registra no caixa aberto, baixa estoque e
// credita fidelidade se um e-mail foi informado — depois limpa a comanda e
// prepara o recibo (ver imprimirRecibo) pra impressão.
export function pdvFinalizarVenda() {
  var caixa = getCaixaAberto();
  if (!caixa) return;
  if (!state.pdv.comanda.length) { alert("Adicione ao menos um item à comanda."); return; }
  if (state.pdv.tipo === "mesa" && !state.pdv.mesa.trim()) { alert("Informe o número da mesa."); return; }
  var dividir = state.pdv.dividir;
  var total = pdvTotal();
  var valorRecebido = parseFloat(state.pdv.valorRecebido || "0");
  if (!dividir && state.pdv.pagamento === "dinheiro" && (isNaN(valorRecebido) || valorRecebido < total)) {
    alert("Valor recebido em dinheiro é menor que o total da venda.");
    return;
  }
  var dishes = getDishes();
  var itens = state.pdv.comanda.map(function (c) {
    var d = dishes.filter(function (x) { return x.id === c.itemId; })[0];
    return {itemId: c.itemId, nome: d.name, qtd: c.qtd, subtotal: d.price * c.qtd};
  });
  var cupom = pdvCupomValido();
  var clienteEmail = state.pdv.clienteEmail.trim() || null;
  // Conta dividida não tem 1 forma de pagamento só — cada pessoa paga sua
  // fatia (rateio igual, resto pra última pessoa) com a forma que
  // escolheu; ver pdvValoresDivisao/resumoCaixa.
  var divisao = dividir
    ? pdvValoresDivisao(total, state.pdv.pessoas).map(function (valor, i) {
        return {pessoa: i + 1, valor: valor, pagamento: state.pdv.divisaoPagamentos[i] || "pix"};
      })
    : null;
  // id/criadoEm agora são atribuídos pelo servidor (mesma fonte que os
  // pedidos do cliente via QR — elimina a colisão de "PD-" + 4 dígitos
  // aleatórios, agora que os ids são globais, não por navegador).
  var payload = {
    itens: itens,
    total: total,
    cupom: cupom ? state.pdv.cupomCodigo.trim().toUpperCase() : null,
    clienteEmail: clienteEmail,
    tipo: state.pdv.tipo,
    mesa: state.pdv.mesa,
    endereco: "",
    taxaEntrega: pdvTaxaEntrega(),
    pagamento: dividir ? "dividido" : state.pdv.pagamento,
    divisao: divisao,
    observacoes: "",
    caixaId: caixa.id
  };
  var btn = document.getElementById("btnFinalizarVenda");
  if (btn) btn.disabled = true;
  api("/api/pedidos/pdv", { method: "POST", body: payload }).then(function (pedido) {
    registrarVendaNoCaixa(caixa.id, pedido.id);
    if (clienteEmail) creditarCompraFid(clienteEmail, total, pedido.id);

    state.pdv.comanda = [];
    state.pdv.mesa = "";
    state.pdv.valorRecebido = "";
    state.pdv.cupomCodigo = "";
    state.pdv.clienteEmail = "";
    state.pdv.dividir = false;
    state.pdv.pessoas = 2;
    state.pdv.divisaoPagamentos = ["pix", "pix"];
    state.pdv.reciboPedido = Object.assign({}, pedido, {valorRecebido: valorRecebido, troco: !dividir && pedido.pagamento === "dinheiro" ? Math.max(0, valorRecebido - total) : 0});
    renderPdv();
    renderDashboard();
    renderPedidos();
    renderMesas();
    renderProdutosDesempenho();
    renderCaixas();
    if (pedido.tipo === "entrega") renderDelivery();
  }).catch(function (err) {
    alert((err && err.message) || "Não foi possível registrar a venda, tente novamente.");
    if (btn) btn.disabled = false;
  });
}

// Monta o HTML do recibo dentro de #reciboImprimir (elemento com CSS
// @media print dedicado) e abre o diálogo de impressão do navegador —
// explicitamente não-fiscal (ver aviso no próprio recibo), sem
// certificado digital/integração Sefaz.
export function imprimirRecibo(pedido) {
  var el = document.getElementById("reciboImprimir");
  var dataStr = new Date(pedido.criadoEm).toLocaleString("pt-BR");
  el.innerHTML = ''
    + '<h2>🍽️ Casa do Pato</h2>'
    + '<div class="linha"><span>Pedido</span><span>#' + esc(pedido.id) + '</span></div>'
    + '<div class="linha"><span>Data</span><span>' + esc(dataStr) + '</span></div>'
    + '<div class="linha"><span>Tipo</span><span>' + esc(pedido.tipo === "mesa" ? "Mesa " + pedido.mesa : TIPO_PEDIDO_LABEL[pedido.tipo]) + '</span></div>'
    + '<hr>'
    + pedido.itens.map(function (it) {
        return '<div class="linha"><span>' + it.qtd + 'x ' + esc(it.nome) + '</span><span>' + brl(it.subtotal) + '</span></div>';
      }).join("")
    + '<hr>'
    + (pedido.cupom ? '<div class="linha"><span>Cupom ' + esc(pedido.cupom) + '</span><span>aplicado</span></div>' : '')
    + (pedido.taxaEntrega ? '<div class="linha"><span>Taxa de entrega</span><span>' + brl(pedido.taxaEntrega) + '</span></div>' : '')
    + '<div class="linha"><b>Total</b><b>' + brl(pedido.total) + '</b></div>'
    + '<div class="linha"><span>Pagamento</span><span>' + esc(PAGAMENTO_LABEL[pedido.pagamento] || pedido.pagamento) + '</span></div>'
    + (pedido.divisao
        ? pedido.divisao.map(function (d) {
            return '<div class="linha"><span>Pessoa ' + d.pessoa + ' (' + esc(PAGAMENTO_LABEL[d.pagamento] || d.pagamento) + ')</span><span>' + brl(d.valor) + '</span></div>';
          }).join("")
        : (pedido.pagamento === "dinheiro" ? '<div class="linha"><span>Recebido</span><span>' + brl(pedido.valorRecebido) + '</span></div><div class="linha"><span>Troco</span><span>' + brl(pedido.troco) + '</span></div>' : ''))
    + '<div class="aviso-fiscal">Recibo sem valor fiscal — protótipo acadêmico (TCC). Não substitui nota fiscal.</div>';
  window.print();
}

export function renderPdv() {
  var caixa = getCaixaAberto();
  var configLoja = getConfigLoja();
  var html = '<div class="section-note" style="margin-bottom:12px;">'
    + (lojaAberta() ? '<span class="pill good">Loja aberta</span>' : '<span class="pill bad">Loja fechada</span>')
    + ' — ' + esc(configLoja.nome) + ' funciona das ' + esc(configLoja.horaAbertura) + ' às ' + esc(configLoja.horaFechamento)
    + '</div>';

  if (!caixa) {
    html += '<div class="card panel caixa-fechado">'
      + '<span class="flame-lg">💰</span>'
      + '<h2>Nenhum caixa aberto</h2>'
      + '<p class="section-note" style="margin-top:6px;">Abra o caixa pra começar a vender pelo PDV.</p>'
      + '<form id="abrirCaixaForm" style="text-align:left; margin-top:14px;">'
      +   '<div class="pdv-field"><label for="caixaOperador">Operador(a)</label><input id="caixaOperador" placeholder="Seu nome" required></div>'
      +   '<div class="pdv-field"><label for="caixaValorInicial">Fundo de troco inicial (R$)</label><input id="caixaValorInicial" type="number" min="0" step="0.5" placeholder="0,00" required></div>'
      +   '<button type="submit" class="btn primary" style="width:100%;">Abrir caixa</button>'
      + '</form>'
      + '</div>';
    if (state.pdv.ultimoFechamento) {
      var uf = state.pdv.ultimoFechamento;
      html += '<div class="card panel" style="max-width:420px; margin:16px auto 0;">'
        + '<div class="panel-head"><h2 style="font-size:0.95rem;">Último fechamento de caixa</h2></div>'
        + '<div class="resumo-row"><span>Total vendido</span><span class="num">' + brl(uf.resumo.totalVendas) + '</span></div>'
        + '<div class="resumo-row"><span>Esperado em dinheiro</span><span class="num">' + brl(uf.resumo.valorEsperadoDinheiro) + '</span></div>'
        + '<div class="resumo-row"><span>Contado</span><span class="num">' + brl(uf.valorContado) + '</span></div>'
        + '<div class="resumo-row"><span>' + (uf.diferenca === 0 ? "Confere" : (uf.diferenca > 0 ? "Sobra" : "Falta")) + '</span><span class="num" style="color:' + (uf.diferenca === 0 ? "var(--good)" : (uf.diferenca > 0 ? "var(--good)" : "var(--bad)")) + '">' + brl(Math.abs(uf.diferenca)) + '</span></div>'
        + '</div>';
    }
    document.getElementById("view-pdv").innerHTML = html;
    document.getElementById("abrirCaixaForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var operador = document.getElementById("caixaOperador").value.trim();
      var valorInicial = parseFloat(document.getElementById("caixaValorInicial").value || "0");
      if (!operador) return;
      abrirCaixa(operador, valorInicial);
      state.pdv.ultimoFechamento = null;
      renderPdv();
      renderCaixas();
    });
    return;
  }

  // Caixa aberto — venda concluída aguardando ação (recibo) ou tela de venda
  html += '<div class="card caixa-bar">'
    + '<div class="who"><b>Caixa aberto</b> — ' + esc(caixa.operador) + '<small>desde ' + new Date(caixa.abertoEm).toLocaleTimeString("pt-BR").slice(0,5) + ' · fundo ' + brl(caixa.valorInicial) + '</small></div>'
    + '<div style="display:flex; gap:8px;">'
    +   '<button class="btn small" id="btnSangria">Sangria</button>'
    +   '<button class="btn small" id="btnFecharCaixa">Fechar caixa</button>'
    + '</div>'
    + '</div>';

  if (state.pdv.reciboPedido) {
    var p = state.pdv.reciboPedido;
    html += '<div class="card panel" style="max-width:420px;">'
      + '<div class="panel-head"><h2>Venda #' + esc(p.id) + ' concluída</h2></div>'
      + '<div class="resumo-row"><span>Total</span><span class="num">' + brl(p.total) + '</span></div>'
      + (p.divisao
          ? p.divisao.map(function (d) {
              return '<div class="resumo-row"><span>Pessoa ' + d.pessoa + ' · ' + esc(PAGAMENTO_LABEL[d.pagamento] || d.pagamento) + '</span><span class="num">' + brl(d.valor) + '</span></div>';
            }).join("")
          : (p.pagamento === "dinheiro" ? '<div class="resumo-row"><span>Troco</span><span class="num">' + brl(p.troco) + '</span></div>' : ''))
      + '<div style="display:flex; gap:8px; margin-top:14px;">'
      +   '<button class="btn primary" id="btnImprimirRecibo">Imprimir recibo</button>'
      +   '<button class="btn" id="btnNovaVenda">Nova venda</button>'
      + '</div>'
      + '</div>';
    document.getElementById("view-pdv").innerHTML = html;
    document.getElementById("btnImprimirRecibo").addEventListener("click", function () { imprimirRecibo(p); });
    document.getElementById("btnNovaVenda").addEventListener("click", function () { state.pdv.reciboPedido = null; renderPdv(); });
    wireCaixaBarButtons(caixa);
    return;
  }

  var cats = [{id:"Todos", label:"Todos"}].concat(getCategorias());
  var dishes = getDishes().filter(function (d) {
    var passaCat = state.pdv.catFiltro === "Todos" || d.cat === state.pdv.catFiltro;
    var passaBusca = !state.pdv.busca || d.name.toLowerCase().indexOf(state.pdv.busca.toLowerCase()) !== -1;
    return passaCat && passaBusca;
  });
  var cupomValido = pdvCupomValido();
  var total = pdvTotal();
  var valorRecebidoNum = parseFloat(state.pdv.valorRecebido || "0");
  var troco = state.pdv.pagamento === "dinheiro" && valorRecebidoNum > total ? valorRecebidoNum - total : 0;

  html += '<div class="pdv-grid">'
    + '<div>'
    +   '<input id="pdvBusca" placeholder="🔍 Buscar prato..." value="' + esc(state.pdv.busca) + '" style="width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--ink); margin-bottom:12px;">'
    +   '<div class="chip-row" style="margin-bottom:14px;">' + cats.map(function (c) {
          return '<button class="chip pdv-cat-chip' + (state.pdv.catFiltro===c.id?' active':'') + '" data-cat="' + c.id + '">' + c.label + '</button>';
        }).join("") + '</div>'
    +   '<div class="pdv-produtos">' + dishes.map(function (d) {
          var disp = pdvDisponivel(d);
          return '<button class="pdv-produto" data-id="' + d.id + '" ' + (disp ? '' : 'disabled') + '>'
            + '<span class="nome">' + esc(d.name) + '</span>'
            + '<span class="preco">' + brl(d.price) + '</span>'
            + (!disp ? '<span class="estoque-tag">Esgotado</span>' : (typeof d.estoque === "number" ? '<span class="estoque-tag">' + d.estoque + ' em estoque</span>' : ''))
            + '</button>';
        }).join("") + '</div>'
    +   (dishes.length === 0 ? '<div class="empty">Nenhum prato encontrado.</div>' : '')
    + '</div>'
    + '<div class="card panel pdv-comanda">'
    +   '<div class="panel-head"><h2 style="font-size:0.95rem;">Comanda atual</h2></div>'
    +   (state.pdv.comanda.length ? state.pdv.comanda.map(function (c) {
          var d = dishes.concat(getDishes()).filter(function (x) { return x.id === c.itemId; })[0] || getDishes().filter(function (x) { return x.id === c.itemId; })[0];
          return '<div class="pdv-comanda-item">'
            + '<span class="nome">' + esc(d ? d.name : c.itemId) + '</span>'
            + '<div class="qtd-ctrl">'
            +   '<button data-id="' + c.itemId + '" data-delta="-1" class="pdv-qtd">−</button>'
            +   '<span class="num">' + c.qtd + '</span>'
            +   '<button data-id="' + c.itemId + '" data-delta="1" class="pdv-qtd">+</button>'
            + '</div>'
            + '<span class="num">' + brl((d ? d.price : 0) * c.qtd) + '</span>'
            + '</div>';
        }).join("") : '<div class="empty">Toque num prato pra adicionar.</div>')
    +   '<div class="pdv-toggle-row" style="margin-top:14px;">'
    +     ['balcao','mesa','entrega'].map(function (t) {
            return '<button class="pdv-tipo-btn' + (state.pdv.tipo===t?' active':'') + '" data-tipo="' + t + '">' + TIPO_PEDIDO_LABEL[t] + '</button>';
          }).join("")
    +   '</div>'
    +   (state.pdv.tipo === "mesa" ? '<div class="pdv-field"><label for="pdvMesa">Número da mesa</label><input id="pdvMesa" value="' + esc(state.pdv.mesa) + '"></div>' : '')
    +   '<label class="pdv-dividir-toggle"><input type="checkbox" id="pdvDividirCheck"' + (state.pdv.dividir ? ' checked' : '') + '> Dividir a conta entre várias pessoas</label>'
    +   (!state.pdv.dividir ? ''
    +     '<div class="pdv-toggle-row">'
    +       ['pix','cartao','dinheiro'].map(function (p) {
              return '<button class="pdv-pagto-btn' + (state.pdv.pagamento===p?' active':'') + '" data-pagto="' + p + '">' + PAGAMENTO_LABEL[p] + '</button>';
            }).join("")
    +     '</div>'
    +     (state.pdv.pagamento === "dinheiro" ? ''
    +       '<div class="pdv-field"><label for="pdvValorRecebido">Valor recebido (R$)</label><input id="pdvValorRecebido" type="text" inputmode="decimal" placeholder="0,00" value="' + esc(state.pdv.valorRecebido) + '"></div>'
    +       (valorRecebidoNum > 0 ? '<div class="resumo-row"><span>Troco</span><span class="num">' + brl(troco) + '</span></div>' : '')
    : '')
    : pdvDivisaoHtml(total))
    +   '<div class="pdv-field"><label for="pdvClienteEmail">E-mail do cliente (opcional, credita pontos/cashback)</label><input id="pdvClienteEmail" type="email" value="' + esc(state.pdv.clienteEmail) + '" placeholder="cliente@email.com"></div>'
    +   '<div class="pdv-field"><label for="pdvCupom">Cupom (opcional)</label><input id="pdvCupom" value="' + esc(state.pdv.cupomCodigo) + '" placeholder="Ex.: TCC10"></div>'
    +   (state.pdv.cupomCodigo && !cupomValido ? '<div class="section-note" style="color:var(--bad); margin:0 0 8px;">Cupom inválido</div>' : '')
    +   (cupomValido ? '<div class="resumo-row"><span>Desconto (' + esc(cupomValido.label) + ')</span><span class="num">-' + brl(pdvDesconto()) + '</span></div>' : '')
    +   (state.pdv.tipo === "entrega" && pdvTaxaEntrega() > 0 ? '<div class="resumo-row"><span>Taxa de entrega</span><span class="num">' + brl(pdvTaxaEntrega()) + '</span></div>' : '')
    +   '<div class="pdv-total-row"><span>Total</span><span class="num">' + brl(total) + '</span></div>'
    +   '<button class="btn primary" id="btnFinalizarVenda" style="width:100%;">Finalizar venda</button>'
    + '</div>'
    + '</div>';

  document.getElementById("view-pdv").innerHTML = html;
  wireCaixaBarButtons(caixa);

  document.querySelectorAll(".pdv-cat-chip").forEach(function (b) {
    b.addEventListener("click", function () { state.pdv.catFiltro = b.getAttribute("data-cat"); renderPdv(); });
  });
  document.querySelectorAll(".pdv-produto:not([disabled])").forEach(function (b) {
    b.addEventListener("click", function () { pdvAdicionar(b.getAttribute("data-id")); });
  });
  document.querySelectorAll(".pdv-qtd").forEach(function (b) {
    b.addEventListener("click", function () { pdvAlterarQtd(b.getAttribute("data-id"), parseInt(b.getAttribute("data-delta"),10)); });
  });
  document.querySelectorAll(".pdv-tipo-btn").forEach(function (b) {
    b.addEventListener("click", function () { state.pdv.tipo = b.getAttribute("data-tipo"); renderPdv(); });
  });
  document.querySelectorAll(".pdv-pagto-btn").forEach(function (b) {
    b.addEventListener("click", function () { state.pdv.pagamento = b.getAttribute("data-pagto"); renderPdv(); });
  });
  var dividirEl = document.getElementById("pdvDividirCheck");
  if (dividirEl) dividirEl.addEventListener("change", function () { state.pdv.dividir = dividirEl.checked; renderPdv(); });
  document.querySelectorAll(".pdv-divpessoas").forEach(function (b) {
    b.addEventListener("click", function () { pdvAjustarPessoas(parseInt(b.getAttribute("data-delta"), 10)); });
  });
  document.querySelectorAll(".pdv-divpagto-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var idx = parseInt(b.getAttribute("data-idx"), 10);
      var pagamentos = state.pdv.divisaoPagamentos.slice();
      pagamentos[idx] = b.getAttribute("data-pagto");
      state.pdv.divisaoPagamentos = pagamentos;
      renderPdv();
    });
  });
  document.getElementById("btnFinalizarVenda").addEventListener("click", pdvFinalizarVenda);

  var buscaEl = document.getElementById("pdvBusca");
  if (buscaEl) {
    buscaEl.focus();
    buscaEl.setSelectionRange(buscaEl.value.length, buscaEl.value.length);
    buscaEl.addEventListener("input", function () { state.pdv.busca = buscaEl.value; renderPdv(); });
  }
  var mesaEl = document.getElementById("pdvMesa");
  if (mesaEl) mesaEl.addEventListener("input", function () { state.pdv.mesa = mesaEl.value; });
  var emailEl = document.getElementById("pdvClienteEmail");
  if (emailEl) emailEl.addEventListener("input", function () { state.pdv.clienteEmail = emailEl.value; });
  var valorEl = document.getElementById("pdvValorRecebido");
  if (valorEl) {
    // O campo é re-renderizado (innerHTML) a cada tecla pro troco atualizar
    // ao vivo, o que recria o <input> e derruba o cursor pro início — sem
    // isso, cada dígito novo entrava ANTES dos anteriores (valor "de trás
    // pra frente"). type="number" não suporta setSelectionRange, por isso
    // o campo usa type="text" + inputmode="decimal" (mesmo padrão do
    // campo de busca do PDV, que já fazia isso certo).
    valorEl.focus();
    valorEl.setSelectionRange(valorEl.value.length, valorEl.value.length);
    valorEl.addEventListener("input", function () { state.pdv.valorRecebido = valorEl.value; renderPdv(); });
  }
  var cupomEl = document.getElementById("pdvCupom");
  if (cupomEl) {
    cupomEl.addEventListener("input", function () { state.pdv.cupomCodigo = cupomEl.value; });
    cupomEl.addEventListener("blur", function () { renderPdv(); });
  }
}

export function wireCaixaBarButtons(caixa) {
  document.getElementById("btnSangria").addEventListener("click", function () { state.pdv.sangriaOpen = true; renderModais(caixa); });
  document.getElementById("btnFecharCaixa").addEventListener("click", function () { state.pdv.fecharCaixaOpen = true; renderModais(caixa); });
}

export function renderModais(caixa) {
  var overlay = document.getElementById("pdvModalOverlay");
  if (overlay) overlay.remove();
  if (!state.pdv.sangriaOpen && !state.pdv.fecharCaixaOpen) return;

  var div = document.createElement("div");
  div.id = "pdvModalOverlay";
  div.className = "modal-overlay";

  if (state.pdv.sangriaOpen) {
    div.innerHTML = '<div class="card modal-card">'
      + '<h3>Sangria (retirada de caixa)</h3>'
      + '<form id="sangriaForm">'
      +   '<div class="pdv-field"><label for="sangriaValor">Valor (R$)</label><input id="sangriaValor" type="number" min="0.01" step="0.5" required></div>'
      +   '<div class="pdv-field"><label for="sangriaMotivo">Motivo</label><input id="sangriaMotivo" placeholder="Ex.: depósito no cofre" required></div>'
      +   '<div style="display:flex; gap:8px;"><button type="submit" class="btn primary" style="flex:1;">Confirmar</button><button type="button" class="btn" id="sangriaCancelar">Cancelar</button></div>'
      + '</form>'
      + '</div>';
  } else {
    var resumo = resumoCaixa(caixa);
    div.innerHTML = '<div class="card modal-card">'
      + '<h3>Fechar caixa</h3>'
      + '<div class="resumo-row"><span>Fundo inicial</span><span class="num">' + brl(caixa.valorInicial) + '</span></div>'
      + '<div class="resumo-row"><span>Vendas em Pix</span><span class="num">' + brl(resumo.porPagamento.pix) + '</span></div>'
      + '<div class="resumo-row"><span>Vendas em cartão</span><span class="num">' + brl(resumo.porPagamento.cartao) + '</span></div>'
      + (resumo.porPagamento.debito ? '<div class="resumo-row"><span>Vendas em débito</span><span class="num">' + brl(resumo.porPagamento.debito) + '</span></div>' : '')
      + (resumo.porPagamento.credito ? '<div class="resumo-row"><span>Vendas em crédito</span><span class="num">' + brl(resumo.porPagamento.credito) + '</span></div>' : '')
      + '<div class="resumo-row"><span>Vendas em dinheiro</span><span class="num">' + brl(resumo.porPagamento.dinheiro) + '</span></div>'
      + '<div class="resumo-row"><span>Sangrias</span><span class="num">-' + brl(resumo.totalSangrias) + '</span></div>'
      + '<div class="resumo-row"><b>Esperado em dinheiro na gaveta</b><b class="num">' + brl(resumo.valorEsperadoDinheiro) + '</b></div>'
      + '<form id="fecharCaixaForm" style="margin-top:14px;">'
      +   '<div class="pdv-field"><label for="valorContado">Valor contado na gaveta (R$)</label><input id="valorContado" type="number" min="0" step="0.5" required></div>'
      +   '<div style="display:flex; gap:8px;"><button type="submit" class="btn primary" style="flex:1;">Confirmar fechamento</button><button type="button" class="btn" id="fecharCancelar">Cancelar</button></div>'
      + '</form>'
      + '</div>';
  }
  document.body.appendChild(div);

  if (state.pdv.sangriaOpen) {
    document.getElementById("sangriaCancelar").addEventListener("click", function () { state.pdv.sangriaOpen = false; renderModais(caixa); });
    document.getElementById("sangriaForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var valor = parseFloat(document.getElementById("sangriaValor").value || "0");
      var motivo = document.getElementById("sangriaMotivo").value.trim();
      if (!valor || !motivo) return;
      registrarSangria(caixa.id, valor, motivo);
      state.pdv.sangriaOpen = false;
      renderModais(caixa);
      renderPdv();
      renderCaixas();
    });
  } else {
    document.getElementById("fecharCancelar").addEventListener("click", function () { state.pdv.fecharCaixaOpen = false; renderModais(caixa); });
    document.getElementById("fecharCaixaForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var valorContado = parseFloat(document.getElementById("valorContado").value || "0");
      var resumo = fecharCaixa(caixa.id, valorContado);
      state.pdv.ultimoFechamento = {resumo: resumo, valorContado: valorContado, diferenca: valorContado - resumo.valorEsperadoDinheiro};
      state.pdv.fecharCaixaOpen = false;
      renderModais(caixa);
      renderPdv();
      renderDashboard();
      renderCaixas();
    });
  }
}

/* ============ COZINHA (KDS) ============
   Painel de preparo: mostra todos os pedidos ainda não entregues/
   cancelados (cliente + PDV) em 3 colunas por status, com um botão pra
   avançar pro próximo estágio. Ao ser tocado aqui pela 1ª vez, o pedido
   ganha `statusManual` e passa a ignorar o relógio pra sempre (ver
   avancarStatusPedido/statusPedidoReal). Pedidos nunca tocados continuam
   avançando sozinhos pelo tempo, como sempre foi. */
var KDS_PROXIMO = {recebido:"preparo", preparo:"pronto", pronto:"entregue"};
var KDS_ACAO_LABEL = {recebido:"Iniciar preparo", preparo:"Marcar pronto", pronto:"Marcar entregue"};

export function renderCozinha() {
  var pedidos = getPedidosReais()
    .filter(function (o) { return o.status !== "entregue" && o.status !== "cancelado"; })
    .sort(function (a,b) { return a.criadoEm - b.criadoEm; });
  var colunas = [
    {status:"recebido", titulo:"Recebido"},
    {status:"preparo", titulo:"Em preparo"},
    {status:"pronto", titulo:"Pronto"}
  ];

  var html = ''
    + '<div class="section-note">Pedidos do cliente (QR Code) e do PDV, todos juntos. Avançar aqui assume o controle manual do status desse pedido — ele para de andar sozinho pelo relógio.</div>'
    + '<div class="grid" style="grid-template-columns: repeat(3, minmax(0,1fr)); align-items:start;">'
    +   colunas.map(function (col) {
          var itens = pedidos.filter(function (p) { return p.status === col.status; });
          return '<div>'
            + '<h3 style="font-size:0.9rem; margin-bottom:10px;">' + col.titulo + ' (' + itens.length + ')</h3>'
            + '<div style="display:flex; flex-direction:column; gap:10px;">'
            +   (itens.length ? itens.map(function (p) {
                  return '<div class="card panel" style="padding:14px 16px;">'
                    + '<div class="resumo-row" style="border:none; padding:0 0 6px;"><b class="num">#' + esc(p.id) + '</b>' + statusPill(p.origem === "pdv" ? "pdv" : "cliente") + '</div>'
                    + '<div class="section-note" style="margin:0 0 8px;">' + esc(p.tipo === "mesa" ? "Mesa " + p.mesa : p.tipoLabel) + '</div>'
                    + '<div style="font-size:0.82rem; margin-bottom:10px;">' + esc(p.itemsLabel) + '</div>'
                    + '<button class="btn small primary avancar-status" data-id="' + esc(p.id) + '" data-proximo="' + KDS_PROXIMO[col.status] + '" style="width:100%;">' + KDS_ACAO_LABEL[col.status] + '</button>'
                    + '</div>';
                }).join("") : '<div class="empty">Nada aqui.</div>')
            + '</div>'
            + '</div>';
        }).join("")
    + '</div>';

  document.getElementById("view-cozinha").innerHTML = html;
  document.querySelectorAll(".avancar-status").forEach(function (b) {
    b.addEventListener("click", function () {
      avancarStatusPedido(b.getAttribute("data-id"), b.getAttribute("data-proximo"));
      renderCozinha();
      renderDashboard();
      renderPedidos();
      renderMesas();
      renderDelivery();
    });
  });
}

/* ============ MESAS ============
   Ocupação é derivada dos pedidos reais (state.pedidosCache, vindo do
   back-end) com tipo:"mesa" ainda não entregues/cancelados; mesas sem
   pedido ativo podem ser alternadas manualmente (livre/reservada) só para
   fins de demonstração. */
var STATUS_DOT = {livre:"var(--good)", ocupada:"var(--warn)", reservada:"var(--neutral)"};

export function mesasComStatus(allOrders) {
  allOrders = allOrders || getPedidosReais();
  var ativosPorMesa = {};
  allOrders.forEach(function (o) {
    if (o.tipo === "mesa" && o.status !== "entregue" && o.status !== "cancelado") {
      ativosPorMesa[String(o.mesa)] = o.id;
    }
  });
  return state.tables.map(function (t) {
    var pedidoAtivo = ativosPorMesa[String(t.number)];
    return Object.assign({}, t, {
      status: pedidoAtivo ? "ocupada" : t.manualStatus,
      order: pedidoAtivo,
      travada: !!pedidoAtivo
    });
  });
}

export function renderMesas() {
  var tables = mesasComStatus();
  var counts = {livre:0, ocupada:0, reservada:0};
  tables.forEach(function (t) { counts[t.status]++; });
  var chamadas = chamadasPendentes().slice().sort(function (a,b) { return a.criadoEm - b.criadoEm; });

  var html = ''
    + (chamadas.length ? '<div class="card panel" style="border-color:var(--warn); margin-bottom:16px;">'
        + '<div class="panel-head"><h2 style="font-size:0.95rem;">🔔 Chamados de garçom</h2></div>'
        + chamadas.map(function (c) {
            return '<div class="resumo-row"><span>Mesa ' + esc(c.mesa) + ' · ' + esc(MOTIVO_GARCOM[c.motivo] || "Só chamando") + ' — ' + new Date(c.criadoEm).toLocaleTimeString("pt-BR").slice(0,5) + '</span>'
              + '<button class="btn small atender-chamada" data-id="' + esc(c.id) + '">Atender</button></div>';
          }).join("")
        + '</div>' : '')
    + '<div class="legend">'
    +   '<span><i style="background:var(--good)"></i>Livre (' + counts.livre + ')</span>'
    +   '<span><i style="background:var(--warn)"></i>Ocupada (' + counts.ocupada + ')</span>'
    +   '<span><i style="background:var(--neutral)"></i>Reservada (' + counts.reservada + ')</span>'
    + '</div>'
    + '<div class="section-note">Ocupação real vem de pedidos "na mesa" do app cliente. Mesas sem pedido ativo podem ser marcadas como reservadas manualmente.</div>'
    + '<div class="grid table-grid">'
    +   tables.map(function (t) {
          return '<button class="table-tile mesa-tile" data-id="' + t.id + '" ' + (t.travada ? 'disabled' : '') + ' style="border-left:3px solid ' + STATUS_DOT[t.status] + ';' + (t.travada ? 'opacity:.85;cursor:default;' : '') + '">'
            + '<div class="tnum">Mesa ' + t.number + '</div>'
            + '<div class="tcap">' + t.capacity + ' lugares</div>'
            + statusPill(t.status)
            + (t.order ? '<div class="torder">#' + esc(t.order) + '</div>' : '')
            + '</button>';
        }).join("")
    + '</div>';

  document.getElementById("view-mesas").innerHTML = html;
  document.querySelectorAll(".atender-chamada").forEach(function (b) {
    b.addEventListener("click", function () {
      atenderChamada(b.getAttribute("data-id"));
      renderMesas();
      renderDashboard();
      renderGarcons();
    });
  });
  document.querySelectorAll(".mesa-tile:not([disabled])").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = parseInt(b.getAttribute("data-id"),10);
      state.tables.forEach(function (t) {
        if (t.id === id) t.manualStatus = t.manualStatus === "livre" ? "reservada" : "livre";
      });
      renderMesas();
      renderDashboard();
    });
  });
}

/* ============ DELIVERY ============ */
export function renderDelivery() {
  var pedidos = getPedidosReais().filter(function (o) { return o.tipo === "entrega" && o.status !== "cancelado"; });
  var emAndamento = pedidos.filter(function (o) { return o.status !== "entregue"; }).sort(function (a,b) { return a.criadoEm - b.criadoEm; });
  var entregues = pedidos.filter(function (o) { return o.status === "entregue"; }).sort(function (a,b) { return b.criadoEm - a.criadoEm; }).slice(0,10);
  var colunas = [
    {status:"recebido", titulo:"Recebido"},
    {status:"preparo", titulo:"Em preparo"},
    {status:"pronto", titulo:"Pronto pra sair"}
  ];

  var html = ''
    + '<div class="section-note">Só pedidos tipo "Entrega" (cliente QR ou PDV). Avançar aqui assume o controle manual do status desse pedido, igual à Cozinha.</div>'
    + '<div class="grid" style="grid-template-columns: repeat(3, minmax(0,1fr)); align-items:start;">'
    +   colunas.map(function (col) {
          var itens = emAndamento.filter(function (p) { return p.status === col.status; });
          return '<div>'
            + '<h3 style="font-size:0.9rem; margin-bottom:10px;">' + col.titulo + ' (' + itens.length + ')</h3>'
            + '<div style="display:flex; flex-direction:column; gap:10px;">'
            +   (itens.length ? itens.map(function (p) {
                  return '<div class="card panel" style="padding:14px 16px;">'
                    + '<div class="resumo-row" style="border:none; padding:0 0 6px;"><b class="num">#' + esc(p.id) + '</b>' + statusPill(p.origem === "pdv" ? "pdv" : "cliente") + '</div>'
                    + (p.endereco ? '<div class="section-note" style="margin:0 0 8px;">📍 ' + esc(p.endereco) + '</div>' : '')
                    + '<div style="font-size:0.82rem; margin-bottom:10px;">' + esc(p.itemsLabel) + '</div>'
                    + '<button class="btn small primary avancar-status-delivery" data-id="' + esc(p.id) + '" data-proximo="' + KDS_PROXIMO[col.status] + '" style="width:100%;">' + KDS_ACAO_LABEL[col.status] + '</button>'
                    + '</div>';
                }).join("") : '<div class="empty">Nada aqui.</div>')
            + '</div>'
            + '</div>';
        }).join("")
    + '</div>'
    + '<div class="card panel" style="margin-top:16px;">'
    +   '<div class="panel-head"><h2 style="font-size:0.95rem;">Últimas entregas concluídas</h2></div>'
    +   (entregues.length ? entregues.map(function (p) {
          return '<div class="resumo-row"><span>#' + esc(p.id) + (p.endereco ? " · " + esc(p.endereco) : "") + '</span><span class="num">' + brl(p.total) + '</span></div>';
        }).join("") : '<div class="empty">Nenhuma entrega concluída ainda.</div>')
    + '</div>';

  document.getElementById("view-delivery").innerHTML = html;
  document.querySelectorAll(".avancar-status-delivery").forEach(function (b) {
    b.addEventListener("click", function () {
      avancarStatusPedido(b.getAttribute("data-id"), b.getAttribute("data-proximo"));
      renderDelivery();
      renderDashboard();
      renderPedidos();
      renderCozinha();
    });
  });
}
