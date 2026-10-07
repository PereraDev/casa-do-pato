import { NAV_TABS, CATEGORIES } from "../data/data.js";
import { useApp } from "../context/AppContext.jsx";
import { rolarParaSecao, MOTIVO_GARCOM } from "../utils/utils.js";

// Barra de topo fixa: marca, saudação (1º nome de quem está logado/
// visitante) e os atalhos de conta/acessibilidade/chamar garçom/busca/
// carrinho — o badge do carrinho lê `itensAtivos` (não `cart` direto), pra
// continuar certo durante um pedido em grupo (ver AppContext.jsx).
export function TopBar() {
  const {
    nomeExibicao,
    abrirConta,
    a11yBarOpen,
    setA11yBarOpen,
    garcomBarOpen,
    setGarcomBarOpen,
    setSearchOpen,
    abrirCarrinho,
    itensAtivos,
  } = useApp();
  const totalQtd = itensAtivos.reduce((a, c) => a + c.qtd, 0);

  return (
    <header className="topbar">
      <h1 className="brand">
        <img className="brand-mark" src="/logo-icon.png" alt="" width="32" height="32" />
        Casa do <em>Pato</em>
      </h1>
      <div className="topbar-actions">
        <span className="saudacao">Olá, {nomeExibicao().split(" ")[0]}</span>
        <button id="btnConta" className="icon-btn" aria-label="Sua conta" onClick={abrirConta}>
          👤
        </button>
        <button
          className="icon-btn"
          aria-label="Abrir opções de acessibilidade"
          aria-expanded={a11yBarOpen}
          onClick={() => setA11yBarOpen((v) => !v)}
        >
          ♿
        </button>
        <button
          className="icon-btn"
          aria-label="Chamar garçom"
          aria-expanded={garcomBarOpen}
          onClick={() => setGarcomBarOpen((v) => !v)}
        >
          🔔
        </button>
        <button
          id="btnBusca"
          className="icon-btn"
          aria-label="Buscar no cardápio"
          onClick={() => setSearchOpen((v) => !v)}
        >
          🔍
        </button>
        <button
          id="btnCarrinho"
          className="icon-btn"
          aria-label="Abrir carrinho de pedidos"
          onClick={abrirCarrinho}
        >
          🛒
          <span className="badge" hidden={totalQtd === 0}>
            {totalQtd}
          </span>
        </button>
      </div>
    </header>
  );
}

// Painel de opções de acessibilidade (toggle no ícone ♿ do TopBar): alto
// contraste, escala de fonte, reduzir movimento, leitura em voz alta,
// legendas da leitura e notificação push do navegador — cada botão só liga/
// desliga um pedaço de estado do AppContext, ver os efeitos correspondentes lá.
export function AccessibilityBar() {
  const {
    a11yBarOpen,
    contrasteAlto,
    toggleContraste,
    aumentarFonte,
    diminuirFonte,
    reduzirMovimento,
    toggleReduzirMovimento,
    leitorAtivo,
    toggleLeitor,
    legendasAtivas,
    toggleLegendas,
    notificacoesAtivas,
    pedirPermissaoNotificacao,
  } = useApp();

  return (
    <div
      className="a11y-bar"
      role="toolbar"
      aria-label="Opções de acessibilidade"
      hidden={!a11yBarOpen}
    >
      <span className="a11y-label">Acessibilidade</span>
      <button
        className="a11y-btn"
        aria-pressed={contrasteAlto}
        onClick={toggleContraste}
      >
        ◐ Alto contraste
      </button>
      <button
        className="a11y-btn"
        aria-label="Aumentar tamanho da fonte"
        onClick={aumentarFonte}
      >
        A+
      </button>
      <button
        className="a11y-btn"
        aria-label="Diminuir tamanho da fonte"
        onClick={diminuirFonte}
      >
        A-
      </button>
      <button
        className="a11y-btn"
        aria-pressed={reduzirMovimento}
        onClick={toggleReduzirMovimento}
      >
        ⏸ Reduzir movimento
      </button>
      <button
        className="a11y-btn"
        aria-pressed={leitorAtivo}
        onClick={toggleLeitor}
      >
        🔊 Descrever em voz alta
      </button>
      <button
        className="a11y-btn"
        aria-pressed={legendasAtivas}
        onClick={toggleLegendas}
      >
        💬 Legendas da leitura
      </button>
      <button
        className="a11y-btn"
        aria-pressed={notificacoesAtivas}
        onClick={pedirPermissaoNotificacao}
      >
        🔔 Notificações do navegador
      </button>
      <span className="a11y-spacer"></span>
    </div>
  );
}

// Barra de motivo ao chamar o garçom — antes era um botão único ("🔔"), que
// disparava a chamada na hora. Agora abre esta barra (mesmo molde da
// AccessibilityBar) pra escolher o motivo, que o admin vê na aba Mesas.
export function GarcomBar() {
  const { garcomBarOpen, setGarcomBarOpen, chamarGarcomAgora } = useApp();

  function escolher(motivo) {
    chamarGarcomAgora(motivo);
    setGarcomBarOpen(false);
  }

  return (
    <div
      className="a11y-bar garcom-bar"
      role="toolbar"
      aria-label="Motivo do chamado ao garçom"
      hidden={!garcomBarOpen}
    >
      <span className="a11y-label">🔔 Chamar por</span>
      {Object.entries(MOTIVO_GARCOM).map(([chave, label]) => (
        <button key={chave} type="button" className="a11y-btn" onClick={() => escolher(chave)}>
          {label}
        </button>
      ))}
      <span className="a11y-spacer"></span>
    </div>
  );
}

// Sugestões de pergunta livre pra IA — reduz a fricção de "não sei o que
// digitar" (ver AppContext#buscarComIA): 1 clique já dispara a busca, sem
// precisar pensar numa frase. De propósito abertas/vagas (não são nomes de
// prato) pra mostrar que a IA aqui é recomendação de verdade, não busca por
// palavra-chave.
const SUGESTOES_IA = [
  "Me surpreenda",
  "Algo leve e barato",
  "Pra compartilhar com a galera",
  "Só beliscar, sem fome",
  "O que combina com um dia quente?",
];

// Chips de categorias populares (estilo iFood), mostrados só com o campo de
// busca vazio, pra ajudar quem abriu a busca sem saber exatamente o que digitar.
// O botão "Perguntar à IA" é opt-in (só dispara no clique/Enter, nunca a cada
// tecla) — manda a mesma caixa de texto pro back-end como pergunta livre em
// vez de filtro por substring (ver AppContext#buscarComIA).
export function SearchBar() {
  const {
    searchOpen,
    setSearchOpen,
    termoBusca,
    setTermoBusca,
    iaResultado,
    iaCarregando,
    iaErro,
    buscarComIA,
    limparBuscaIA,
  } = useApp();

  function irParaCategoria(catId) {
    setSearchOpen(false);
    rolarParaSecao(catId);
  }

  function onChangeTermo(valor) {
    setTermoBusca(valor);
    if (iaResultado || iaErro) limparBuscaIA();
  }

  function onSubmit(e) {
    e.preventDefault();
    buscarComIA(termoBusca);
  }

  function onClicarSugestaoIA(sugestao) {
    setTermoBusca(sugestao);
    buscarComIA(sugestao);
  }

  return (
    <div className="search-row" hidden={!searchOpen}>
      <form className="busca-ia-form" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Buscar prato, ou pergunte: 'algo leve e barato'"
          autoComplete="off"
          value={termoBusca}
          onChange={(e) => onChangeTermo(e.target.value)}
        />
        <button
          type="submit"
          className="busca-ia-btn"
          disabled={!termoBusca.trim() || iaCarregando}
        >
          {iaCarregando ? "Pensando…" : "✨ Perguntar à IA"}
        </button>
      </form>

      {iaErro && <p className="busca-ia-erro">{iaErro}</p>}

      <div className="busca-sugestoes-ia" hidden={termoBusca.trim() !== "" || Boolean(iaResultado)}>
        {SUGESTOES_IA.map((s) => (
          <button
            key={s}
            type="button"
            className="busca-chip busca-chip-ia"
            onClick={() => onClicarSugestaoIA(s)}
          >
            ✨ {s}
          </button>
        ))}
      </div>

      {iaResultado && (
        <div className="busca-ia-resposta">
          <span>✨ {iaResultado.resposta}</span>
          <button type="button" aria-label="Limpar resposta da IA" onClick={limparBuscaIA}>
            ✕
          </button>
        </div>
      )}

      <div
        className="busca-sugestoes"
        hidden={termoBusca.trim() !== "" || Boolean(iaResultado)}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="busca-chip"
            onClick={() => irParaCategoria(cat.id)}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TabsNav() {
  const { tabAtiva, setTabAtiva } = useApp();

  function onClickTab(tab) {
    setTabAtiva(tab.id);

    if (!tab.cats) {
      // Início
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    rolarParaSecao(tab.cats[0]);
  }

  return (
    <nav className="tabs-nav" aria-label="Categorias do cardápio">
      <div className="tabs-track">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            className={"tab-pill" + (tabAtiva === tab.id ? " ativo" : "")}
            onClick={(e) => {
              onClickTab(tab);
              e.currentTarget.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
              });
            }}
          >
            {tab.icon ? tab.icon + " " : ""}
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// Navegação inferior fixa, só visível em telas pequenas (ver media query em
// style.css) — reaproveita as mesmas ações do topbar em vez de duplicar lógica.
export function BottomNav() {
  const {
    tabAtiva,
    irParaInicio,
    setSearchOpen,
    abrirCarrinho,
    abrirConta,
    itensAtivos,
  } = useApp();
  const totalQtd = itensAtivos.reduce((a, c) => a + c.qtd, 0);

  const ACOES = {
    inicio: irParaInicio,
    busca: () => setSearchOpen((v) => !v),
    carrinho: abrirCarrinho,
    perfil: abrirConta,
  };

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {[
        { id: "inicio", icon: "🏠", label: "Início" },
        { id: "busca", icon: "🔍", label: "Buscar" },
        { id: "carrinho", icon: "🛒", label: "Carrinho" },
        { id: "perfil", icon: "👤", label: "Perfil" },
      ].map((item) => (
        <button
          key={item.id}
          className={
            "bottom-nav-item" +
            (item.id === "inicio" && tabAtiva === "inicio" ? " ativo" : "")
          }
          aria-label={
            item.id === "inicio"
              ? "Ir para o início"
              : item.id === "busca"
                ? "Buscar no cardápio"
                : item.id === "carrinho"
                  ? "Abrir carrinho de pedidos"
                  : "Sua conta"
          }
          onClick={() => ACOES[item.id]()}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            {item.icon}
            {item.id === "carrinho" && (
              <span className="badge" hidden={totalQtd === 0}>
                {totalQtd}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
