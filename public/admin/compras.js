// compras.js — grupo "Compras" do menu: Fornecedores e Compras.
import {
  state, esc, brl, statusPill, api, dataInputParaTimestamp,
  getFornecedores, fornecedorLabel, insumoLabel,
  carregarContasPagarCache, carregarInsumosCache
} from "./core.js";

/* ============ FORNECEDORES ============ */
export function renderFornecedores() {
  var fornecedores = getFornecedores();

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Novo fornecedor</h2></div>'
    +   '<form id="fornForm" class="add-form">'
    +     '<div><label for="foNome">Nome</label><input id="foNome" required placeholder="Ex.: Distribuidora Central"></div>'
    +     '<div><label for="foDocumento">CNPJ/CPF</label><input id="foDocumento" placeholder="opcional"></div>'
    +     '<div><label for="foTelefone">Telefone</label><input id="foTelefone" placeholder="opcional"></div>'
    +     '<div><label for="foEmail">E-mail</label><input id="foEmail" type="email" placeholder="opcional"></div>'
    +     '<div class="full"><label for="foEndereco">Endereço</label><input id="foEndereco" placeholder="opcional"></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Adicionar fornecedor</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th></th></tr></thead><tbody>'
    +   (fornecedores.length ? fornecedores.map(function (f) {
          return '<tr><td>' + esc(f.nome) + '</td><td>' + esc(f.documento || "—") + '</td>'
            + '<td>' + esc(f.telefone || "—") + '</td><td>' + esc(f.email || "—") + '</td>'
            + '<td style="text-align:right; white-space:nowrap;">'
            +   '<button class="btn small editar-fornecedor" data-id="' + f.id + '">Editar</button> '
            +   '<button class="btn ghost remover-fornecedor" data-id="' + f.id + '" title="Excluir">&#10005;</button>'
            + '</td></tr>';
        }).join("") : '<tr><td colspan="5"><div class="empty">Nenhum fornecedor cadastrado.</div></td></tr>')
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-fornecedores").innerHTML = html;

  document.getElementById("fornForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("foNome").value.trim();
    if (!nome) return;
    api("/api/fornecedores", { method: "POST", body: {
      nome: nome,
      documento: document.getElementById("foDocumento").value.trim() || null,
      telefone: document.getElementById("foTelefone").value.trim() || null,
      email: document.getElementById("foEmail").value.trim() || null,
      endereco: document.getElementById("foEndereco").value.trim() || null
    }}).then(function (fornecedor) {
      state.fornecedoresCache = [fornecedor].concat(state.fornecedoresCache);
      renderFornecedores();
    }).catch(function (err) { alert(err.message); });
  });
  document.querySelectorAll(".editar-fornecedor").forEach(function (b) {
    b.addEventListener("click", function () {
      state.fornecedores.editandoId = b.getAttribute("data-id");
      renderModalEditarFornecedor();
    });
  });
  document.querySelectorAll(".remover-fornecedor").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      api("/api/fornecedores/" + id, { method: "DELETE" }).then(function (fornecedor) {
        state.fornecedoresCache = state.fornecedoresCache.map(function (f) { return f.id === fornecedor.id ? fornecedor : f; });
        renderFornecedores();
      }).catch(function () {});
    });
  });
}

export function renderModalEditarFornecedor() {
  var overlay = document.getElementById("editarFornecedorOverlay");
  if (overlay) overlay.remove();
  var id = state.fornecedores.editandoId;
  if (!id) return;
  var f = state.fornecedoresCache.filter(function (x) { return x.id === id; })[0];
  if (!f) return;

  var div = document.createElement("div");
  div.id = "editarFornecedorOverlay";
  div.className = "modal-overlay";
  div.innerHTML = '<div class="card modal-card">'
    + '<h3>Editar fornecedor</h3>'
    + '<form id="editarFornecedorForm">'
    +   '<div class="pdv-field"><label for="efNome">Nome</label><input id="efNome" value="' + esc(f.nome) + '" required></div>'
    +   '<div class="pdv-field"><label for="efDocumento">CNPJ/CPF</label><input id="efDocumento" value="' + esc(f.documento || "") + '"></div>'
    +   '<div class="pdv-field"><label for="efTelefone">Telefone</label><input id="efTelefone" value="' + esc(f.telefone || "") + '"></div>'
    +   '<div class="pdv-field"><label for="efEmail">E-mail</label><input id="efEmail" value="' + esc(f.email || "") + '"></div>'
    +   '<div class="pdv-field"><label for="efEndereco">Endereço</label><input id="efEndereco" value="' + esc(f.endereco || "") + '"></div>'
    +   '<div style="display:flex; gap:8px; margin-top:10px;"><button type="submit" class="btn primary" style="flex:1;">Salvar</button><button type="button" class="btn" id="efCancelar">Cancelar</button></div>'
    + '</form>'
    + '</div>';
  document.body.appendChild(div);

  document.getElementById("efCancelar").addEventListener("click", function () {
    state.fornecedores.editandoId = null;
    renderModalEditarFornecedor();
  });
  document.getElementById("editarFornecedorForm").addEventListener("submit", function (e) {
    e.preventDefault();
    api("/api/fornecedores/" + id, { method: "PATCH", body: {
      nome: document.getElementById("efNome").value.trim(),
      documento: document.getElementById("efDocumento").value.trim() || null,
      telefone: document.getElementById("efTelefone").value.trim() || null,
      email: document.getElementById("efEmail").value.trim() || null,
      endereco: document.getElementById("efEndereco").value.trim() || null
    }}).then(function (fornecedor) {
      state.fornecedoresCache = state.fornecedoresCache.map(function (x) { return x.id === fornecedor.id ? fornecedor : x; });
      state.fornecedores.editandoId = null;
      renderModalEditarFornecedor();
      renderFornecedores();
    }).catch(function (err) { alert(err.message); });
  });
}

/* ============ COMPRAS ============ */
// Sub-formulário "itens da compra" (tabela + linha de adicionar), separado
// de renderCompras() porque é reconstruído sozinho a cada item
// adicionado/removido (wireComprasItensForm), sem re-renderizar a página inteira.
export function comprasItensFormHtml() {
  var insumos = state.insumosCache.filter(function (i) { return i.ativo; });
  var itens = state.compras.itensForm;
  var total = itens.reduce(function (s, it) { return s + (Number(it.quantidade) || 0) * (Number(it.precoUnitario) || 0); }, 0);
  return '<div class="table-wrap"><table><thead><tr><th>Insumo</th><th>Qtd.</th><th>Preço unit.</th><th>Subtotal</th><th></th></tr></thead><tbody>'
    + (itens.length ? itens.map(function (it, idx) {
        return '<tr><td>' + esc(insumoLabel(it.insumoId)) + '</td><td class="num">' + it.quantidade + '</td>'
          + '<td class="num">' + brl(it.precoUnitario) + '</td><td class="num">' + brl(it.quantidade * it.precoUnitario) + '</td>'
          + '<td style="text-align:right;"><button type="button" class="btn ghost remover-compra-item" data-idx="' + idx + '" title="Remover">&#10005;</button></td></tr>';
      }).join("") : '<tr><td colspan="5"><div class="empty">Nenhum item adicionado ainda.</div></td></tr>')
    + '</tbody></table></div>'
    + '<div class="add-form" style="grid-template-columns: 1.4fr 0.8fr 0.8fr auto; margin-top:10px;">'
    +   '<div><label>Insumo</label><select id="cpInsumo"><option value="">Selecione…</option>'
    +     insumos.map(function (i) { return '<option value="' + i.id + '">' + esc(i.nome) + ' (' + esc(i.unidade) + ')</option>'; }).join("")
    +   '</select></div>'
    +   '<div><label>Quantidade</label><input id="cpQuantidade" type="number" min="0" step="0.001"></div>'
    +   '<div><label>Preço unit. (R$)</label><input id="cpPreco" type="number" min="0" step="0.01"></div>'
    +   '<div style="align-self:end;"><button type="button" class="btn small" id="btnAddCompraItem">+ item</button></div>'
    + '</div>'
    + '<div class="resumo-row" style="margin-top:10px;"><span>Total da compra</span><span class="num">' + brl(total) + '</span></div>';
}

export function renderCompras() {
  var compras = state.comprasCache;

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Nova compra</h2><span class="meta">gera automaticamente uma Conta a Pagar vinculada</span></div>'
    +   '<form id="compraForm">'
    +     '<div class="add-form" style="grid-template-columns: 1.4fr 1fr;">'
    +       '<div><label for="cpFornecedor">Fornecedor</label><select id="cpFornecedor" required><option value="">Selecione…</option>'
    +         getFornecedores().map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + '</option>'; }).join("")
    +       '</select></div>'
    +       '<div><label for="cpVencimento">Vencimento da conta a pagar</label><input id="cpVencimento" type="date" required></div>'
    +     '</div>'
    +     '<div id="comprasItensWrap">' + comprasItensFormHtml() + '</div>'
    +     '<div class="full" style="margin-top:12px;"><button type="submit" class="btn primary">Registrar compra</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Compra</th><th>Fornecedor</th><th>Total</th><th>Status</th><th>Data</th><th></th></tr></thead><tbody>'
    +   (compras.length ? compras.map(function (c) {
          return '<tr><td>' + esc(c.id) + '</td><td>' + esc(fornecedorLabel(c.fornecedorId)) + '</td>'
            + '<td class="num">' + brl(c.total) + '</td><td>' + statusPill(c.status) + '</td>'
            + '<td class="num">' + new Date(c.criadoEm).toLocaleDateString("pt-BR") + '</td>'
            + '<td style="text-align:right; white-space:nowrap;">'
            +   (c.status === "pendente" ? '<button class="btn small receber-compra" data-id="' + c.id + '">Receber</button> <button class="btn ghost cancelar-compra" data-id="' + c.id + '" title="Cancelar">&#10005;</button>' : '')
            + '</td></tr>';
        }).join("") : '<tr><td colspan="6"><div class="empty">Nenhuma compra registrada.</div></td></tr>')
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-compras").innerHTML = html;
  wireComprasItensForm();

  document.getElementById("compraForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var fornecedorId = document.getElementById("cpFornecedor").value;
    var vencimento = document.getElementById("cpVencimento").value;
    if (!fornecedorId || !vencimento || !state.compras.itensForm.length) {
      alert("Escolha o fornecedor, o vencimento e adicione ao menos 1 item.");
      return;
    }
    api("/api/compras", { method: "POST", body: {
      fornecedorId: fornecedorId,
      vencimentoContaPagar: dataInputParaTimestamp(vencimento),
      itens: state.compras.itensForm
    }}).then(function () {
      // Não faz push manual no cache aqui — o evento de socket "compra:nova"
      // (emitido pro room "admin", que este próprio painel também está)
      // já cuida disso; fazer os dois duplicaria a linha na tabela.
      state.compras.itensForm = [];
      carregarContasPagarCache().then(renderCompras);
    }).catch(function (err) { alert(err.message); });
  });
  // Sem confirm()/alert() de erro — mesmo padrão fire-and-forget de
  // toggleCancelPedido/avancarStatusPedido (ver initSocket): ação
  // otimista, sem diálogo nativo bloqueante no meio do fluxo.
  // "Receber" credita o estoque de TODOS os insumos da compra de uma vez —
  // não existe recebimento parcial (limitação conhecida, ver CLAUDE.md).
  document.querySelectorAll(".receber-compra").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      api("/api/compras/" + id + "/receber", { method: "PATCH" }).then(function (compra) {
        state.comprasCache = state.comprasCache.map(function (c) { return c.id === compra.id ? compra : c; });
        carregarInsumosCache().then(renderCompras);
      }).catch(function () {});
    });
  });
  document.querySelectorAll(".cancelar-compra").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      api("/api/compras/" + id + "/cancelar", { method: "PATCH" }).then(function (compra) {
        state.comprasCache = state.comprasCache.map(function (c) { return c.id === compra.id ? compra : c; });
        carregarContasPagarCache().then(renderCompras);
      }).catch(function () {});
    });
  });
}

export function wireComprasItensForm() {
  document.querySelectorAll(".remover-compra-item").forEach(function (b) {
    b.addEventListener("click", function () {
      var idx = parseInt(b.getAttribute("data-idx"), 10);
      state.compras.itensForm = state.compras.itensForm.slice(0, idx).concat(state.compras.itensForm.slice(idx + 1));
      document.getElementById("comprasItensWrap").innerHTML = comprasItensFormHtml();
      wireComprasItensForm();
    });
  });
  document.getElementById("btnAddCompraItem").addEventListener("click", function () {
    var insumoId = document.getElementById("cpInsumo").value;
    var quantidade = parseFloat(document.getElementById("cpQuantidade").value);
    var precoUnitario = parseFloat(document.getElementById("cpPreco").value);
    if (!insumoId || !(quantidade > 0) || !(precoUnitario >= 0)) return;
    state.compras.itensForm = state.compras.itensForm.concat([{insumoId: insumoId, quantidade: quantidade, precoUnitario: precoUnitario}]);
    document.getElementById("comprasItensWrap").innerHTML = comprasItensFormHtml();
    wireComprasItensForm();
  });
}
