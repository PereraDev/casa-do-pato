// gestao.js — grupo "Gestão" do menu: Funcionários, Clientes e Fidelidade.
import {
  state, esc, brl, initials, SECTIONS,
  getUsuarios,
  getConfigFidelidade, getContaFidelidade, getNivelFid, saldoPontosFid, saveConfigFidelidade, ajusteManualFidelidade,
  getFuncionarios, getFuncoes, funcaoLabel, saveFuncionarios, saveFuncoes, secoesPermitidas
} from "./core.js";

/* ============ CLIENTES ============
   Contas reais cadastradas no app cliente (back-end — tabela User no
   Postgres, ver GET /api/auth/usuarios). O protótipo do cliente não
   exige login para pedir (acesso via QR Code cai direto como visitante)
   e o pedido não é vinculado à conta — por isso não há como cruzar
   pedidos/gasto por cliente aqui, só listar quem tem conta criada. */
export function renderClientes() {
  var usuarios = getUsuarios().sort(function(a,b){ return a.name.localeCompare(b.name, "pt-BR"); });
  var html = ''
    + '<div class="section-note">Contas cadastradas no app cliente. Pedidos não exigem login, então não são vinculados a uma conta.</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Cliente</th><th>E-mail</th></tr></thead><tbody>'
    +   (usuarios.length ? usuarios.map(function (c) {
          return '<tr><td><div class="name-cell"><span class="avatar-sm">' + initials(c.name) + '</span>' + esc(c.name) + '</div></td>'
            + '<td class="num">' + esc(c.email) + '</td></tr>';
        }).join("") : '<tr><td colspan="2"><div class="empty">Nenhuma conta cadastrada ainda no app cliente.</div></td></tr>')
    +   '</tbody></table>'
    + '</div>';
  document.getElementById("view-clientes").innerHTML = html;
}

/* ============ FIDELIDADE ============ */
export function getMembrosFidelidade() {
  var config = getConfigFidelidade();
  return getUsuarios().map(function (u) {
    var conta = getContaFidelidade(u.email);
    var nivel = getNivelFid(conta.pontosVitalicios, config.niveis);
    return {
      nome: u.name, email: u.email, nivel: nivel,
      saldoPontos: saldoPontosFid(conta), pontosVitalicios: conta.pontosVitalicios,
      cashback: conta.cashback, historico: conta.historico
    };
  }).sort(function (a,b) { return b.pontosVitalicios - a.pontosVitalicios; });
}

export function renderFidelidade() {
  var config = getConfigFidelidade();
  var membros = getMembrosFidelidade();
  var resgates = [];
  membros.forEach(function (m) {
    m.historico.filter(function (h) { return h.tipo === "resgate"; }).forEach(function (h) {
      resgates.push(Object.assign({}, h, {membro: m.nome || m.email}));
    });
  });
  resgates.sort(function (a,b) { return b.em - a.em; });

  var html = ''
    + '<div class="grid two-col">'
    +   '<div class="card panel">'
    +     '<div class="panel-head"><h2>Configuração</h2></div>'
    +     '<form id="fidConfigForm" class="add-form">'
    +       '<div><label for="fidPontosPorReal">Pontos por R$1 gasto</label><input id="fidPontosPorReal" type="number" min="0" step="0.1" value="' + config.pontosPorReal + '"></div>'
    +       '<div><label for="fidValidade">Validade dos pontos (dias)</label><input id="fidValidade" type="number" min="1" step="1" value="' + config.validadePontosDias + '"></div>'
    +       '<div><label for="fidCashbackPct">Cashback (%)</label><input id="fidCashbackPct" type="number" min="0" step="0.5" value="' + config.cashbackPct + '"></div>'
    +       '<div class="full"><button type="submit" class="btn primary">Salvar configuração</button></div>'
    +     '</form>'
    +   '</div>'
    +   '<div class="card panel">'
    +     '<div class="panel-head"><h2>Níveis</h2><span class="meta">por pontos acumulados na vida toda</span></div>'
    +     config.niveis.map(function (n) {
            return '<div class="resumo-row"><span>' + esc(n.nome) + ' (' + n.minPontosVitalicios + '+ pts)</span>'
              + '<span class="num">' + n.multiplicador + 'x <button class="btn ghost remove-nivel" data-id="' + n.id + '" title="Remover">&#10005;</button></span></div>';
          }).join("")
    +     '<form id="nivelForm" class="add-form" style="margin-top:14px; grid-template-columns: 1fr 1fr 1fr;">'
    +       '<div><label for="nvNome">Nome</label><input id="nvNome" placeholder="Ex.: Diamante" required></div>'
    +       '<div><label for="nvMin">Mín. pontos</label><input id="nvMin" type="number" min="0" required></div>'
    +       '<div><label for="nvMult">Multiplicador</label><input id="nvMult" type="number" min="1" step="0.1" required></div>'
    +       '<div class="full"><button type="submit" class="btn small">Adicionar nível</button></div>'
    +     '</form>'
    +   '</div>'
    + '</div>'

    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Recompensas</h2><span class="meta">catálogo de troca de pontos — a foto aparece no card do cliente (Usar meus pontos)</span></div>'
    +   config.recompensas.map(function (r) {
          return '<div class="resumo-row">'
            + '<span style="display:flex; align-items:center; gap:8px;">' + (r.foto ? '<img src="' + r.foto + '" alt="" style="width:28px; height:28px; border-radius:6px; object-fit:cover;">' : '') + esc(r.nome) + '</span>'
            + '<span class="num">' + r.custoPontos + ' pts <button class="btn ghost remove-recompensa" data-id="' + r.id + '" title="Remover">&#10005;</button></span></div>';
        }).join("")
    +   '<form id="recompensaForm" class="add-form" style="margin-top:14px; grid-template-columns: 1.4fr 1fr;">'
    +     '<div><label for="rcNome">Nome da recompensa</label><input id="rcNome" placeholder="Ex.: Sobremesa grátis" required></div>'
    +     '<div><label for="rcCusto">Custo em pontos</label><input id="rcCusto" type="number" min="1" required></div>'
    +     '<div class="full"><label for="rcFoto">Foto (opcional)</label><input id="rcFoto" type="file" accept="image/*">'
    +       '<img id="rcFotoPreview" class="foto-preview" alt="" style="display:none;"></div>'
    +     '<div class="full"><button type="submit" class="btn small">Adicionar recompensa</button></div>'
    +   '</form>'
    + '</div>'

    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Membros</h2><span class="meta">' + membros.length + ' conta(s) cadastrada(s)</span></div>'
    +   '<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Nível</th><th>Pontos válidos</th><th>Pontos vitalícios</th><th>Cashback</th><th></th></tr></thead><tbody>'
    +   (membros.length ? membros.map(function (m) {
          return '<tr><td><div class="name-cell"><span class="avatar-sm">' + initials(m.nome) + '</span>' + esc(m.nome) + '<br><span class="section-note" style="margin:0;">' + esc(m.email) + '</span></div></td>'
            + '<td>' + esc(m.nivel.nome) + '</td><td class="num">' + m.saldoPontos + '</td><td class="num">' + m.pontosVitalicios + '</td>'
            + '<td class="num">' + brl(m.cashback) + '</td>'
            + '<td><button class="btn small ajustar-fid" data-email="' + esc(m.email) + '">Ajustar</button></td></tr>';
        }).join("") : '<tr><td colspan="6"><div class="empty">Nenhuma conta cadastrada ainda no app cliente.</div></td></tr>')
    +   '</tbody></table></div>'
    + '</div>'

    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Histórico de resgates</h2></div>'
    +   '<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Recompensa</th><th>Pontos</th><th>Data</th></tr></thead><tbody>'
    +   (resgates.length ? resgates.slice(0,30).map(function (r) {
          return '<tr><td>' + esc(r.membro) + '</td><td>' + esc(r.recompensa) + '</td><td class="num">' + r.pontos + '</td><td class="num">' + new Date(r.em).toLocaleDateString("pt-BR") + '</td></tr>';
        }).join("") : '<tr><td colspan="4"><div class="empty">Nenhum resgate ainda.</div></td></tr>')
    +   '</tbody></table></div>'
    + '</div>';

  document.getElementById("view-fidelidade").innerHTML = html;

  document.getElementById("fidConfigForm").addEventListener("submit", function (e) {
    e.preventDefault();
    saveConfigFidelidade(Object.assign({}, config, {
      pontosPorReal: parseFloat(document.getElementById("fidPontosPorReal").value || "0"),
      validadePontosDias: parseInt(document.getElementById("fidValidade").value || "90", 10),
      cashbackPct: parseFloat(document.getElementById("fidCashbackPct").value || "0")
    }));
    renderFidelidade();
  });
  document.getElementById("nivelForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("nvNome").value.trim();
    var min = parseInt(document.getElementById("nvMin").value || "0", 10);
    var mult = parseFloat(document.getElementById("nvMult").value || "1");
    if (!nome) return;
    saveConfigFidelidade(Object.assign({}, config, {niveis: config.niveis.concat([{id: "nv-" + Date.now(), nome: nome, minPontosVitalicios: min, multiplicador: mult}])}));
    renderFidelidade();
  });
  document.querySelectorAll(".remove-nivel").forEach(function (b) {
    b.addEventListener("click", function () {
      saveConfigFidelidade(Object.assign({}, config, {niveis: config.niveis.filter(function (n) { return n.id !== b.getAttribute("data-id"); })}));
      renderFidelidade();
    });
  });
  var recompensaFotoData = null;
  document.getElementById("rcFoto").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      recompensaFotoData = reader.result;
      var preview = document.getElementById("rcFotoPreview");
      preview.src = recompensaFotoData;
      preview.style.display = "";
    };
    reader.readAsDataURL(file);
  });
  document.getElementById("recompensaForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("rcNome").value.trim();
    var custo = parseInt(document.getElementById("rcCusto").value || "0", 10);
    if (!nome || !custo) return;
    saveConfigFidelidade(Object.assign({}, config, {recompensas: config.recompensas.concat([{id: "rc-" + Date.now(), nome: nome, custoPontos: custo, foto: recompensaFotoData || undefined}])}));
    renderFidelidade();
  });
  document.querySelectorAll(".remove-recompensa").forEach(function (b) {
    b.addEventListener("click", function () {
      saveConfigFidelidade(Object.assign({}, config, {recompensas: config.recompensas.filter(function (r) { return r.id !== b.getAttribute("data-id"); })}));
      renderFidelidade();
    });
  });
  document.querySelectorAll(".ajustar-fid").forEach(function (b) {
    b.addEventListener("click", function () {
      state.fidelidade.ajusteEmail = b.getAttribute("data-email");
      renderModalAjusteFidelidade();
    });
  });
}

export function renderModalAjusteFidelidade() {
  var overlay = document.getElementById("fidModalOverlay");
  if (overlay) overlay.remove();
  var email = state.fidelidade.ajusteEmail;
  if (!email) return;

  var div = document.createElement("div");
  div.id = "fidModalOverlay";
  div.className = "modal-overlay";
  div.innerHTML = '<div class="card modal-card">'
    + '<h3>Ajustar fidelidade</h3>'
    + '<p class="section-note">' + esc(email) + '</p>'
    + '<form id="ajusteFidForm">'
    +   '<div class="pdv-field"><label for="ajPontos">Pontos (use negativo pra remover)</label><input id="ajPontos" type="number" step="1" value="0"></div>'
    +   '<div class="pdv-field"><label for="ajCashback">Cashback R$ (use negativo pra remover)</label><input id="ajCashback" type="number" step="0.5" value="0"></div>'
    +   '<div class="pdv-field"><label for="ajMotivo">Motivo</label><input id="ajMotivo" placeholder="Ex.: cortesia por atraso" required></div>'
    +   '<div style="display:flex; gap:8px;"><button type="submit" class="btn primary" style="flex:1;">Confirmar ajuste</button><button type="button" class="btn" id="ajCancelar">Cancelar</button></div>'
    + '</form>'
    + '</div>';
  document.body.appendChild(div);

  document.getElementById("ajCancelar").addEventListener("click", function () {
    state.fidelidade.ajusteEmail = null;
    renderModalAjusteFidelidade();
  });
  document.getElementById("ajusteFidForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pontos = parseInt(document.getElementById("ajPontos").value || "0", 10);
    var cashback = parseFloat(document.getElementById("ajCashback").value || "0");
    var motivo = document.getElementById("ajMotivo").value.trim();
    if (!motivo || (!pontos && !cashback)) return;
    ajusteManualFidelidade(email, pontos, cashback, motivo);
    state.fidelidade.ajusteEmail = null;
    renderModalAjusteFidelidade();
    renderFidelidade();
  });
}

/* ============ FUNCIONÁRIOS ============
   Login/senha + função de quem acessa o painel — não confundir com
   state.employees (folha de pagamento mockada da aba Financeiro, sem
   login nenhum — ver sistema.js#renderFinanceiro). Ver
   core.js#getFuncionarios/getFuncoes. */
// Agrupa SECTIONS pelo mesmo `group` usado no menu lateral, só pra
// organizar visualmente o checklist de acesso por funcionário.
function gruposSections() {
  var porGrupo = {}, ordem = [];
  SECTIONS.forEach(function (s) {
    if (!porGrupo[s.group]) { porGrupo[s.group] = []; ordem.push(s.group); }
    porGrupo[s.group].push(s);
  });
  return ordem.map(function (g) { return { grupo: g, itens: porGrupo[g] }; });
}
function renderChecklistSecoes(marcadas) {
  // marcadas === null -> tudo marcado (função "admin"), mas esse caso
  // nem chega a chamar isso (checklist fica escondido, ver renderFuncionarios).
  var marcadasSet = {};
  (marcadas || []).forEach(function (k) { marcadasSet[k] = true; });
  return gruposSections().map(function (g) {
    return '<div class="secoes-checklist-grupo">'
      +   '<span class="secoes-checklist-grupo-label">' + esc(g.grupo) + '</span>'
      +   g.itens.map(function (s) {
            return '<label class="secoes-checklist-item"><input type="checkbox" value="' + s.key + '"' + (marcadasSet[s.key] ? " checked" : "") + '> ' + esc(s.label) + '</label>';
          }).join("")
      + '</div>';
  }).join("");
}
export function renderFuncionarios() {
  var lista = getFuncionarios();
  var funcoes = getFuncoes();
  var editando = state.funcionarios.editandoId
    ? lista.filter(function (f) { return f.id === state.funcionarios.editandoId; })[0]
    : null;
  var funcaoInicial = editando ? editando.funcao : (funcoes[0] ? funcoes[0].id : "admin");
  var secoesIniciais = editando && Array.isArray(editando.secoesPermitidas)
    ? editando.secoesPermitidas
    : secoesPermitidas(funcaoInicial);

  var funcoesEmUso = {};
  lista.forEach(function (f) { funcoesEmUso[f.funcao] = true; });

  document.getElementById("view-funcionarios").innerHTML = ''
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>Funções</h2><span class="meta">crie funções personalizadas além das funções padrão (Administrador, Cozinha, PDV, Garçom)</span></div>'
    +   '<form id="funcaoForm" class="add-form">'
    +     '<div><label for="novaFuncaoNome">Nova função</label><input id="novaFuncaoNome" placeholder="Ex.: Motoboy"></div>'
    +     '<div class="full"><button type="submit" class="btn primary">Adicionar função</button></div>'
    +   '</form>'
    +   '<div class="funcoes-lista">'
    +     funcoes.map(function (fn) {
            var travada = fn.id === "admin";
            var emUso = !!funcoesEmUso[fn.id];
            return '<span class="pill ' + (travada ? "good" : "neutral") + ' funcao-pill">' + esc(fn.label)
              + (!travada
                  ? '<button type="button" class="funcao-remover" data-id="' + fn.id + '" title="'
                    + (emUso ? "Função em uso — reatribua os funcionários antes de remover" : "Remover função")
                    + '"' + (emUso ? " disabled" : "") + '>&#10005;</button>'
                  : '')
              + '</span>';
          }).join("")
    +   '</div>'
    + '</div>'
    + '<div class="card panel">'
    +   '<div class="panel-head"><h2>' + (editando ? "Editar funcionário" : "Cadastrar funcionário") + '</h2>'
    +     '<span class="meta">a função sugere o acesso, mas dá pra ajustar por pessoa abaixo</span></div>'
    +   '<form id="funcForm" class="add-form">'
    +     '<div><label for="fNome">Nome</label><input id="fNome" required placeholder="Ex.: João Pedro" value="' + (editando ? esc(editando.nome) : "") + '"></div>'
    +     '<div><label for="fUsuario">Usuário (login)</label><input id="fUsuario" required placeholder="joao@casadopato.com" value="' + (editando ? esc(editando.usuario) : "") + '"></div>'
    +     '<div><label for="fSenha">Senha</label><input id="fSenha" type="password" autocomplete="new-password" placeholder="' + (editando ? "deixe em branco pra manter a atual" : "senha de acesso") + '"' + (editando ? "" : " required") + '></div>'
    +     '<div><label for="fFuncao">Função</label><select id="fFuncao">'
    +       funcoes.map(function (fn) {
              return '<option value="' + fn.id + '"' + (fn.id === funcaoInicial ? " selected" : "") + '>' + esc(fn.label) + '</option>';
            }).join("")
    +     '</select></div>'
    +     '<div class="full">'
    +       '<label>Onde pode acessar</label>'
    +       '<div id="fSecoesWrap">'
    +         (funcaoInicial === "admin"
                  ? '<p class="form-nota" id="fSecoesAdminNota">Administrador sempre vê todas as seções.</p>'
                  : '<div class="secoes-checklist" id="fSecoesChecklist">' + renderChecklistSecoes(secoesIniciais) + '</div>')
    +       '</div>'
    +     '</div>'
    +     '<div class="full" style="display:flex; gap:8px;">'
    +       '<button type="submit" class="btn primary">' + (editando ? "Salvar" : "Cadastrar") + '</button>'
    +       (editando ? '<button type="button" class="btn" id="fCancelarEdicao">Cancelar</button>' : '')
    +     '</div>'
    +   '</form>'
    + '</div>'
    + '<div class="card table-wrap">'
    +   '<table><thead><tr><th>Funcionário</th><th>Usuário</th><th>Função</th><th></th></tr></thead><tbody>'
    +   lista.map(function (f) {
          return '<tr><td><div class="name-cell"><span class="avatar-sm">' + initials(f.nome) + '</span>' + esc(f.nome) + '</div></td>'
            + '<td>' + esc(f.usuario) + '</td>'
            + '<td><span class="pill ' + (f.funcao === "admin" ? "good" : "neutral") + '">' + esc(funcaoLabel(f.funcao)) + '</span></td>'
            + '<td style="text-align:right;">'
            +   '<button class="btn small editar-func" data-id="' + f.id + '">Editar</button> '
            +   '<button class="btn ghost remover-func" data-id="' + f.id + '" title="Excluir">&#10005;</button>'
            + '</td></tr>';
        }).join("")
    +   '</tbody></table>'
    + '</div>';

  document.querySelectorAll(".editar-func").forEach(function (b) {
    b.addEventListener("click", function () {
      state.funcionarios.editandoId = b.getAttribute("data-id");
      renderFuncionarios();
    });
  });
  var cancelar = document.getElementById("fCancelarEdicao");
  if (cancelar) cancelar.addEventListener("click", function () {
    state.funcionarios.editandoId = null;
    renderFuncionarios();
  });
  document.querySelectorAll(".remover-func").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      var atual = getFuncionarios();
      var alvo = atual.filter(function (f) { return f.id === id; })[0];
      var totalAdmins = atual.filter(function (f) { return f.funcao === "admin"; }).length;
      if (alvo && alvo.funcao === "admin" && totalAdmins <= 1) {
        alert("Não é possível remover o último administrador do painel.");
        return;
      }
      saveFuncionarios(atual.filter(function (f) { return f.id !== id; }));
      renderFuncionarios();
    });
  });
  // Trocar a função re-sugere o checklist de acesso (ou some com ele, se
  // virar "admin") — a pessoa ainda pode ajustar antes de salvar.
  document.getElementById("fFuncao").addEventListener("change", function (e) {
    var funcaoId = e.target.value;
    var wrap = document.getElementById("fSecoesWrap");
    if (funcaoId === "admin") {
      wrap.innerHTML = '<p class="form-nota" id="fSecoesAdminNota">Administrador sempre vê todas as seções.</p>';
    } else {
      wrap.innerHTML = '<div class="secoes-checklist" id="fSecoesChecklist">' + renderChecklistSecoes(secoesPermitidas(funcaoId)) + '</div>';
    }
  });
  document.getElementById("funcaoForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nomeInput = document.getElementById("novaFuncaoNome");
    var nome = nomeInput.value.trim();
    if (!nome) return;
    // Mesmo jeito de tirar acento sem regex Unicode direto no código-fonte
    // que renderCategorias já usa (compatibilidade de encoding do arquivo).
    var semAcento = nome.toLowerCase().normalize("NFD");
    var semDiacriticos = "";
    for (var fi = 0; fi < semAcento.length; fi++) {
      var codeFi = semAcento.charCodeAt(fi);
      if (codeFi < 0x0300 || codeFi > 0x036f) semDiacriticos += semAcento[fi];
    }
    var slugFuncao = semDiacriticos.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    var id = "fn-" + (slugFuncao || Date.now()) + "-" + Date.now().toString(36);
    var atuais = getFuncoes();
    if (atuais.some(function (f) { return f.label.toLowerCase() === nome.toLowerCase(); })) {
      alert("Já existe uma função com esse nome.");
      return;
    }
    saveFuncoes(atuais.concat([{ id: id, label: nome, secoesPadrao: [] }]));
    renderFuncionarios();
  });
  document.querySelectorAll(".funcao-remover").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.disabled) return;
      var id = b.getAttribute("data-id");
      saveFuncoes(getFuncoes().filter(function (f) { return f.id !== id; }));
      renderFuncionarios();
    });
  });
  document.getElementById("funcForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("fNome").value.trim();
    var usuario = document.getElementById("fUsuario").value.trim();
    var senha = document.getElementById("fSenha").value;
    var funcao = document.getElementById("fFuncao").value;
    if (!nome || !usuario) return;
    var checklist = document.getElementById("fSecoesChecklist");
    var secoesPermitidasEscolhidas = checklist
      ? [].slice.call(checklist.querySelectorAll("input:checked")).map(function (i) { return i.value; })
      : null; // null = admin, secoesPermitidas() já resolve pra "tudo"
    var atual = getFuncionarios();
    if (editando) {
      saveFuncionarios(atual.map(function (f) {
        return f.id === editando.id
          ? Object.assign({}, f, {nome:nome, usuario:usuario, funcao:funcao, secoesPermitidas:secoesPermitidasEscolhidas}, senha ? {senha:senha} : {})
          : f;
      }));
      state.funcionarios.editandoId = null;
    } else {
      if (!senha) return;
      atual.push({id:"f-" + Date.now(), nome:nome, usuario:usuario, senha:senha, funcao:funcao, secoesPermitidas:secoesPermitidasEscolhidas});
      saveFuncionarios(atual);
    }
    renderFuncionarios();
  });
}
