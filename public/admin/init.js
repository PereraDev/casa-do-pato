// init.js — entry point do painel (carregado como
// `<script type="module" src="/admin/init.js">` em admin.html). Faz o
// bootstrap (login → shell → nav → render) e liga os eventos de topo que
// antes ficavam soltos no fim do script único (login/logout, hambúrguer
// do menu mobile, busca do rail).
import {
  state, api, socket, esc, initials, funcaoLabel, secoesPermitidas, carregarFuncoesCache, carregarFuncionariosCache,
  carregarCachesEmTempoReal, carregarUsuariosCache, carregarErpCache, initSocket
} from "./core.js";
import { buildShell, buildFilters, buildNav, goTo, renderAll, rerenderRelogio, openRail, closeRail, aplicarFiltroRail } from "./nav.js";
import { renderDashboard } from "./desempenho.js";

/* ============ INIT ============ */
// jaInicializado distingue a 1ª entrada (monta o shell/rail/filtros do zero)
// de um login seguinte na mesma aba (logout → login de outro funcionário):
// nesse caso só reconstrói o menu (a função pode ser diferente) e recarrega
// os caches, sem remontar DOM que já existe.
var jaInicializado = false;
function init() {
  document.getElementById("railAvatar").textContent = initials(state.usuarioLogado.nome);
  document.getElementById("railWho").innerHTML = esc(state.usuarioLogado.nome) + "<small>" + esc(funcaoLabel(state.usuarioLogado.funcao)) + "</small>";
  if (jaInicializado) {
    buildNav();
    goTo(secoesPermitidas(state.usuarioLogado)[0]);
    renderAll();
    carregarCachesEmTempoReal().then(renderAll);
    carregarUsuariosCache().then(renderAll);
    carregarErpCache().then(renderAll);
    return;
  }
  jaInicializado = true;
  buildShell();
  buildFilters();
  buildNav();
  goTo(secoesPermitidas(state.usuarioLogado)[0]);
  renderAll();
  // 1ª carga dos pedidos/chamados reais (o socket cuida de manter em dia
  // depois disso, ver initSocket) e das contas de cliente (sem tempo real
  // — recarrega a cada login/reload, suficiente pra essa lista).
  carregarCachesEmTempoReal().then(renderAll);
  carregarUsuariosCache().then(renderAll);
  carregarErpCache().then(renderAll);
  initSocket();
  window.addEventListener("resize", function () {
    if (state.activeSection === "dashboard") renderDashboard();
  });
  // Pedidos/mesas mudam sozinhos com o tempo (status calculado pelo
  // relógio, igual ao cliente) — reflete periodicamente. Pedidos/chamados
  // NOVOS chegam via Socket.IO (ver initSocket); este poll é só fallback.
  setInterval(rerenderRelogio, 3000);
}

document.getElementById("railSearch").addEventListener("input", aplicarFiltroRail);

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var erro = document.getElementById("loginError");
  var corpo = {
    usuario: document.getElementById("loginUser").value,
    senha: document.getElementById("loginPass").value
  };
  // Conta no servidor (senha com bcrypt): a resposta já traz função e seções do
  // funcionário. Funções e equipe carregam antes do init() porque o menu e as
  // seções permitidas dependem delas.
  api("/api/admin/login", { method: "POST", body: corpo }).then(function (funcionario) {
    state.usuarioLogado = funcionario;
    // Limpeza: versões antigas guardavam a equipe (com senha em texto puro) aqui.
    try { localStorage.removeItem("tnm_admin_funcionarios"); localStorage.removeItem("tnm_admin_funcoes"); } catch {}
    return Promise.all([carregarFuncoesCache(), carregarFuncionariosCache()]);
  }).then(function () {
    // O socket conecta quando a página carrega, ANTES do login, e o servidor só lê o
    // cookie no momento da conexão — sem reconectar, ele nunca é reconhecido como de
    // funcionário e não entra na sala "admin" (pedidos novos não chegam ao vivo).
    // initSocket() cuida do "connect" que vem a seguir (entra na sala e recarrega os caches).
    socket.disconnect();
    socket.connect();
    erro.style.display = "none";
    document.getElementById("loginPass").value = "";
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").style.display = "";
    init();
  }).catch(function (err) {
    state.usuarioLogado = null;
    erro.textContent = err.message;
    erro.style.display = "";
  });
});

document.getElementById("logoutBtn").addEventListener("click", function () {
  socket.emit("admin:sair");
  api("/api/admin/logout", { method: "POST" }).catch(function () {});
  state.usuarioLogado = null;
  state.funcoesCache = [];
  state.funcionariosCache = [];
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
});

document.getElementById("hamburgerBtn").addEventListener("click", openRail);
document.getElementById("railOverlay").addEventListener("click", closeRail);
