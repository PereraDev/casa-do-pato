import { useEffect, useRef, useState } from "react";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import { TopBar, AccessibilityBar, GarcomBar, SearchBar, TabsNav, BottomNav } from "./components/header.jsx";
import { MenuSections, FidelidadeBanner, OfertaPersonalizada, FavoritesSheet } from "./components/menu.jsx";
import { ProductSheet } from "./components/product.jsx";
import { CartDrawer } from "./components/cart.jsx";
import { PixSheet } from "./components/checkout.jsx";
import { OrdersSheet } from "./components/orders.jsx";
import {
  AccountSheet,
  FidelidadeSheet,
  ExtratoSheet,
  CarteiraSheet,
  ReservaMesaSheet,
} from "./components/account.jsx";

// Layout raiz da SPA. Não há router: tudo que aparece aqui fica sempre
// montado ao mesmo tempo — o que muda de tela em tela é só o estado
// dentro do AppContext, e os modais (sheets) alternam entre visível/`inert`
// (ver ModalSheet mais abaixo) em vez de montar/desmontar.
//
// Import circular de propósito: header.jsx/menu.jsx/etc. importam ModalSheet
// de volta daqui, e este arquivo importa componentes de cada área. Funciona
// porque cada import só é usado dentro de corpo de função/JSX, nunca
// avaliado no topo do módulo.
export default function App() {
  return (
    <AppProvider>
      {/* Link de acessibilidade: só fica visível ao ganhar foco via Tab,
          permite pular a barra de topo inteira e ir direto pro conteúdo. */}
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      {/* Header fixo: marca/saudação/atalhos, barra de acessibilidade,
          barra de motivo do chamado de garçom, busca e abas de categoria. */}
      <div className="header-fixo">
        <TopBar />
        <AccessibilityBar />
        <GarcomBar />
        <SearchBar />
        <TabsNav />
      </div>

      <div className="app-shell">
        <main id="conteudo">
          {/* Faixa de nível/pontos/cashback do clube de fidelidade — só
              entrada pra abrir o FidelidadeSheet, ver "Navegação/roteamento"
              no CLAUDE.md. */}
          <FidelidadeBanner />
          {/* Banner de cupom automático pra quem está ≥3 dias sem pedir. */}
          <OfertaPersonalizada />
          <div id="secoesCardapio">
            <MenuSections />
          </div>
        </main>
      </div>

      {/* Nav fixa mobile (início/busca/carrinho/perfil). */}
      <BottomNav />
      {/* Prompt flutuante "como foi o atendimento?" após um chamado de
          garçom deste cliente ser atendido — ver componente abaixo. */}
      <AvaliarGarcomPrompt />
      {/* Legenda do que está sendo lido em voz alta (modo acessibilidade). */}
      <LegendaFlutuante />

      {/* Os 10 sheets/modais do app, todos construídos sobre ModalSheet e
          sempre presentes no DOM (ver comentário do componente abaixo) —
          cada um controla sua própria visibilidade lendo o Context. */}
      <ProductSheet />
      <CartDrawer />
      <PixSheet />
      <AccountSheet />
      <FavoritesSheet />
      <OrdersSheet />
      <FidelidadeSheet />
      <ExtratoSheet />
      <CarteiraSheet />
      <ReservaMesaSheet />

      {/* Notificação simples de rodapé (autodesaparece), ver Toast abaixo. */}
      <Toast />
    </AppProvider>
  );
}

// Lista todos os elementos "tabuláveis" dentro de um container — usado pelo
// ModalSheet pra saber quem é o 1º/último elemento do modal, na hora de
// prender o foco (Tab no último volta pro primeiro, Shift+Tab no primeiro
// vai pro último).
function elementosFocaveis(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * Sheet/drawer modal reutilizável (produto, carrinho, pix, conta) — junta o
 * padrão de acessibilidade que os 4 modais do app original compartilhavam:
 * fica sempre no DOM (`inert` quando fechado, em vez de desmontar), prende o
 * foco dentro dele com Tab enquanto aberto, e devolve o foco pra quem abriu
 * o modal ao fechar. Em React isso é mais simples que no vanilla: o efeito
 * só roda quando `open` muda, então não precisa da checagem de idempotência
 * que o original precisava pro Escape fechando os 4 modais de uma vez.
 */
export function ModalSheet({
  open,
  as: Tag = "section", // elemento raiz configurável (section/aside/etc.)
  className,
  ariaLabel,
  onOverlayClick, // clique no fundo escurecido — cada sheet decide se fecha ou não
  overlayClassName,
  children,
}) {
  const sheetRef = useRef(null);
  // Guarda o elemento que tinha foco ANTES de abrir o modal, pra devolver o
  // foco exatamente ali quando ele fechar (essencial pra navegação por
  // teclado/leitor de tela não "perder o lugar").
  const focoAnteriorRef = useRef(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    if (open) {
      focoAnteriorRef.current = document.activeElement;
      sheet.removeAttribute("inert");
      // Ao abrir, joga o foco pro 1º elemento focável de dentro do sheet
      // (não necessariamente o primeiro botão visual — é a ordem do DOM).
      elementosFocaveis(sheet)[0]?.focus();

      // "Focus trap": intercepta Tab/Shift+Tab nas bordas do modal pra não
      // deixar o foco escapar pro resto da página enquanto ele está aberto.
      function aprisionarFoco(e) {
        if (e.key !== "Tab") return;
        const itens = elementosFocaveis(sheet);
        if (!itens.length) return;
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
      sheet.addEventListener("keydown", aprisionarFoco);
      return () => sheet.removeEventListener("keydown", aprisionarFoco);
    }

    // Fechado: em vez de desmontar (que perderia estado interno do sheet e
    // complicaria animação de transição), marca `inert` — o navegador então
    // ignora foco/clique/leitor de tela dentro dele automaticamente — e
    // devolve o foco pra quem tinha aberto o modal, se esse elemento ainda
    // existir no DOM.
    sheet.setAttribute("inert", "");
    const anterior = focoAnteriorRef.current;
    if (anterior && document.contains(anterior)) anterior.focus();
  }, [open]);

  return (
    <>
      <div
        className={overlayClassName + (open ? " aberto" : "")}
        onClick={onOverlayClick}
      />
      <Tag
        ref={sheetRef}
        className={className + (open ? " aberto" : "")}
        aria-label={ariaLabel}
        aria-modal="true"
        role="dialog"
        inert={!open}
      >
        {children}
      </Tag>
    </>
  );
}

// Notificação simples de rodapé: lê `toast` do Context ({msg, visible}) —
// AppContext cuida de setar `visible: false` sozinho depois de 2.6s.
export function Toast() {
  const { toast } = useApp();
  return (
    <div className={"toast" + (toast.visible ? " mostrar" : "")} role="status">
      {toast.msg}
    </div>
  );
}

// Legenda flutuante do que está sendo lido em voz alta (ver
// AppContext#falarTexto) — modo "legendas" independente do leitor de voz
// em si, pra quem quer acompanhar o texto sem áudio ou como reforço visual.
export function LegendaFlutuante() {
  const { legendasAtivas, legendaAtual } = useApp();
  if (!legendasAtivas || !legendaAtual) return null;

  return (
    <div className="legenda-flutuante" role="status" aria-live="polite">
      💬 {legendaAtual}
    </div>
  );
}

// Prompt "como foi o atendimento?" — aparece quando um chamado de garçom
// feito por este cliente foi atendido pelo admin mas ainda não tem nota.
// Fecha o loop com a aba Garçons do painel administrativo, que já mede
// tempo de resposta por funcionário mas nunca recebia avaliação de quem
// foi atendido.
export function AvaliarGarcomPrompt() {
  const { chamadaPendenteAvaliacao, avaliarGarcom } = useApp();
  // Dispensar (✕) sem dar nota não deve fazer o prompt reaparecer sozinho
  // pro mesmo chamado — guarda os ids já dispensados só em memória (não
  // persiste; recarregar a página deixa o prompt voltar, o que é aceitável
  // pois normalmente a avaliação já teria acontecido antes disso).
  const [dispensadas, setDispensadas] = useState([]);
  const chamada = chamadaPendenteAvaliacao();

  if (!chamada || dispensadas.includes(chamada.id)) return null;

  return (
    <div className="avaliar-garcom-prompt" role="status">
      <span className="avaliar-garcom-texto">Como foi o atendimento do garçom?</span>
      <div className="star-picker" role="radiogroup" aria-label="Nota do atendimento">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onClick={() => avaliarGarcom(chamada.id, n)}
          >
            ★
          </button>
        ))}
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dispensar"
        onClick={() => setDispensadas((prev) => [...prev, chamada.id])}
      >
        ✕
      </button>
    </div>
  );
}
