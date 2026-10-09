// produtos.js — grupo "Produtos" do menu: Categorias, Pratos, Adicionais
// Globais, Insumos e Ficha Técnica.
import {
  state, esc, brl, statusPill, api,
  getCategorias, getCategoriasDados, saveCategoriasDados, isCategoriaBase,
  getDishes, catLabel, isBaseDish, saveDishOverride, addDishExtra, updateDishExtra, removeDishExtra, setEstoqueDish, lerImagemReduzida,
  getAddonGroups, isAddonGroupBase, saveAddonGroupOverride, saveAddonGroupExtra, removeAddonGroupExtra,
  getFornecedores, fornecedorLabel, insumoLabel
} from "./core.js";
import { pdvDisponivel, renderPdv } from "./operacao.js";

/* ============ PRATOS ============ */
// Foto escolhida no formulário "Adicionar novo prato" (base64 dataURL),
// guardada fora do state reativo porque só precisa sobreviver até o
// submit — é resetada a cada renderPratos().
var dishFormFotoData = null;

function dishPhotoOrIcon(d) {
  return d.foto
    ? '<img class="dish-photo" src="' + d.foto + '" alt="">'
    : '<div class="dish-icon">' + esc(d.name[0]) + '</div>';
}

export function renderPratos() {
  dishFormFotoData = null;
  var cats = [{id:"Todos", label:"Todos"}].concat(getCategorias());
  var dishes = getDishes();
  var filtered = dishes.filter(function (d) { return state.dishFilter === "Todos" || d.cat === state.dishFilter; });

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Adicionar novo prato</h2><span class="meta">itens novos aparecem no cardápio do app cliente ao recarregar</span></div>'
    +   '<form id="dishForm" class="add-form">'
    +     '<div><label for="dName">Nome</label><input id="dName" required placeholder="Ex.: Salada Caprese"></div>'
    +     '<div><label for="dCat">Categoria</label><select id="dCat">' + getCategorias().map(function (c) { return '<option value="' + c.id + '">' + c.label + '</option>'; }).join("") + '</select></div>'
    +     '<div><label for="dPrice">Preço (R$)</label><input id="dPrice" type="number" min="0" step="0.01" required placeholder="0,00"></div>'
    +     '<div><label for="dFoto">Foto do prato</label><input id="dFoto" type="file" accept="image/*">'
    +       '<img id="dFotoPreview" class="foto-preview" alt="" style="display:none;"></div>'
    +     '<div class="full"><label for="dDesc">Descrição</label><textarea id="dDesc" placeholder="Breve descrição do prato"></textarea></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Adicionar ao cardápio</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="dish-toolbar">'
    +   '<div class="chip-row">' + cats.map(function (c) {
          return '<button class="chip dish-chip' + (state.dishFilter===c.id?' active':'') + '" data-cat="' + c.id + '">' + c.label + '</button>';
        }).join("") + '</div>'
    +   '<span class="section-note" style="margin:0;">' + filtered.length + ' ' + (filtered.length === 1 ? 'item' : 'itens') + '</span>'
    + '</div>'
    + '<div class="grid dish-grid">'
    +   filtered.map(function (d) {
          var disp = pdvDisponivel(d);
          return '<div class="card dish-card">'
            + '<div class="dish-top">' + dishPhotoOrIcon(d)
            + '<div style="text-align:right;">' + statusPill(disp ? "disponível" : "esgotado") + '</div></div>'
            + '<div><div class="dish-cat">' + esc(catLabel(d.cat)) + '</div><h3>' + esc(d.name) + '</h3></div>'
            + '<div class="dish-desc">' + esc(d.desc) + '</div>'
            + '<div class="estoque-ctrl">Estoque: <input type="number" min="0" class="estoque-input" data-id="' + d.id + '" value="' + (typeof d.estoque === "number" ? d.estoque : "") + '" placeholder="sem controle"></div>'
            + '<div class="dish-foot"><span class="dish-price num">' + brl(d.price) + '</span>'
            + '<div class="dish-actions">'
            +   '<button class="btn small editar-dish" data-id="' + d.id + '">Editar</button>'
            +   '<button class="btn small toggle-dish" data-id="' + d.id + '">' + (d.available !== false ? "Esgotar" : "Reabrir") + '</button>'
            +   '<button class="btn ghost remove-dish" data-id="' + d.id + '" title="' + (isBaseDish(d.id) ? "Remover do cardápio" : "Excluir") + '">&#10005;</button>'
            + '</div></div>'
            + '</div>';
        }).join("")
    + '</div>'
    + (filtered.length === 0 ? '<div class="empty">Nenhum prato nesta categoria.</div>' : '');

  document.getElementById("view-pratos").innerHTML = html;

  document.querySelectorAll(".dish-chip").forEach(function (b) {
    b.addEventListener("click", function () { state.dishFilter = b.getAttribute("data-cat"); renderPratos(); });
  });
  document.querySelectorAll(".estoque-input").forEach(function (inp) {
    inp.addEventListener("change", function () {
      var d = getDishes().filter(function (x) { return x.id === inp.getAttribute("data-id"); })[0];
      if (d) setEstoqueDish(d, inp.value);
      renderPratos();
    });
  });
  document.querySelectorAll(".editar-dish").forEach(function (b) {
    b.addEventListener("click", function () {
      state.pratos.editandoId = b.getAttribute("data-id");
      renderModalEditarPrato();
    });
  });
  document.querySelectorAll(".remove-dish").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      if (isBaseDish(id)) { saveDishOverride(id, {available:false}); } else { removeDishExtra(id); }
      renderPratos();
    });
  });
  document.querySelectorAll(".toggle-dish").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      var atual = getDishes().filter(function (d) { return d.id === id; })[0];
      var novoDisponivel = !(atual && atual.available !== false);
      if (isBaseDish(id)) { saveDishOverride(id, {available: novoDisponivel}); }
      else { updateDishExtra(id, {available: novoDisponivel}); }
      renderPratos();
    });
  });
  document.getElementById("dFoto").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    lerImagemReduzida(file, function (dataUrl) {
      dishFormFotoData = dataUrl;
      var preview = document.getElementById("dFotoPreview");
      preview.src = dishFormFotoData;
      preview.style.display = "";
    });
  });
  document.getElementById("dishForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.getElementById("dName").value.trim();
    var cat = document.getElementById("dCat").value;
    var price = parseFloat(document.getElementById("dPrice").value || "0");
    var desc = document.getElementById("dDesc").value.trim() || "Sem descrição cadastrada.";
    if (!name) return;
    addDishExtra({id: "adm-" + Date.now(), name:name, cat:cat, price:price, desc:desc, foto:dishFormFotoData || undefined, available:true});
    renderPratos();
  });
}

export function renderModalEditarPrato() {
  var overlay = document.getElementById("editarPratoOverlay");
  if (overlay) overlay.remove();
  var id = state.pratos.editandoId;
  if (!id) return;
  var d = getDishes().filter(function (x) { return x.id === id; })[0];
  if (!d) return;

  var epFotoData = d.foto || null;
  var div = document.createElement("div");
  div.id = "editarPratoOverlay";
  div.className = "modal-overlay";
  div.innerHTML = '<div class="card modal-card">'
    + '<h3>Editar prato</h3>'
    + '<form id="editarPratoForm">'
    +   '<div class="pdv-field"><label for="epNome">Nome</label><input id="epNome" value="' + esc(d.name) + '" required></div>'
    +   '<div class="pdv-field"><label for="epPreco">Preço (R$)</label><input id="epPreco" type="number" min="0" step="0.01" value="' + d.price + '" required></div>'
    +   '<div class="pdv-field"><label for="epFoto">Foto do prato</label><input id="epFoto" type="file" accept="image/*">'
    +     '<img id="epFotoPreview" class="foto-preview" alt="" src="' + (epFotoData || "") + '" style="' + (epFotoData ? "" : "display:none;") + '"></div>'
    +   '<div class="pdv-field"><label for="epDesc">Descrição</label><textarea id="epDesc" style="width:100%; min-height:70px; padding:9px 10px; border-radius:7px; border:1px solid var(--border); background:var(--bg); color:var(--ink);">' + esc(d.desc) + '</textarea></div>'
    +   '<div style="display:flex; gap:8px; margin-top:10px;"><button type="submit" class="btn primary" style="flex:1;">Salvar</button><button type="button" class="btn" id="epCancelar">Cancelar</button></div>'
    + '</form>'
    + '</div>';
  document.body.appendChild(div);

  document.getElementById("epCancelar").addEventListener("click", function () {
    state.pratos.editandoId = null;
    renderModalEditarPrato();
  });
  document.getElementById("epFoto").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    lerImagemReduzida(file, function (dataUrl) {
      epFotoData = dataUrl;
      var preview = document.getElementById("epFotoPreview");
      preview.src = epFotoData;
      preview.style.display = "";
    });
  });
  document.getElementById("editarPratoForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("epNome").value.trim();
    var preco = parseFloat(document.getElementById("epPreco").value || "0");
    var desc = document.getElementById("epDesc").value.trim();
    if (!nome) return;
    // foto só entra no patch se uma nova foi escolhida (senão apagaria a que já existe)
    var patch = {name: nome, price: preco, desc: desc};
    if (epFotoData) patch.foto = epFotoData;
    if (isBaseDish(id)) saveDishOverride(id, patch); else updateDishExtra(id, patch);
    state.pratos.editandoId = null;
    renderModalEditarPrato();
    renderPratos();
  });
}

/* ============ CATEGORIAS ============ */
export function renderCategorias() {
  var categorias = getCategorias();
  var dishes = getDishes();
  function contagem(id) { return dishes.filter(function (d) { return d.cat === id; }).length; }

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Nova categoria</h2><span class="meta">aparece no filtro de Pratos e do PDV; pra entrar numa aba de navegação do app cliente, referencie o id em NAV_TABS (data.js)</span></div>'
    +   '<form id="catForm" class="add-form" style="grid-template-columns: 1fr;">'
    +     '<div><label for="catNome">Nome da categoria</label><input id="catNome" required placeholder="Ex.: Vegetariano"></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Adicionar categoria</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Categoria</th><th>Tipo</th><th>Pratos</th><th></th></tr></thead><tbody>'
    +   categorias.map(function (c) {
          var base = isCategoriaBase(c.id);
          var n = contagem(c.id);
          return '<tr><td>' + esc(c.label) + '</td>'
            + '<td><span class="pill ' + (base ? "neutral" : "good") + '">' + (base ? "Base" : "Criada no admin") + '</span></td>'
            + '<td class="num">' + n + '</td>'
            + '<td style="text-align:right;">'
            +   '<button class="btn small editar-cat" data-id="' + c.id + '">Editar</button> '
            +   (!base ? '<button class="btn ghost remover-cat" data-id="' + c.id + '" title="Excluir"' + (n > 0 ? ' disabled' : '') + '>&#10005;</button>' : '')
            + '</td></tr>';
        }).join("")
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-categorias").innerHTML = html;

  document.getElementById("catForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("catNome").value.trim();
    if (!nome) return;
    var semAcento = nome.toLowerCase().normalize("NFD");
    var semDiacriticos = "";
    for (var si = 0; si < semAcento.length; si++) {
      var code = semAcento.charCodeAt(si);
      if (code < 0x0300 || code > 0x036f) semDiacriticos += semAcento[si];
    }
    var slug = semDiacriticos.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || ("cat" + Date.now());
    if (getCategorias().some(function (c) { return c.id === slug; })) { alert("Já existe uma categoria com esse nome."); return; }
    var dados = getCategoriasDados();
    dados.extras = (dados.extras || []).concat([{id: slug, label: nome}]);
    saveCategoriasDados(dados);
    renderCategorias();
    renderPratos();
    renderPdv();
  });
  document.querySelectorAll(".editar-cat").forEach(function (b) {
    b.addEventListener("click", function () {
      state.categorias.editandoId = b.getAttribute("data-id");
      renderModalEditarCategoria();
    });
  });
  document.querySelectorAll(".remover-cat").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      if (contagem(id) > 0) { alert("Mude a categoria dos pratos que usam essa categoria antes de excluí-la."); return; }
      var dados = getCategoriasDados();
      dados.extras = (dados.extras || []).filter(function (c) { return c.id !== id; });
      saveCategoriasDados(dados);
      renderCategorias();
      renderPratos();
      renderPdv();
    });
  });
}

export function renderModalEditarCategoria() {
  var overlay = document.getElementById("editarCatOverlay");
  if (overlay) overlay.remove();
  var id = state.categorias.editandoId;
  if (!id) return;
  var c = getCategorias().filter(function (x) { return x.id === id; })[0];
  if (!c) return;

  var div = document.createElement("div");
  div.id = "editarCatOverlay";
  div.className = "modal-overlay";
  div.innerHTML = '<div class="card modal-card">'
    + '<h3>Editar categoria</h3>'
    + '<form id="editarCatForm">'
    +   '<div class="pdv-field"><label for="ecNome">Nome</label><input id="ecNome" value="' + esc(c.label) + '" required></div>'
    +   '<div style="display:flex; gap:8px; margin-top:10px;"><button type="submit" class="btn primary" style="flex:1;">Salvar</button><button type="button" class="btn" id="ecCancelar">Cancelar</button></div>'
    + '</form>'
    + '</div>';
  document.body.appendChild(div);

  document.getElementById("ecCancelar").addEventListener("click", function () {
    state.categorias.editandoId = null;
    renderModalEditarCategoria();
  });
  document.getElementById("editarCatForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("ecNome").value.trim();
    if (!nome) return;
    var dados = getCategoriasDados();
    if (isCategoriaBase(id)) {
      dados.overrides = dados.overrides || {};
      dados.overrides[id] = {label: nome};
    } else {
      dados.extras = (dados.extras || []).map(function (x) { return x.id === id ? Object.assign({}, x, {label: nome}) : x; });
    }
    saveCategoriasDados(dados);
    state.categorias.editandoId = null;
    renderModalEditarCategoria();
    renderCategorias();
    renderPratos();
    renderPdv();
  });
}

/* ============ ADICIONAIS GLOBAIS ============ */
export function renderAdicionais() {
  var grupos = getAddonGroups();
  var ids = Object.keys(grupos);

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Novo grupo de adicionais</h2><span class="meta">grupos ficam disponíveis pro cardápio do cliente (data/data.js) referenciando o id do grupo no campo "addons" do prato</span></div>'
    +   '<form id="grupoForm" class="add-form">'
    +     '<div><label for="grNome">Nome do grupo</label><input id="grNome" required placeholder="Ex.: Escolha o ponto da carne"></div>'
    +     '<div><label for="grMin">Mínimo</label><input id="grMin" type="number" min="0" value="0" required></div>'
    +     '<div><label for="grMax">Máximo</label><input id="grMax" type="number" min="1" value="1" required></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Criar grupo</button></div>'
    +   '</form>'
    + '</div>'
    + ids.map(function (id) {
        var g = grupos[id];
        var base = isAddonGroupBase(id);
        return '<div class="card panel">'
          + '<div class="panel-head"><h2>' + esc(g.nome) + '</h2>'
          +   '<span class="meta">mín. ' + g.min + ' · máx. ' + g.max + ' · ' + (base ? "grupo base" : "criado no admin") + '</span></div>'
          + '<div class="table-wrap"><table><thead><tr><th>Item</th><th>Preço extra</th><th></th></tr></thead><tbody>'
          +   (g.itens.length ? g.itens.map(function (it) {
                return '<tr><td>' + esc(it.nome) + '</td><td class="num">' + (it.preco ? brl(it.preco) : "grátis") + '</td>'
                  + '<td style="text-align:right;"><button class="btn ghost remover-item-add" data-grupo="' + id + '" data-item="' + it.id + '" title="Remover">&#10005;</button></td></tr>';
              }).join("") : '<tr><td colspan="3"><div class="empty">Sem itens.</div></td></tr>')
          +   '</tbody></table></div>'
          + '<form class="add-form item-add-form" data-grupo="' + id + '" style="margin-top:12px; grid-template-columns: 1.4fr 1fr;">'
          +   '<div><label>Nome do item</label><input class="itAddNome" placeholder="Ex.: Queijo Extra" required></div>'
          +   '<div><label>Preço extra (R$)</label><input class="itAddPreco" type="number" min="0" step="0.5" value="0"></div>'
          +   '<div class="full" style="display:flex; gap:8px;">'
          +     '<button type="submit" class="btn small">Adicionar item</button>'
          +     '<button type="button" class="btn small editar-grupo" data-id="' + id + '">Editar grupo</button>'
          +     (!base ? '<button type="button" class="btn ghost remover-grupo" data-id="' + id + '">Excluir grupo</button>' : '')
          +   '</div>'
          + '</form>'
          + '</div>';
      }).join("");

  document.getElementById("view-adicionais").innerHTML = html;

  document.getElementById("grupoForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("grNome").value.trim();
    var min = parseInt(document.getElementById("grMin").value || "0", 10);
    var max = parseInt(document.getElementById("grMax").value || "1", 10);
    if (!nome) return;
    saveAddonGroupExtra({id: "grp-" + Date.now(), nome: nome, min: min, max: max, itens: []});
    renderAdicionais();
  });
  document.querySelectorAll(".item-add-form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var grupoId = form.getAttribute("data-grupo");
      var nome = form.querySelector(".itAddNome").value.trim();
      var preco = parseFloat(form.querySelector(".itAddPreco").value || "0");
      if (!nome) return;
      var atual = getAddonGroups()[grupoId];
      var novosItens = atual.itens.concat([{id: "it-" + Date.now(), nome: nome, preco: preco}]);
      if (isAddonGroupBase(grupoId)) saveAddonGroupOverride(grupoId, {itens: novosItens});
      else saveAddonGroupExtra(Object.assign({}, atual, {itens: novosItens}));
      renderAdicionais();
    });
  });
  document.querySelectorAll(".remover-item-add").forEach(function (b) {
    b.addEventListener("click", function () {
      var grupoId = b.getAttribute("data-grupo");
      var itemId = b.getAttribute("data-item");
      var atual = getAddonGroups()[grupoId];
      var novosItens = atual.itens.filter(function (it) { return it.id !== itemId; });
      if (isAddonGroupBase(grupoId)) saveAddonGroupOverride(grupoId, {itens: novosItens});
      else saveAddonGroupExtra(Object.assign({}, atual, {itens: novosItens}));
      renderAdicionais();
    });
  });
  document.querySelectorAll(".editar-grupo").forEach(function (b) {
    b.addEventListener("click", function () {
      state.adicionais.editandoGrupoId = b.getAttribute("data-id");
      renderModalEditarGrupo();
    });
  });
  document.querySelectorAll(".remover-grupo").forEach(function (b) {
    b.addEventListener("click", function () {
      removeAddonGroupExtra(b.getAttribute("data-id"));
      renderAdicionais();
    });
  });
}

export function renderModalEditarGrupo() {
  var overlay = document.getElementById("editarGrupoOverlay");
  if (overlay) overlay.remove();
  var id = state.adicionais.editandoGrupoId;
  if (!id) return;
  var g = getAddonGroups()[id];
  if (!g) return;

  var div = document.createElement("div");
  div.id = "editarGrupoOverlay";
  div.className = "modal-overlay";
  div.innerHTML = '<div class="card modal-card">'
    + '<h3>Editar grupo</h3>'
    + '<form id="editarGrupoForm">'
    +   '<div class="pdv-field"><label for="egNome">Nome</label><input id="egNome" value="' + esc(g.nome) + '" required></div>'
    +   '<div class="pdv-field"><label for="egMin">Mínimo</label><input id="egMin" type="number" min="0" value="' + g.min + '" required></div>'
    +   '<div class="pdv-field"><label for="egMax">Máximo</label><input id="egMax" type="number" min="1" value="' + g.max + '" required></div>'
    +   '<div style="display:flex; gap:8px; margin-top:10px;"><button type="submit" class="btn primary" style="flex:1;">Salvar</button><button type="button" class="btn" id="egCancelar">Cancelar</button></div>'
    + '</form>'
    + '</div>';
  document.body.appendChild(div);

  document.getElementById("egCancelar").addEventListener("click", function () {
    state.adicionais.editandoGrupoId = null;
    renderModalEditarGrupo();
  });
  document.getElementById("editarGrupoForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("egNome").value.trim();
    var min = parseInt(document.getElementById("egMin").value || "0", 10);
    var max = parseInt(document.getElementById("egMax").value || "1", 10);
    if (!nome) return;
    var patch = {nome: nome, min: min, max: max};
    if (isAddonGroupBase(id)) saveAddonGroupOverride(id, patch);
    else saveAddonGroupExtra(Object.assign({}, g, patch));
    state.adicionais.editandoGrupoId = null;
    renderModalEditarGrupo();
    renderAdicionais();
  });
}

// `estoque-input` acima é o estoque do prato pronto (finished-good) — nada a
// ver com os insumos abaixo. É a mesma lógica duplicada em data.js#baixarEstoque
// (cliente) e aqui (PDV): não está integrada ao estoque de insumo/ficha
// técnica do ERP, que baixa separado via server/src/lib/estoque.js.

/* ============ INSUMOS ============ */
export function renderInsumos() {
  var insumos = state.insumosCache.filter(function (i) { return i.ativo; });
  var fornecedores = getFornecedores();

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Novo insumo</h2><span class="meta">matéria-prima consumida pelos pratos (ver aba Ficha Técnica)</span></div>'
    +   '<form id="insumoForm" class="add-form">'
    +     '<div><label for="inNome">Nome</label><input id="inNome" required placeholder="Ex.: Pão brioche"></div>'
    +     '<div><label for="inUnidade">Unidade</label><select id="inUnidade">'
    +       ['kg','g','l','ml','un'].map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join("")
    +     '</select></div>'
    +     '<div><label for="inMinimo">Estoque mínimo</label><input id="inMinimo" type="number" min="0" step="0.001" placeholder="opcional"></div>'
    +     '<div><label for="inCusto">Custo unitário (R$)</label><input id="inCusto" type="number" min="0" step="0.01" placeholder="opcional"></div>'
    +     '<div><label for="inFornecedor">Fornecedor padrão</label><select id="inFornecedor"><option value="">—</option>'
    +       fornecedores.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + '</option>'; }).join("")
    +     '</select></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Adicionar insumo</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Insumo</th><th>Estoque atual</th><th>Mínimo</th><th>Custo unit.</th><th>Fornecedor padrão</th><th></th></tr></thead><tbody>'
    +   (insumos.length ? insumos.map(function (i) {
          var baixo = i.estoqueMinimo != null && i.estoqueAtual <= i.estoqueMinimo;
          return '<tr><td>' + esc(i.nome) + '</td>'
            + '<td class="num">' + (baixo ? '<span class="pill warn">' : '<span>') + i.estoqueAtual + ' ' + esc(i.unidade) + '</span></td>'
            + '<td class="num">' + (i.estoqueMinimo != null ? i.estoqueMinimo + ' ' + esc(i.unidade) : '—') + '</td>'
            + '<td class="num">' + (i.custoUnitario != null ? brl(i.custoUnitario) : '—') + '</td>'
            + '<td>' + (i.fornecedorPadraoId ? esc(fornecedorLabel(i.fornecedorPadraoId)) : '—') + '</td>'
            + '<td style="text-align:right; white-space:nowrap;">'
            +   '<button class="btn small ajustar-insumo" data-id="' + i.id + '">Ajustar</button> '
            +   '<button class="btn small editar-insumo" data-id="' + i.id + '">Editar</button> '
            +   '<button class="btn ghost remover-insumo" data-id="' + i.id + '" title="Excluir">&#10005;</button>'
            + '</td></tr>';
        }).join("") : '<tr><td colspan="6"><div class="empty">Nenhum insumo cadastrado.</div></td></tr>')
    +   '</tbody></table>'
    + '</div>';

  document.getElementById("view-insumos").innerHTML = html;

  document.getElementById("insumoForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("inNome").value.trim();
    if (!nome) return;
    var minimo = document.getElementById("inMinimo").value;
    var custo = document.getElementById("inCusto").value;
    api("/api/estoque/insumos", { method: "POST", body: {
      nome: nome,
      unidade: document.getElementById("inUnidade").value,
      estoqueMinimo: minimo === "" ? null : parseFloat(minimo),
      custoUnitario: custo === "" ? null : parseFloat(custo),
      fornecedorPadraoId: document.getElementById("inFornecedor").value || null
    }}).then(function (insumo) {
      state.insumosCache = [insumo].concat(state.insumosCache);
      renderInsumos();
    }).catch(function (err) { alert(err.message); });
  });
  document.querySelectorAll(".ajustar-insumo").forEach(function (b) {
    b.addEventListener("click", function () {
      state.insumos.ajustandoId = b.getAttribute("data-id");
      renderModalAjustarEstoque();
    });
  });
  document.querySelectorAll(".editar-insumo").forEach(function (b) {
    b.addEventListener("click", function () {
      state.insumos.editandoId = b.getAttribute("data-id");
      renderModalEditarInsumo();
    });
  });
  // Sem confirm() — mesmo espírito do "remove-dish" em Pratos (soft
  // delete, ação de baixo risco, sem diálogo nativo bloqueante no meio do
  // fluxo).
  document.querySelectorAll(".remover-insumo").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      api("/api/estoque/insumos/" + id, { method: "DELETE" }).then(function (insumo) {
        state.insumosCache = state.insumosCache.map(function (i) { return i.id === insumo.id ? insumo : i; });
        renderInsumos();
      }).catch(function () {});
    });
  });
}

export function renderModalAjustarEstoque() {
  var overlay = document.getElementById("ajustarEstoqueOverlay");
  if (overlay) overlay.remove();
  var id = state.insumos.ajustandoId;
  if (!id) return;
  var i = state.insumosCache.filter(function (x) { return x.id === id; })[0];
  if (!i) return;

  var div = document.createElement("div");
  div.id = "ajustarEstoqueOverlay";
  div.className = "modal-overlay";
  div.innerHTML = '<div class="card modal-card">'
    + '<h3>Ajustar estoque — ' + esc(i.nome) + '</h3>'
    + '<p class="meta">Estoque atual: ' + i.estoqueAtual + ' ' + esc(i.unidade) + '</p>'
    + '<form id="ajusteForm">'
    +   '<div class="pdv-field"><label for="ajQuantidade">Quantidade (negativo pra baixar)</label><input id="ajQuantidade" type="number" step="0.001" required></div>'
    +   '<div class="pdv-field"><label for="ajMotivo">Motivo</label><input id="ajMotivo" placeholder="Ex.: contagem, perda, correção"></div>'
    +   '<div style="display:flex; gap:8px; margin-top:10px;"><button type="submit" class="btn primary" style="flex:1;">Ajustar</button><button type="button" class="btn" id="ajCancelar">Cancelar</button></div>'
    + '</form>'
    + '</div>';
  document.body.appendChild(div);

  document.getElementById("ajCancelar").addEventListener("click", function () {
    state.insumos.ajustandoId = null;
    renderModalAjustarEstoque();
  });
  document.getElementById("ajusteForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var quantidade = parseFloat(document.getElementById("ajQuantidade").value);
    if (!quantidade) return;
    var motivo = document.getElementById("ajMotivo").value.trim();
    api("/api/estoque/insumos/" + id + "/ajuste", { method: "PATCH", body: { quantidade: quantidade, motivo: motivo } })
      .then(function (insumo) {
        state.insumosCache = state.insumosCache.map(function (x) { return x.id === insumo.id ? insumo : x; });
        state.insumos.ajustandoId = null;
        renderModalAjustarEstoque();
        renderInsumos();
      }).catch(function (err) { alert(err.message); });
  });
}

export function renderModalEditarInsumo() {
  var overlay = document.getElementById("editarInsumoOverlay");
  if (overlay) overlay.remove();
  var id = state.insumos.editandoId;
  if (!id) return;
  var i = state.insumosCache.filter(function (x) { return x.id === id; })[0];
  if (!i) return;
  var fornecedores = getFornecedores();

  var div = document.createElement("div");
  div.id = "editarInsumoOverlay";
  div.className = "modal-overlay";
  div.innerHTML = '<div class="card modal-card">'
    + '<h3>Editar insumo</h3>'
    + '<form id="editarInsumoForm">'
    +   '<div class="pdv-field"><label for="eiNome">Nome</label><input id="eiNome" value="' + esc(i.nome) + '" required></div>'
    +   '<div class="pdv-field"><label for="eiUnidade">Unidade</label><select id="eiUnidade">'
    +     ['kg','g','l','ml','un'].map(function (u) { return '<option value="' + u + '"' + (u === i.unidade ? ' selected' : '') + '>' + u + '</option>'; }).join("")
    +   '</select></div>'
    +   '<div class="pdv-field"><label for="eiMinimo">Estoque mínimo</label><input id="eiMinimo" type="number" min="0" step="0.001" value="' + (i.estoqueMinimo != null ? i.estoqueMinimo : "") + '"></div>'
    +   '<div class="pdv-field"><label for="eiCusto">Custo unitário (R$)</label><input id="eiCusto" type="number" min="0" step="0.01" value="' + (i.custoUnitario != null ? i.custoUnitario : "") + '"></div>'
    +   '<div class="pdv-field"><label for="eiFornecedor">Fornecedor padrão</label><select id="eiFornecedor"><option value="">—</option>'
    +     fornecedores.map(function (f) { return '<option value="' + f.id + '"' + (f.id === i.fornecedorPadraoId ? ' selected' : '') + '>' + esc(f.nome) + '</option>'; }).join("")
    +   '</select></div>'
    +   '<div style="display:flex; gap:8px; margin-top:10px;"><button type="submit" class="btn primary" style="flex:1;">Salvar</button><button type="button" class="btn" id="eiCancelar">Cancelar</button></div>'
    + '</form>'
    + '</div>';
  document.body.appendChild(div);

  document.getElementById("eiCancelar").addEventListener("click", function () {
    state.insumos.editandoId = null;
    renderModalEditarInsumo();
  });
  document.getElementById("editarInsumoForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var minimo = document.getElementById("eiMinimo").value;
    var custo = document.getElementById("eiCusto").value;
    api("/api/estoque/insumos/" + id, { method: "PATCH", body: {
      nome: document.getElementById("eiNome").value.trim(),
      unidade: document.getElementById("eiUnidade").value,
      estoqueMinimo: minimo === "" ? null : parseFloat(minimo),
      custoUnitario: custo === "" ? null : parseFloat(custo),
      fornecedorPadraoId: document.getElementById("eiFornecedor").value || null
    }}).then(function (insumo) {
      state.insumosCache = state.insumosCache.map(function (x) { return x.id === insumo.id ? insumo : x; });
      state.insumos.editandoId = null;
      renderModalEditarInsumo();
      renderInsumos();
    }).catch(function (err) { alert(err.message); });
  });
}

/* ============ FICHA TÉCNICA ============ */
export function renderFichaTecnica() {
  var dishes = getDishes();
  var pratoId = state.fichaTecnica.pratoId;

  var html = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Escolha um prato</h2><span class="meta">defina quanto de cada insumo 1 unidade vendida consome</span></div>'
    +   '<select id="ftPratoSelect" style="width:100%; max-width:420px;"><option value="">Selecione um prato…</option>'
    +     dishes.map(function (d) { return '<option value="' + d.id + '"' + (d.id === pratoId ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join("")
    +   '</select>'
    + '</div>'
    + (pratoId ? '<div class="card panel" id="ftDetalhe"><div class="meta">Carregando ficha técnica…</div></div>' : '');

  document.getElementById("view-fichaTecnica").innerHTML = html;

  document.getElementById("ftPratoSelect").addEventListener("change", function (e) {
    state.fichaTecnica.pratoId = e.target.value || null;
    renderFichaTecnica();
  });
  if (pratoId) carregarFichaTecnicaDetalhe(pratoId);
}

export function carregarFichaTecnicaDetalhe(pratoId) {
  api("/api/estoque/receitas/" + encodeURIComponent(pratoId)).then(function (itens) {
    if (state.fichaTecnica.pratoId !== pratoId) return; // trocou de prato enquanto carregava
    renderFichaTecnicaDetalhe(itens);
  });
}

export function renderFichaTecnicaDetalhe(itens) {
  var container = document.getElementById("ftDetalhe");
  if (!container) return;
  var insumos = state.insumosCache.filter(function (i) { return i.ativo; });

  container.innerHTML = ''
    + '<div class="panel-head"><h2>Ficha técnica</h2><span class="meta">' + itens.length + ' insumo(s)</span></div>'
    + '<div class="table-wrap"><table><thead><tr><th>Insumo</th><th>Quantidade por unidade vendida</th><th></th></tr></thead><tbody>'
    +   (itens.length ? itens.map(function (it, idx) {
          return '<tr><td>' + esc(insumoLabel(it.insumoId)) + '</td><td class="num">' + it.quantidade + '</td>'
            + '<td style="text-align:right;"><button class="btn ghost remover-ft-item" data-idx="' + idx + '" title="Remover">&#10005;</button></td></tr>';
        }).join("") : '<tr><td colspan="3"><div class="empty">Sem insumos na ficha técnica deste prato.</div></td></tr>')
    + '</tbody></table></div>'
    + '<form id="ftItemForm" class="add-form" style="margin-top:12px; grid-template-columns: 1.4fr 1fr;">'
    +   '<div><label>Insumo</label><select id="ftInsumo" required><option value="">Selecione…</option>'
    +     insumos.map(function (i) { return '<option value="' + i.id + '">' + esc(i.nome) + ' (' + esc(i.unidade) + ')</option>'; }).join("")
    +   '</select></div>'
    +   '<div><label>Quantidade</label><input id="ftQuantidade" type="number" min="0" step="0.001" required></div>'
    +   '<div class="full"><button type="submit" class="btn small">Adicionar à ficha técnica</button></div>'
    + '</form>';

  document.querySelectorAll(".remover-ft-item").forEach(function (b) {
    b.addEventListener("click", function () {
      var idx = parseInt(b.getAttribute("data-idx"), 10);
      var novaLista = itens.slice(0, idx).concat(itens.slice(idx + 1));
      salvarFichaTecnica(novaLista);
    });
  });
  document.getElementById("ftItemForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var insumoId = document.getElementById("ftInsumo").value;
    var quantidade = parseFloat(document.getElementById("ftQuantidade").value);
    if (!insumoId || !(quantidade > 0)) return;
    salvarFichaTecnica(itens.concat([{insumoId: insumoId, quantidade: quantidade}]));
  });
}

// Substitui a ficha técnica inteira do prato de uma vez (PUT, não PATCH
// item a item) — mais simples que diffing, ver server/src/routes/estoque.js.
export function salvarFichaTecnica(itens) {
  var pratoId = state.fichaTecnica.pratoId;
  api("/api/estoque/receitas/" + encodeURIComponent(pratoId), { method: "PUT", body: {
    itens: itens.map(function (it) { return {insumoId: it.insumoId, quantidade: it.quantidade}; })
  }}).then(function (novaLista) {
    renderFichaTecnicaDetalhe(novaLista);
  }).catch(function (err) { alert(err.message); });
}
