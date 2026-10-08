import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ADDON_GROUPS,
  baixarEstoque,
  COUPONS,
  MENU,
  REVIEWS_MOCK,
} from "../data/data.js";
import {
  fmt,
  precoBase,
  estimarTempoFila,
  PAGAMENTO_CHECKOUT,
  PAGAMENTO_LABEL,
  STATUS_ICONE,
  STATUS_LABEL,
  statusPedido,
  adicionarSaldoCarteira,
  creditarCompra,
  getContaFidelidade,
  resgatarRecompensa,
  usarCashback as debitarCashback,
  aplicarCodigoIndicacao,
  ASSINATURA_DESCONTO_PCT,
  definirAssinatura,
  getAssinatura,
  getCodigoIndicacao,
  getOfertaPersonalizada,
  progressoMissaoSemanal,
  resgatarMissaoSemanal,
  totalIndicados,
  comprarValePresente as comprarValePresenteUtil,
  conferirPinCarteira as conferirPinCarteiraUtil,
  definirPinCarteira as definirPinCarteiraUtil,
  removerCartao as removerCartaoUtil,
  resgatarValePresente as resgatarValePresenteUtil,
  salvarCartao as salvarCartaoUtil,
  cancelarReserva as cancelarReservaUtil,
  criarReserva as criarReservaUtil,
  apiFetch,
  ApiError,
  socket,
  useLocalStorageState,
  useLocalStorageString,
} from "../utils/utils.js";

/* ==========================================================================
   AppContext — equivalente ao objeto `state` global + funções soltas do
   tanamesa/js/app.js original, só que reescrito no molde React: cada pedaço
   de estado vira um useState (persistido em localStorage quando o original
   também persistia), e as funções que antes mutavam `state` direto e
   chamavam renderX() na mão agora só chamam os setters — quem decide
   re-renderizar é o próprio React, componente por componente.
   ========================================================================== */

const AppContext = createContext(null);

/**
 * Duas personalizações são "iguais" se tiverem os mesmos adicionais pagos e
 * os mesmos ingredientes removidos, ignorando a ordem. Usado por
 * adicionarItemAoCarrinho pra decidir se soma numa linha já existente do
 * carrinho em vez de criar uma linha duplicada pro mesmo item.
 */
function mesmaPersonalizacao(addonsA, addonsB, removidosA, removidosB) {
  const chaveAddons = (lista) =>
    JSON.stringify([...lista].sort((a, b) => a.nome.localeCompare(b.nome)));
  const chaveRemovidos = (lista) => JSON.stringify([...lista].sort());
  return (
    chaveAddons(addonsA) === chaveAddons(addonsB) &&
    chaveRemovidos(removidosA || []) === chaveRemovidos(removidosB || [])
  );
}

export function AppProvider({ children }) {
  /* ---------------- Carrinho + informações do pedido (persistidos) ------ */
  const [cart, setCart] = useLocalStorageState("tnm_cart", []);
  const [tipoPedido, setTipoPedido] = useLocalStorageString(
    "tnm_tipo_pedido",
    "balcao",
  );
  const [formaPagamento, setFormaPagamento] = useLocalStorageString(
    "tnm_pagamento",
    "pix",
  );
  // Só relevante quando tipoPedido === "mesa": decide entre pagar no ato
  // (cai no fluxo normal de Pix/Cartão/Dinheiro) ou fechar a conta depois,
  // do jeito que se paga de verdade numa mesa de restaurante — ver
  // FormaPagamento.jsx.
  const [pagamentoTiming, setPagamentoTiming] = useLocalStorageString(
    "tnm_pagamento_timing",
    "agora",
  );
  const [pagarDepoisComo, setPagarDepoisComo] = useLocalStorageString(
    "tnm_pagar_depois_como",
    "garcom",
  );
  // Cartão: id de um cartão salvo na Carteira (ver utils/carteira.js), ou
  // "motoboy" (só entrega — pagar na maquininha de quem entrega).
  const [cartaoEscolhidoId, setCartaoEscolhidoId] = useLocalStorageString(
    "tnm_cartao_escolhido",
    "",
  );
  // Dinheiro: "carteira" usa o saldo de cashback (liga
  // usarCashbackNoCarrinho automaticamente, ver escolherOpcaoDinheiro
  // abaixo) ou "nota" é dinheiro físico de verdade, com calculadora de
  // troco — mesmo cálculo que o PDV do admin já tinha, mas do lado do
  // cliente. precisaTroco/valorTroco não persistem: é um detalhe pontual
  // desse checkout específico, sem sentido sobreviver a um recarregamento.
  const [dinheiroOpcao, setDinheiroOpcao] = useLocalStorageString(
    "tnm_dinheiro_opcao",
    "nota",
  );
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [valorTroco, setValorTroco] = useState("");
  const [numeroMesa, setNumeroMesa] = useLocalStorageString("tnm_mesa", "");
  const [enderecoEntrega, setEnderecoEntrega] = useLocalStorageString(
    "tnm_endereco",
    "",
  );
  const [observacoes, setObservacoes] = useLocalStorageString("tnm_obs", "");
  const [cupomAplicado, setCupomAplicado] = useLocalStorageState(
    "tnm_cupom",
    null,
  );
  const [pessoasDivisao, setPessoasDivisao] = useLocalStorageState(
    "tnm_pessoas",
    1,
    { serialize: String, deserialize: Number },
  );
  const [usarCashbackNoCarrinho, setUsarCashbackNoCarrinho] =
    useLocalStorageState("tnm_usar_cashback", false);
  // agendamento: null = "assim que possível"; senão {data:"AAAA-MM-DD", hora:"HH:MM"}
  // — não existe mais pra tipoPedido "mesa" (sem sentido agendar horário
  // de quem já está sentada à mesa; virou "Reservar mesa" no perfil, ver
  // ReservaMesaSheet.jsx). Limpa sozinho se o pedido virar "mesa" com um
  // agendamento herdado de balcão/entrega.
  const [agendamento, setAgendamento] = useLocalStorageState(
    "tnm_agendamento",
    null,
  );
  useEffect(() => {
    if (tipoPedido === "mesa" && agendamento) setAgendamento(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a tipoPedido virar "mesa", não a toda mudança de agendamento
  }, [tipoPedido]);
  const [enderecos, setEnderecos] = useLocalStorageState("tnm_enderecos", []);
  const [divisaoPagamentos, setDivisaoPagamentos] = useLocalStorageState(
    "tnm_divisao_pagamentos",
    ["pix"],
  );
  // divisaoModo: só importa dentro de um pedido em grupo (só aí cada item
  // carrega participanteNome pra dar pra dividir "por pedido"); "porPedido"
  // é o padrão porque é o caso mais útil quando o grupo tem >1 pessoa com
  // item no carrinho — ver valoresDivisaoPorParticipante.
  const [divisaoModo, setDivisaoModo] = useState("porPedido");
  const [divisaoPagamentosPorNome, setDivisaoPagamentosPorNome] = useState({});
  function definirPagamentoDivisaoPorNome(nome, forma) {
    setDivisaoPagamentosPorNome((prev) => ({ ...prev, [nome]: forma }));
  }
  // grupoAtivo: null (pedido normal) ou {codigo, participanteId, nome} —
  // identidade de qual grupo/participante ESTE DISPOSITIVO é, então continua
  // por dispositivo mesmo (localStorage). Persistido pra sobreviver a um
  // recarregamento no meio de um pedido em grupo.
  const [grupoAtivo, setGrupoAtivo] = useLocalStorageState(
    "tnm_grupo_ativo",
    null,
  );
  // grupoObj: o carrinho compartilhado em si, agora vem do back-end (server/)
  // — busca o snapshot ao entrar/criar o grupo e entra na room Socket.IO
  // "grupo:<codigo>" pra receber os diffs em tempo real (substitui o antigo
  // evento "storage", que só sincronizava entre abas do MESMO navegador —
  // ver CLAUDE.md, "Pedido em grupo").
  const [grupoObj, setGrupoObj] = useState(null);
  useEffect(() => {
    if (!grupoAtivo) {
      setGrupoObj(null);
      setDivisaoPagamentosPorNome({});
      return;
    }
    let cancelado = false;
    apiFetch(`/api/grupo/${grupoAtivo.codigo}`)
      .then((g) => {
        if (!cancelado) setGrupoObj(g);
      })
      .catch(() => {});
    socket.emit("grupo:entrar-sala", grupoAtivo.codigo);
    return () => {
      cancelado = true;
      socket.emit("grupo:sair-sala", grupoAtivo.codigo);
    };
  }, [grupoAtivo]);
  useEffect(() => {
    function onParticipanteEntrou(p) {
      setGrupoObj((g) => g && { ...g, participantes: [...g.participantes, p] });
    }
    function onParticipanteSaiu({ id }) {
      setGrupoObj((g) => g && { ...g, participantes: g.participantes.filter((p) => p.id !== id) });
    }
    function onItemAdicionado(item) {
      setGrupoObj((g) => g && { ...g, itens: [...g.itens, item] });
    }
    function onItemRemovido({ id }) {
      setGrupoObj((g) => g && { ...g, itens: g.itens.filter((it) => it.id !== id) });
    }
    function onItemAlterado(item) {
      setGrupoObj((g) => g && { ...g, itens: g.itens.map((it) => (it.id === item.id ? item : it)) });
    }
    function onLimpo() {
      setGrupoObj((g) => g && { ...g, itens: [] });
    }
    socket.on("grupo:participante-entrou", onParticipanteEntrou);
    socket.on("grupo:participante-saiu", onParticipanteSaiu);
    socket.on("grupo:item-adicionado", onItemAdicionado);
    socket.on("grupo:item-removido", onItemRemovido);
    socket.on("grupo:item-alterado", onItemAlterado);
    socket.on("grupo:limpo", onLimpo);
    return () => {
      socket.off("grupo:participante-entrou", onParticipanteEntrou);
      socket.off("grupo:participante-saiu", onParticipanteSaiu);
      socket.off("grupo:item-adicionado", onItemAdicionado);
      socket.off("grupo:item-removido", onItemRemovido);
      socket.off("grupo:item-alterado", onItemAlterado);
      socket.off("grupo:limpo", onLimpo);
    };
  }, []);

  /* ---------------- Avaliações, favoritos, pedidos (persistidos) -------- */
  const [reviewsUser, setReviewsUser] = useLocalStorageState(
    "tnm_reviews_user",
    {},
  );
  const [favoritos, setFavoritos] = useLocalStorageState("tnm_favoritos", []);
  const [favoritosPersonalizados, setFavoritosPersonalizados] =
    useLocalStorageState("tnm_favoritos_personalizados", []);
  // pedidos: agora vem do back-end (server/), não mais de localStorage —
  // "meus pedidos" (conta logada ou visitante, pela sessão via cookie) é
  // buscado no mount e mantido em dia por eventos de socket (ver useEffects
  // logo abaixo de sessao). Ver CLAUDE.md, "Pedidos / histórico".
  const [pedidos, setPedidos] = useState([]);
  // Fila pública mínima (todos os pedidos ativos, não só os meus) — só pra
  // utils/pedidos.js#estimarTempoFila calcular quantos estão "na frente".
  const [filaAtiva, setFilaAtiva] = useState([]);
  function recarregarPedidos() {
    apiFetch("/api/pedidos/meus")
      .then(setPedidos)
      .catch(() => {});
  }

  /* ---------------- Conta / sessão (agora vem do back-end) --------------- */
  const [sessao, setSessao] = useState({
    tipo: "visitante",
    nome: "Visitante",
  });
  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(setSessao)
      .catch(() => {});
    recarregarPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Patch ao vivo de status/cancelamento vindo do KDS/cancelamento do admin
  // (substitui a necessidade de recarregar a página pra ver o pedido mudar).
  useEffect(() => {
    function onPedidoAtualizado({ id, statusManual, _canceladoAdmin }) {
      setPedidos((prev) =>
        prev.some((p) => p.id === id)
          ? prev.map((p) => (p.id === id ? { ...p, statusManual, _canceladoAdmin } : p))
          : prev,
      );
    }
    socket.on("pedido:atualizado", onPedidoAtualizado);
    return () => socket.off("pedido:atualizado", onPedidoAtualizado);
  }, []);

  /* ---------------- Navegação / busca (transiente) ----------------------- */
  const [tabAtiva, setTabAtiva] = useState("inicio");
  const [termoBusca, setTermoBusca] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // Busca por IA (opt-in, um clique — nunca dispara sozinha a cada tecla):
  // manda a pergunta em linguagem livre + o catálogo pro back-end, que
  // devolve uma frase curta e os ids mais relevantes (ver
  // server/src/routes/ia.js, que usa o Gemini). Sem GEMINI_API_KEY
  // configurada no servidor, a rota responde 503 e a UI cai de volta pra
  // busca por texto normal — nunca quebra o cardápio.
  const [iaResultado, setIaResultado] = useState(null);
  const [iaCarregando, setIaCarregando] = useState(false);
  const [iaErro, setIaErro] = useState(null);
  function buscarComIA(pergunta) {
    const texto = pergunta.trim();
    if (!texto) return;
    setIaCarregando(true);
    setIaErro(null);
    apiFetch("/api/ia/busca", {
      method: "POST",
      body: {
        pergunta: texto,
        itens: MENU.map((m) => ({
          id: m.id,
          nome: m.nome,
          categoria: m.cat,
          preco: m.precoPromo ?? m.preco,
          tag: m.tag,
          desc: m.desc,
        })),
      },
    })
      .then((r) => setIaResultado(r))
      .catch((err) =>
        setIaErro(err.message || "Não foi possível buscar com IA agora, tente de novo."),
      )
      .finally(() => setIaCarregando(false));
  }
  function limparBuscaIA() {
    setIaResultado(null);
    setIaErro(null);
  }

  /* ---------------- Ficha do produto aberto (transiente) ------------------ */
  const [produtoAtual, setProdutoAtual] = useState(null);
  const [qtdAtual, setQtdAtual] = useState(1);
  const [selecaoAddons, setSelecaoAddons] = useState({});
  const [selecaoIngredientes, setSelecaoIngredientes] = useState({});
  const [pedidoAvaliandoId, setPedidoAvaliandoId] = useState(null);

  /* ---------------- Modais abertos (transiente) --------------------------- */
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [contaOpen, setContaOpen] = useState(false);
  const [favoritosOpen, setFavoritosOpen] = useState(false);
  const [pedidosOpen, setPedidosOpen] = useState(false);
  const [fidelidadeOpen, setFidelidadeOpen] = useState(false);
  const [extratoOpen, setExtratoOpen] = useState(false);
  const [reservasOpen, setReservasOpen] = useState(false);
  const ultimaChamadaGarcomRef = useRef(0);
  const pedidoPendenteRef = useRef(null);
  // Ids dos chamados de garçom feitos POR ESTE cliente — não tem sessão de
  // garçom real, então é assim que sabemos qual chamado (já atendido) pedir
  // pra esse cliente avaliar (ver chamadaPendenteAvaliacao).
  const [minhasChamadasIds, setMinhasChamadasIds] = useLocalStorageState(
    "tnm_minhas_chamadas",
    [],
  );

  /* ---------------- Checkout Pix/Cartão/Dinheiro (transiente) ------------- */
  const [pixEtapa, setPixEtapa] = useState("aguardando"); // aguardando | confirmado | preparo
  const [pixCarregando, setPixCarregando] = useState(false);
  const timeoutsRef = useRef([]);
  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), []);

  /* ---------------- Acessibilidade (transiente, como no original) -------- */
  const [contrasteAlto, setContrasteAlto] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  const [leitorAtivo, setLeitorAtivo] = useState(false);
  const [legendasAtivas, setLegendasAtivas] = useState(false);
  const [legendaAtual, setLegendaAtual] = useState("");
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const [a11yBarOpen, setA11yBarOpen] = useState(false);
  const [garcomBarOpen, setGarcomBarOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("contraste-alto", contrasteAlto);
  }, [contrasteAlto]);
  useEffect(() => {
    document.body.classList.toggle("reduzir-movimento", reduzirMovimento);
  }, [reduzirMovimento]);
  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", fontScale);
  }, [fontScale]);

  // Fala um texto (motor único, reusado pela leitura por foco abaixo e pelo
  // resumo em voz do pedido antes de confirmar — ver PixSheet). Sempre
  // atualiza a legenda flutuante também, mesmo com o modo desligado: é só
  // texto guardado em memória, não custa nada, e assim ligar/desligar a
  // legenda no meio de uma leitura não perde a frase atual.
  function falarTexto(texto) {
    setLegendaAtual(texto);
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = "pt-BR";
    window.speechSynthesis.speak(utter);
  }

  // Leitura em voz alta ao focar cards/adicionais/avaliações (só liga o
  // listener enquanto o recurso está ativo).
  useEffect(() => {
    if (!leitorAtivo) return;
    function onFocusIn(e) {
      const card = e.target.closest(".item-card");
      if (card) {
        const nome = card.querySelector("h3")?.textContent;
        const preco = card.querySelector(".item-preco")?.textContent;
        if (nome) falarTexto(`${nome}, ${preco}`);
        return;
      }
      const addonItem = e.target.closest(".addon-item");
      if (addonItem) {
        const nome = addonItem.querySelector(".addon-nome")?.textContent;
        const preco = addonItem.querySelector(".addon-preco")?.textContent;
        if (nome) falarTexto(`${nome}, ${preco}`);
        return;
      }
      const review = e.target.closest(".review-item");
      if (review) {
        const autor = review.querySelector(".review-autor")?.textContent;
        const nota = review.querySelectorAll(
          ".estrelas span:not(.vazia)",
        ).length;
        const comentario = review.querySelector(
          ".review-comentario",
        )?.textContent;
        falarTexto(`Avaliação de ${autor}, ${nota} de 5 estrelas. ${comentario}`);
      }
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leitorAtivo]);

  // Resumo em voz do pedido inteiro antes de confirmar o pagamento — só
  // com o leitor ativo, disparado quando o checkout abre (ver PixSheet).
  function falarResumoPedido() {
    if (!leitorAtivo) return;
    const pedido = pedidoPendenteRef.current;
    if (!pedido || !pedido.itens.length) return;
    const itensFalados = pedido.itens
      .map((it) => `${it.qtd} ${it.nome}`)
      .join(", ");
    falarTexto(
      `Confira seu pedido: ${itensFalados}. Total: ${fmt(pedido.total)}, pagamento em ${PAGAMENTO_LABEL[pedido.pagamento] || pedido.pagamento}.`,
    );
  }

  /* ---------------- Toast ------------------------------------------------- */
  const [toast, setToast] = useState({ msg: "", visible: false });
  const toastTimerRef = useRef(null);
  function showToast(msg) {
    setToast({ msg, visible: true });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast((s) => ({ ...s, visible: false })),
      2600,
    );
  }

  /* ---------------- Escape fecha todos os modais -------------------------- */
  // No React isso é naturalmente "idempotente": setar um estado que já é
  // false não dispara re-render nem efeito de fechamento de novo, então o
  // bug do protótipo original (fechar 1 modal "roubava" o foco de volta por
  // causa dos outros 3 já fechados) não existe aqui.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      setCartOpen(false);
      setProductSheetOpen(false);
      setProdutoAtual(null);
      setPedidoAvaliandoId(null);
      setPixOpen(false);
      setContaOpen(false);
      setFavoritosOpen(false);
      setPedidosOpen(false);
      setFidelidadeOpen(false);
      setExtratoOpen(false);
      setCarteiraOpen(false);
      setCarteiraDesbloqueada(false);
      setReservasOpen(false);
      setGarcomBarOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ---------------- Notificação automática de status (toast) ------------- */
  // Compara o status atual de cada pedido com o último visto e dispara um
  // toast quando muda (ex.: "Pedido pronto!"), mesmo com a aba "Pedidos"
  // fechada. statusTick só existe pra forçar quem estiver olhando o stepper
  // a recalcular o status (que é puramente função do tempo) a cada 3s.
  const pedidosRef = useRef(pedidos);
  useEffect(() => {
    pedidosRef.current = pedidos;
  }, [pedidos]);
  const statusConhecidoRef = useRef({});
  const [statusTick, setStatusTick] = useState(0);
  useEffect(() => {
    function checar() {
      if (!pedidosRef.current.length) return;
      pedidosRef.current.forEach((pedido) => {
        const atual = statusPedido(pedido);
        const anterior = statusConhecidoRef.current[pedido.id];
        if (anterior !== undefined && anterior !== atual) {
          showToast(
            `${STATUS_ICONE[atual]} Pedido #${pedido.id}: ${STATUS_LABEL[atual]}!`,
          );
          // Notificação nativa do navegador — funciona mesmo com a aba em
          // segundo plano ou minimizada, ao contrário do toast (que só
          // aparece com a aba visível). Só dispara se a pessoa já concedeu
          // permissão (ver pedirPermissaoNotificacao).
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(`Pedido #${pedido.id}: ${STATUS_LABEL[atual]}`, {
              body: STATUS_ICONE[atual] + " Casa do Pato",
              tag: "tnm-pedido-" + pedido.id,
            });
          }
        }
        statusConhecidoRef.current[pedido.id] = atual;
      });
    }
    function carregarFila() {
      apiFetch("/api/pedidos/fila")
        .then(setFilaAtiva)
        .catch(() => {});
    }
    checar(); // linha de base, sem notificar pedidos antigos ao carregar a página
    carregarFila();
    const id = setInterval(() => {
      checar();
      carregarFila();
      setStatusTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chamado de garçom feito por este cliente, já atendido pelo admin, mas
  // ainda sem nota do cliente — usado pra mostrar o prompt "como foi o
  // atendimento?" (ver TopBar/PedidoInfo). Preenchido por socket (evento
  // "garcom:atendida" na room "chamada:<id>", ver chamarGarcomAgora) +
  // uma checagem de catch-up no mount (caso a resposta do admin tenha vindo
  // com a aba fechada).
  const [chamadaParaAvaliar, setChamadaParaAvaliar] = useState(null);
  useEffect(() => {
    if (!minhasChamadasIds.length) return;
    minhasChamadasIds.forEach((id) => socket.emit("garcom:acompanhar", id));
    apiFetch(`/api/garcom/chamadas/minhas?ids=${minhasChamadasIds.join(",")}`)
      .then((chamadas) => {
        const pendente = chamadas.find((c) => c.atendidoEm && c.notaCliente == null);
        if (pendente) setChamadaParaAvaliar(pendente);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    function onAtendida(chamada) {
      if (minhasChamadasIds.includes(chamada.id) && chamada.notaCliente == null) {
        setChamadaParaAvaliar(chamada);
      }
    }
    socket.on("garcom:atendida", onAtendida);
    return () => socket.off("garcom:atendida", onAtendida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minhasChamadasIds]);
  function chamadaPendenteAvaliacao() {
    return chamadaParaAvaliar;
  }
  function avaliarGarcom(chamadaId, nota) {
    apiFetch(`/api/garcom/chamadas/${chamadaId}/avaliar`, { method: "PATCH", body: { nota } })
      .then(() => {
        setChamadaParaAvaliar(null);
        showToast("Obrigado por avaliar o atendimento! ⭐");
      })
      .catch(() => showToast("Não foi possível registrar sua avaliação"));
  }

  /* ---------------- Navegação -------------------------------------------- */
  function irParaInicio() {
    setTabAtiva("inicio");
    setContaOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- Favoritos --------------------------------------------- */
  // itemId está na lista de favoritos deste dispositivo?
  function isFavorito(itemId) {
    return favoritos.includes(itemId);
  }
  // Favorita/desfavorita um item do cardápio (não confundir com
  // favoritosPersonalizados — "combos" salvos com adicionais/ingredientes
  // específicos, ver bloco abaixo).
  function toggleFavorito(itemId) {
    const favoritado = favoritos.includes(itemId);
    setFavoritos((prev) =>
      favoritado ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
    showToast(favoritado ? "Removido dos favoritos" : "Adicionado aos favoritos ♥");
  }

  /* ---------------- Ficha do produto -------------------------------------- */
  // Abre o ProductSheet pro item `id`, resetando quantidade/adicionais/
  // ingredientes pra um estado limpo (mesmo produto aberto de novo depois
  // não herda seleção de uma visita anterior) e fechando os outros sheets
  // que poderiam estar abertos por baixo (conta/favoritos/pedidos).
  function abrirProduto(id) {
    const item = MENU.find((m) => m.id === id);
    if (!item) return;
    setProdutoAtual(item);
    setQtdAtual(1);
    const addonsIniciais = {};
    (item.addons || []).forEach((g) => (addonsIniciais[g] = {}));
    setSelecaoAddons(addonsIniciais);
    setSelecaoIngredientes({});
    setContaOpen(false);
    setFavoritosOpen(false);
    setPedidosOpen(false);
    setFidelidadeOpen(false);
    setProductSheetOpen(true);
  }
  function fecharProduto() {
    setProductSheetOpen(false);
    setProdutoAtual(null);
    setPedidoAvaliandoId(null);
  }
  function incQtd() {
    setQtdAtual((v) => v + 1);
  }
  function decQtd() {
    setQtdAtual((v) => Math.max(1, v - 1));
  }
  function alterarAddonQtd(groupId, addonId, delta) {
    const group = ADDON_GROUPS[groupId];
    const grupoSel = selecaoAddons[groupId] || {};
    if (delta > 0) {
      const totalGrupo = Object.values(grupoSel).reduce((a, b) => a + b, 0);
      if (totalGrupo >= group.max) {
        showToast(`Máximo de ${group.max} para "${group.nome}"`);
        return;
      }
    }
    setSelecaoAddons((prev) => {
      const g = prev[groupId] || {};
      const atual = g[addonId] || 0;
      const novo = delta > 0 ? atual + 1 : Math.max(0, atual - 1);
      return { ...prev, [groupId]: { ...g, [addonId]: novo } };
    });
  }
  function toggleIngrediente(i) {
    setSelecaoIngredientes((prev) => ({ ...prev, [i]: !prev[i] }));
  }
  // Preço unitário (promo se houver, ver utils/utils.js#precoBase) + soma de
  // cada adicional marcado em cada grupo, tudo multiplicado pela quantidade
  // escolhida na ficha — é o total mostrado no botão "Adicionar" do
  // ProductSheet, recalculado a cada seleção.
  function calcularTotalProduto() {
    const item = produtoAtual;
    if (!item) return 0;
    let total = precoBase(item);
    (item.addons || []).forEach((groupId) => {
      const group = ADDON_GROUPS[groupId];
      const sel = selecaoAddons[groupId] || {};
      group.itens.forEach((ad) => {
        total += (sel[ad.id] || 0) * ad.preco;
      });
    });
    return total * qtdAtual;
  }
  // Valida que cada grupo de adicionais atingiu o mínimo exigido (ex.:
  // "escolha ao menos 1 molho"), monta a lista final de adicionais/
  // ingredientes removidos escolhidos e delega pra adicionarItemAoCarrinho.
  function adicionarProdutoAoCarrinho() {
    const item = produtoAtual;
    if (!item) return;
    for (const groupId of item.addons || []) {
      const group = ADDON_GROUPS[groupId];
      const sel = selecaoAddons[groupId] || {};
      const totalGrupo = Object.values(sel).reduce((a, b) => a + b, 0);
      if (totalGrupo < group.min) {
        showToast(`Escolha ao menos ${group.min} em "${group.nome}"`);
        return;
      }
    }
    const addonsEscolhidos = [];
    (item.addons || []).forEach((groupId) => {
      const group = ADDON_GROUPS[groupId];
      const sel = selecaoAddons[groupId] || {};
      group.itens.forEach((ad) => {
        const qtd = sel[ad.id] || 0;
        if (qtd > 0) addonsEscolhidos.push({ nome: ad.nome, qtd, preco: ad.preco });
      });
    });
    const ingredientesRemovidos = (item.ingredientes || []).filter(
      (_, i) => selecaoIngredientes[i],
    );
    const precoUnitario = calcularTotalProduto() / qtdAtual;
    adicionarItemAoCarrinho(
      item.id,
      qtdAtual,
      addonsEscolhidos,
      ingredientesRemovidos,
      precoUnitario,
    );
    showToast(`${item.nome} adicionado ao pedido`);
    fecharProduto();
  }

  /* ---------------- Combos personalizados salvos como favorito ----------- */
  // Lê a personalização (adicionais + ingredientes removidos) atualmente
  // selecionada na ficha do produto aberto — usado tanto pra decidir se
  // vale oferecer "salvar como combo" (temPersonalizacao) quanto pra
  // montar o objeto salvo em si (salvarComboAtual).
  function comboPersonalizadoAtual() {
    const item = produtoAtual;
    if (!item) return null;
    const addons = [];
    (item.addons || []).forEach((groupId) => {
      const group = ADDON_GROUPS[groupId];
      const sel = selecaoAddons[groupId] || {};
      group.itens.forEach((ad) => {
        const qtd = sel[ad.id] || 0;
        if (qtd > 0) addons.push({ nome: ad.nome, qtd, preco: ad.preco });
      });
    });
    const ingredientesRemovidos = (item.ingredientes || []).filter(
      (_, i) => selecaoIngredientes[i],
    );
    return { addons, ingredientesRemovidos };
  }
  // Só faz sentido oferecer "salvar como combo" se a pessoa mexeu em algo
  // (senão seria só o próprio item do cardápio, sem nada de "personalizado").
  function temPersonalizacao() {
    const combo = comboPersonalizadoAtual();
    return !!combo && (combo.addons.length > 0 || combo.ingredientesRemovidos.length > 0);
  }
  // Salva a personalização atual em favoritosPersonalizados com um nome
  // próprio dado pelo cliente (estilo "meu pedido de sempre").
  function salvarComboAtual(nome) {
    const item = produtoAtual;
    if (!item) return;
    const combo = comboPersonalizadoAtual();
    setFavoritosPersonalizados((prev) => [
      ...prev,
      {
        id: "fp-" + Date.now(),
        itemId: item.id,
        nome,
        addons: combo.addons,
        ingredientesRemovidos: combo.ingredientesRemovidos,
      },
    ]);
    showToast(`"${nome}" salvo nos favoritos ⭐`);
  }
  // Preço do combo salvo re-somado a partir do item base atual do cardápio
  // (não fica congelado no preço de quando foi salvo — se o admin reajustar
  // o preço do prato, o combo acompanha).
  function precoComboPersonalizado(fav) {
    const item = MENU.find((m) => m.id === fav.itemId);
    if (!item) return 0;
    const addonsTotal = fav.addons.reduce((a, ad) => a + ad.qtd * ad.preco, 0);
    return precoBase(item) + addonsTotal;
  }
  function adicionarFavoritoPersonalizadoAoCarrinho(favId) {
    const fav = favoritosPersonalizados.find((f) => f.id === favId);
    if (!fav) return;
    adicionarItemAoCarrinho(
      fav.itemId,
      1,
      fav.addons,
      fav.ingredientesRemovidos,
      precoComboPersonalizado(fav),
    );
    showToast(`${fav.nome} adicionado ao pedido`);
  }
  function removerFavoritoPersonalizado(favId) {
    setFavoritosPersonalizados((prev) => prev.filter((f) => f.id !== favId));
    showToast("Combo removido dos favoritos");
  }

  /* ---------------- Avaliações -------------------------------------------- */
  // Mistura avaliações reais deste cliente (reviewsUser, localStorage) com
  // as fictícias pré-cadastradas (REVIEWS_MOCK, data/data.js) — as do
  // usuário aparecem primeiro (mais recentes no topo).
  function getReviews(itemId) {
    const mock = REVIEWS_MOCK[itemId] || [];
    const user = reviewsUser[itemId] || [];
    return [...user, ...mock];
  }
  // Nota média (1-5) e total de avaliações de um item, usado no card do
  // cardápio (Estrelas) e no cabeçalho da ficha do produto.
  function mediaEstrelas(itemId) {
    const reviews = getReviews(itemId);
    if (!reviews.length) return { media: 0, total: 0 };
    const soma = reviews.reduce((a, r) => a + r.estrelas, 0);
    return { media: soma / reviews.length, total: reviews.length };
  }
  // Grava uma nova avaliação (com foto opcional, ver product.jsx#Reviews) e,
  // se essa avaliação veio do fluxo "Avaliar pedido" (pedidoAvaliandoId
  // setado por avaliarPedido), marca o pedido como já avaliado no histórico.
  function enviarAvaliacao(itemId, estrelas, comentario, foto) {
    const nova = {
      autor: nomeExibicao(),
      estrelas,
      comentario,
      foto: foto || undefined,
      data: new Date().toISOString().slice(0, 10),
    };
    setReviewsUser((prev) => ({
      ...prev,
      [itemId]: [nova, ...(prev[itemId] || [])],
    }));
    if (pedidoAvaliandoId) {
      const pid = pedidoAvaliandoId;
      setPedidos((prev) =>
        prev.map((p) => (p.id === pid ? { ...p, avaliado: true } : p)),
      );
      setPedidoAvaliandoId(null);
    }
    showToast("Avaliação enviada, obrigado! ⭐");
  }

  /* ---------------- Carrinho ----------------------------------------------- */
  // Enquanto há um grupo ativo, o "carrinho" exibido/editado é o carrinho
  // compartilhado do grupo (grupoObj, vindo do back-end — ver acima) — o
  // `cart` pessoal continua intacto no localStorage, só fica de fora da UI
  // até o grupo acabar.
  const itensAtivos = grupoAtivo ? grupoObj?.itens || [] : cart;

  // Adiciona um item ao carrinho ativo (pessoal ou de grupo, ver
  // itensAtivos acima). Dentro de um grupo, delega tudo pro back-end (a
  // fonte da verdade é o servidor, o socket devolve o item novo pra todo
  // mundo via "grupo:item-adicionado"). Fora de um grupo, opera 100% local:
  // se já existe uma linha no carrinho com o mesmo item E a mesma
  // personalização (ver mesmaPersonalizacao no topo do arquivo), só soma a
  // quantidade em vez de duplicar a linha.
  function adicionarItemAoCarrinho(
    itemId,
    qtd,
    addons,
    ingredientesRemovidos,
    precoUnitario,
  ) {
    if (grupoAtivo) {
      apiFetch(`/api/grupo/${grupoAtivo.codigo}/itens`, {
        method: "POST",
        body: {
          itemId,
          qtd,
          addons,
          ingredientesRemovidos,
          precoUnitario,
          participanteId: grupoAtivo.participanteId,
          participanteNome: grupoAtivo.nome,
        },
      }).catch(() => showToast("Não foi possível adicionar o item ao grupo"));
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex(
        (c) =>
          c.itemId === itemId &&
          mesmaPersonalizacao(
            c.addons,
            addons,
            c.ingredientesRemovidos,
            ingredientesRemovidos,
          ),
      );
      if (idx !== -1) {
        const novo = [...prev];
        novo[idx] = { ...novo[idx], qtd: novo[idx].qtd + qtd };
        return novo;
      }
      return [...prev, { itemId, qtd, addons, ingredientesRemovidos, precoUnitario }];
    });
  }
  function removerDoCarrinho(idx) {
    if (grupoAtivo) {
      const item = grupoObj?.itens[idx];
      if (item) {
        apiFetch(`/api/grupo/${grupoAtivo.codigo}/itens/${item.id}`, { method: "DELETE" }).catch(
          () => showToast("Não foi possível remover o item"),
        );
      }
      return;
    }
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }
  function incQtdCarrinho(idx) {
    if (grupoAtivo) {
      const item = grupoObj?.itens[idx];
      if (item) {
        apiFetch(`/api/grupo/${grupoAtivo.codigo}/itens/${item.id}`, {
          method: "PATCH",
          body: { delta: 1 },
        }).catch(() => showToast("Não foi possível atualizar o item"));
      }
      return;
    }
    setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, qtd: c.qtd + 1 } : c)));
  }
  function decQtdCarrinho(idx) {
    if (grupoAtivo) {
      const item = grupoObj?.itens[idx];
      if (item) {
        apiFetch(`/api/grupo/${grupoAtivo.codigo}/itens/${item.id}`, {
          method: "PATCH",
          body: { delta: -1 },
        }).catch(() => showToast("Não foi possível atualizar o item"));
      }
      return;
    }
    setCart((prev) =>
      prev
        .map((c, i) => (i === idx ? { ...c, qtd: c.qtd - 1 } : c))
        .filter((c) => c.qtd > 0),
    );
  }
  function totalCarrinho() {
    return itensAtivos.reduce((a, c) => a + c.precoUnitario * c.qtd, 0);
  }
  // Cupom digitado manualmente tem prioridade; sem cupom, o clube de
  // assinatura (Casa do Pato+) aplica um desconto automático — ver
  // utils/engajamento.js#ASSINATURA_DESCONTO_PCT.
  function calcularDesconto(subtotal) {
    if (cupomAplicado) {
      const desconto =
        cupomAplicado.tipo === "pct"
          ? subtotal * (cupomAplicado.valor / 100)
          : cupomAplicado.valor;
      return Math.min(desconto, subtotal);
    }
    if (assinaturaAtiva()) {
      return subtotal * (ASSINATURA_DESCONTO_PCT / 100);
    }
    return 0;
  }
  // Cashback só existe pra quem está logado (visitante não tem conta pra
  // acumular/gastar) — ver utils/fidelidade.js.
  function saldoCashbackDisponivel() {
    if (sessao.tipo !== "usuario") return 0;
    return getContaFidelidade(sessao.email).cashback;
  }
  function calcularDescontoCashback(totalAposCupom) {
    if (!usarCashbackNoCarrinho) return 0;
    return Math.min(saldoCashbackDisponivel(), totalAposCupom);
  }
  function totalComDesconto() {
    const subtotal = totalCarrinho();
    const aposCupom = subtotal - calcularDesconto(subtotal);
    return aposCupom - calcularDescontoCashback(aposCupom);
  }
  function estimarTempoPedido() {
    const qtdItens = itensAtivos.reduce((a, c) => a + c.qtd, 0);
    const base = { balcao: 12, mesa: 18, entrega: 30 }[tipoPedido] ?? 15;
    const extra = Math.min(10, Math.max(0, qtdItens - 2) * 2);
    return base + extra;
  }
  // "Usar saldo da carteira" dentro de Dinheiro é só um atalho pra ligar o
  // toggle geral de cashback (ver calcularDescontoCashback acima) — mesmo
  // saldo, só reorganizado como opção de pagamento pra ficar mais intuitivo.
  function escolherOpcaoDinheiro(opcao) {
    setDinheiroOpcao(opcao);
    setUsarCashbackNoCarrinho(opcao === "carteira");
  }
  // Mesmo cálculo de troco que o PDV do admin já usava — aqui do lado do
  // cliente, só pra exibição no checkout (não é gravado no pedido, mesma
  // limitação do troco do PDV, ver CLAUDE.md).
  function trocoCalculado() {
    const pago = Number(String(valorTroco).replace(",", ".")) || 0;
    return Math.max(0, Number((pago - totalComDesconto()).toFixed(2)));
  }
  // Pix "copia e cola" simulado — só cosmético (protótipo sem PSP real por
  // trás), mesmo espírito do QR Code que já existia antes. Formato solto
  // inspirado no BR Code (EMVCo), NÃO é um payload Pix válido de verdade.
  function gerarPixCopiaCola() {
    const valor = totalComDesconto().toFixed(2);
    const aleatorio = Math.random().toString(36).slice(2, 10).toUpperCase();
    return (
      `00020126580014BR.GOV.BCB.PIX0136casadopato-${aleatorio}5204000053039865406${valor}` +
      `5802BR5912CASA DO PATO6009SAOPAULO62070503***6304${aleatorio.slice(0, 4)}`
    );
  }
  function aplicarCupom(codigoBruto) {
    const codigo = codigoBruto.trim().toUpperCase();
    const cupom = COUPONS[codigo];
    if (!cupom) {
      showToast("Cupom inválido");
      return;
    }
    setCupomAplicado({ codigo, ...cupom });
    showToast(`Cupom ${codigo} aplicado! 🏷️`);
  }
  function removerCupom() {
    setCupomAplicado(null);
  }
  function alterarPessoasDivisao(delta) {
    setPessoasDivisao((v) => {
      const novo = Math.min(20, Math.max(1, v + delta));
      setDivisaoPagamentos((formas) => {
        const copia = formas.slice(0, novo);
        while (copia.length < novo) copia.push("pix");
        return copia;
      });
      return novo;
    });
  }
  function definirPagamentoDivisao(idx, forma) {
    setDivisaoPagamentos((prev) => prev.map((p, i) => (i === idx ? forma : p)));
  }
  // Divide o total em `pessoasDivisao` partes iguais (arredondadas ao
  // centavo) — a última pessoa leva o resto da divisão, pra soma bater
  // exatamente, mesmo cálculo do PDV do admin (ver pdvValoresDivisao).
  function valoresDivisaoConta() {
    const total = totalComDesconto();
    const n = pessoasDivisao;
    const base = Math.floor((total / n) * 100) / 100;
    const valores = [];
    let soma = 0;
    for (let i = 0; i < n - 1; i++) {
      valores.push(base);
      soma += base;
    }
    valores.push(Math.round((total - soma) * 100) / 100);
    return valores;
  }
  // Divide a conta por quem pediu o quê, em vez de rateio igual — só faz
  // sentido dentro de um pedido em grupo, porque só ali cada item carrega
  // participanteNome (ver adicionarItemAoCarrinho). O desconto (cupom/
  // assinatura) e o cashback usado são rateados proporcionalmente ao bruto
  // de cada pessoa, pra somar exatamente `totalComDesconto()` — mesmo
  // truque de arredondamento de `valoresDivisaoConta` (resto na última
  // pessoa da lista).
  function valoresDivisaoPorParticipante() {
    const total = totalComDesconto();
    const nomes = [...new Set(itensAtivos.map((c) => c.participanteNome).filter(Boolean))];
    if (nomes.length < 2) return [];
    const brutoPorNome = nomes.map((nome) =>
      itensAtivos
        .filter((c) => c.participanteNome === nome)
        .reduce((a, c) => a + c.precoUnitario * c.qtd, 0),
    );
    const somaBruto = brutoPorNome.reduce((a, b) => a + b, 0) || 1;
    const valores = [];
    let somaAlocada = 0;
    for (let i = 0; i < nomes.length - 1; i++) {
      const fatia = Math.floor(total * (brutoPorNome[i] / somaBruto) * 100) / 100;
      valores.push(fatia);
      somaAlocada += fatia;
    }
    valores.push(Math.round((total - somaAlocada) * 100) / 100);
    return nomes.map((nome, i) => ({ nome, valor: valores[i] }));
  }
  // "Tá dividindo a conta" de alguma forma — rateio igual (pessoasDivisao
  // > 1) OU divisão inteligente por participante ativa (dentro de um
  // pedido em grupo, com divisaoModo === "porPedido"). Única fonte de
  // verdade usada tanto pelo seletor de pagamento por pessoa (CartExtra)
  // quanto por PedidoInfo pra decidir se esconde o seletor de pagamento
  // único (Pix/Cartão/Dinheiro) — antes cada um calculava isso na sua
  // própria conta, e PedidoInfo ignorava a divisão inteligente por
  // completo, mostrando os dois seletores ao mesmo tempo nesse caso.
  function dividindoAConta() {
    if (tipoPedido !== "mesa") return false;
    const temDivisaoInteligente =
      Boolean(grupoAtivo) && valoresDivisaoPorParticipante().length > 1;
    if (temDivisaoInteligente && divisaoModo === "porPedido") return true;
    return pessoasDivisao > 1;
  }
  // Throttle de 60s só pra evitar clique repetido acidental — não é
  // persistido, então recarregar a página libera de novo.
  function chamarGarcomAgora(motivo = "presenca") {
    if (!numeroMesa.trim()) {
      showToast("Informe o número da mesa antes de chamar o garçom");
      return;
    }
    const agora = Date.now();
    if (agora - ultimaChamadaGarcomRef.current < 60000) {
      showToast("Já chamamos o garçom, aguarde um instante");
      return;
    }
    ultimaChamadaGarcomRef.current = agora;
    apiFetch("/api/garcom/chamadas", {
      method: "POST",
      body: { mesa: numeroMesa.trim(), motivo },
    })
      .then((chamada) => {
        setMinhasChamadasIds((prev) => [...prev, chamada.id]);
        socket.emit("garcom:acompanhar", chamada.id);
        showToast("Garçom chamado para sua mesa! 🔔");
      })
      .catch(() => {
        ultimaChamadaGarcomRef.current = 0; // libera nova tentativa já que essa falhou
        showToast("Não foi possível chamar o garçom, tente novamente");
      });
  }

  function abrirCarrinho() {
    setCartOpen(true);
  }
  function fecharCarrinho() {
    setCartOpen(false);
  }

  // Monta o objeto de pedido que será enviado ao back-end (ver
  // enviarPedidoAoServidor) a partir de todo o estado do carrinho/checkout
  // atual: decide o rótulo final de `pagamento` (junta forma de pagamento +
  // sub-escolha — cartão salvo x maquininha, dinheiro x saldo da carteira,
  // pagar depois — num único texto, ver PAGAMENTO_LABEL em utils/utils.js)
  // e monta `divisao` no formato certo conforme o modo de divisão da conta
  // ativo (rateio igual ou por participante, ver valoresDivisaoConta /
  // valoresDivisaoPorParticipante). Não grava nada ainda — é só o payload.
  function montarPedidoPendente() {
    const subtotal = totalCarrinho();
    const aposCupom = subtotal - calcularDesconto(subtotal);
    const cashbackUsado = calcularDescontoCashback(aposCupom);
    const total = aposCupom - cashbackUsado;
    const porParticipante = valoresDivisaoPorParticipante();
    const dividirPorPedido =
      tipoPedido === "mesa" && divisaoModo === "porPedido" && porParticipante.length > 1;
    const dividir = tipoPedido === "mesa" && !dividirPorPedido && pessoasDivisao > 1;
    const pagarDepois = tipoPedido === "mesa" && pagamentoTiming === "depois";
    let pagamento;
    if (dividirPorPedido || dividir) {
      pagamento = "dividido";
    } else if (pagarDepois) {
      pagamento = "pendente-" + pagarDepoisComo;
    } else if (formaPagamento === "cartao") {
      pagamento = cartaoEscolhidoId === "motoboy" ? "cartao-motoboy" : "cartao";
    } else if (formaPagamento === "dinheiro") {
      pagamento = dinheiroOpcao === "carteira" ? "dinheiro-carteira" : "dinheiro-nota";
    } else {
      pagamento = formaPagamento;
    }
    return {
      // id/criadoEm são atribuídos pelo servidor ao gravar o pedido (ver
      // simularPagamento) — antes eram gerados aqui, sem back-end pra ser
      // fonte única da verdade.
      itens: itensAtivos.map((c) => {
        const item = MENU.find((m) => m.id === c.itemId);
        return {
          itemId: c.itemId,
          nome: item.nome,
          qtd: c.qtd,
          subtotal: c.precoUnitario * c.qtd,
          participanteNome: c.participanteNome || undefined,
        };
      }),
      total,
      cupom: cupomAplicado ? cupomAplicado.codigo : null,
      cashbackUsado,
      clienteEmail: sessao.tipo === "usuario" ? sessao.email : null,
      tipo: tipoPedido,
      mesa: numeroMesa,
      endereco: enderecoEntrega,
      agendamento,
      pagamento,
      divisao: dividirPorPedido
        ? porParticipante.map((d) => ({
            pessoa: d.nome,
            valor: d.valor,
            pagamento: divisaoPagamentosPorNome[d.nome] || "pix",
          }))
        : dividir
          ? valoresDivisaoConta().map((valor, i) => ({
              pessoa: i + 1,
              valor,
              pagamento: divisaoPagamentos[i] || "pix",
            }))
          : null,
      observacoes,
      avaliado: false,
      grupo: grupoAtivo
        ? { codigo: grupoAtivo.codigo, participantes: grupoObj?.participantes || [] }
        : null,
    };
  }
  // Chamado pelo botão "Finalizar pedido" do carrinho: valida os campos
  // obrigatórios pro tipo de pedido escolhido (mesa precisa de número,
  // entrega precisa de endereço), fecha o carrinho e decide entre o
  // checkout normal (Pix/Cartão/Dinheiro) ou o atalho "pagar depois".
  function finalizarPedido() {
    if (!itensAtivos.length) {
      showToast("Adicione itens antes de enviar o pedido");
      return;
    }
    if (tipoPedido === "mesa" && !numeroMesa.trim()) {
      showToast("Informe o número da mesa");
      return;
    }
    if (tipoPedido === "entrega" && !enderecoEntrega.trim()) {
      showToast("Informe o endereço de entrega");
      return;
    }
    pedidoPendenteRef.current = montarPedidoPendente();
    setCartOpen(false);
    // "Pagar depois" (só mesa, ver FormaPagamento.jsx) pula o checkout de
    // Pix/Cartão/Dinheiro inteiro — não tem pagamento pra simular agora, o
    // pedido só precisa ir pra cozinha na hora, igual pediria pro garçom
    // anotar num restaurante de verdade.
    if (tipoPedido === "mesa" && pagamentoTiming === "depois") {
      enviarPedidoPagarDepois();
    } else {
      setPixEtapa("aguardando");
      setPixOpen(true);
      falarResumoPedido();
    }
  }

  /* ---------------- Checkout Pix / Cartão / Dinheiro ---------------------- */
  function fecharPix() {
    setPixOpen(false);
  }
  // Gravação de verdade no back-end (server/) — usada tanto pelo checkout
  // simulado (Pix/Cartão/Dinheiro, ver simularPagamento) quanto pelo fluxo
  // de "pagar depois" (ver enviarPedidoPagarDepois), que não passa por
  // nenhuma simulação de pagamento. Fidelidade e estoque continuam
  // client-side (ver CLAUDE.md), usando os valores já calculados em
  // `pendente`.
  function enviarPedidoAoServidor(pendente) {
    return apiFetch("/api/pedidos", { method: "POST", body: pendente }).then((pedido) => {
      setPedidos((prev) => [pedido, ...prev]);
      baixarEstoque(pedido.itens);
      if (pendente.clienteEmail) {
        if (pendente.cashbackUsado > 0) {
          debitarCashback(pendente.clienteEmail, pendente.cashbackUsado);
        }
        creditarCompra(pendente.clienteEmail, pedido.total, pedido.id);
      }
      setUsarCashbackNoCarrinho(false);
      pedidoPendenteRef.current = null;
      if (grupoAtivo) {
        apiFetch(`/api/grupo/${grupoAtivo.codigo}/limpar`, { method: "POST" }).catch(() => {});
      } else {
        setCart([]);
      }
      setObservacoes("");
      setCupomAplicado(null);
      setPessoasDivisao(1);
      setDivisaoPagamentos(["pix"]);
      setAgendamento(null);
      setPrecisaTroco(false);
      setValorTroco("");
      return pedido;
    });
  }
  function simularPagamento() {
    setPixCarregando(true);
    const t1 = setTimeout(() => {
      setPixEtapa("confirmado");
      showToast(PAGAMENTO_CHECKOUT[formaPagamento].toast);
      const t2 = setTimeout(() => {
        const pendente = pedidoPendenteRef.current;
        if (!pendente) {
          setPixEtapa("preparo");
          setPixCarregando(false);
          return;
        }
        enviarPedidoAoServidor(pendente)
          .then(() => setPixEtapa("preparo"))
          .catch(() => {
            // Mantém carrinho/cupom intactos pra dar pra tentar de novo —
            // diferente de antes, agora essa gravação pode falhar de verdade
            // (rede/servidor), não só ficar em localStorage.
            showToast("Não foi possível confirmar o pedido, tente novamente");
          })
          .finally(() => setPixCarregando(false));
      }, 1400);
      timeoutsRef.current.push(t2);
    }, 1200);
    timeoutsRef.current.push(t1);
  }
  // "Pagar depois" (mesa): sem pagamento pra simular, então envia direto e
  // avisa como vai ser cobrado no final — ver finalizarPedido.
  function enviarPedidoPagarDepois() {
    const pendente = pedidoPendenteRef.current;
    if (!pendente) return;
    enviarPedidoAoServidor(pendente)
      .then((pedido) => {
        const como = pagarDepoisComo === "caixa" ? "no caixa" : "chamando o garçom";
        showToast(`Pedido #${pedido.id} enviado pra cozinha — pague ${como} quando quiser 👍`);
      })
      .catch(() => showToast("Não foi possível enviar o pedido, tente novamente"));
  }

  /* ---------------- Pedidos (histórico) ------------------------------------ */
  // "Repetir pedido": reenche o carrinho com os mesmos itens de um pedido
  // antigo. Recalcula o preço pelo cardápio ATUAL (não pelo preço congelado
  // no histórico) e ignora silenciosamente itens que saíram do cardápio
  // desde então, avisando quantos foram pulados.
  function repetirPedido(pedidoId) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;
    let indisponiveis = 0;
    pedido.itens.forEach((it) => {
      const item = MENU.find((m) => m.id === it.itemId);
      if (!item) {
        indisponiveis++;
        return;
      }
      adicionarItemAoCarrinho(item.id, it.qtd, [], [], precoBase(item));
    });
    showToast(
      indisponiveis > 0
        ? "Alguns itens desse pedido não estão mais disponíveis"
        : "Itens do pedido adicionados ao carrinho",
    );
    setContaOpen(false);
    setPedidosOpen(false);
    setCartOpen(true);
  }
  // "Avaliar pedido": abre a ficha do 1º item do pedido já com o formulário
  // de avaliação em foco (ver product.jsx#Reviews) — pedidoAvaliandoId é lido
  // por enviarAvaliacao pra marcar o pedido como avaliado no histórico.
  function avaliarPedido(pedidoId) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido || !pedido.itens.length) return;
    setPedidoAvaliandoId(pedidoId);
    abrirProduto(pedido.itens[0].itemId);
  }

  /* ---------------- Endereços salvos ("Casa", "Trabalho"...) -------------- */
  function salvarEndereco(rotulo, endereco) {
    if (!rotulo.trim() || !endereco.trim()) return;
    const novo = { id: "end-" + Date.now(), rotulo: rotulo.trim(), endereco: endereco.trim() };
    setEnderecos((prev) => [...prev, novo]);
    setEnderecoEntrega(novo.endereco);
    showToast(`Endereço "${novo.rotulo}" salvo`);
  }
  function selecionarEndereco(id) {
    const end = enderecos.find((e) => e.id === id);
    if (end) setEnderecoEntrega(end.endereco);
  }
  function removerEndereco(id) {
    setEnderecos((prev) => prev.filter((e) => e.id !== id));
  }

  /* ---------------- Pedido em grupo (carrinho compartilhado) --------------- */
  // Sincronização de verdade entre dispositivos via back-end + Socket.IO
  // (ver grupoObj acima) — não depende mais de os participantes estarem no
  // mesmo navegador.
  function criarGrupoPedido() {
    const nome = nomeExibicao();
    apiFetch("/api/grupo", { method: "POST", body: { nome } })
      .then(({ codigo, participanteId }) => {
        setGrupoAtivo({ codigo, participanteId, nome });
        showToast(`Grupo ${codigo} criado — compartilhe o código com a mesa 🧑‍🤝‍🧑`);
      })
      .catch(() => showToast("Não foi possível criar o grupo, tente novamente"));
  }
  function entrarGrupoPedido(codigo) {
    const nome = nomeExibicao();
    return apiFetch(`/api/grupo/${(codigo || "").trim().toUpperCase()}/entrar`, {
      method: "POST",
      body: { nome },
    })
      .then((resultado) => {
        setGrupoAtivo({ codigo: resultado.codigo, participanteId: resultado.participanteId, nome });
        showToast(`Você entrou no grupo ${resultado.codigo}! 🧑‍🤝‍🧑`);
        return true;
      })
      .catch((err) => {
        showToast(err instanceof ApiError ? err.message : "Não foi possível entrar no grupo");
        return false;
      });
  }
  function sairGrupoPedido() {
    if (!grupoAtivo) return;
    apiFetch(`/api/grupo/${grupoAtivo.codigo}/sair`, {
      method: "POST",
      body: { participanteId: grupoAtivo.participanteId },
    }).catch(() => {});
    setGrupoAtivo(null);
    showToast("Você saiu do pedido em grupo");
  }

  /* ---------------- Conta / sessão ----------------------------------------- */
  function nomeExibicao() {
    return (sessao && sessao.nome) || "Visitante";
  }
  function abrirConta() {
    setContaOpen(true);
  }
  function fecharConta() {
    setContaOpen(false);
  }
  // Favoritos, Pedidos e Extrato abrem como uma "nova janela" própria
  // (sheet separado) empilhada por cima de "Sua conta", não no lugar dela
  // — fechar qualquer uma delas (botão "Voltar" ou clique fora) volta pra
  // "Sua conta" em vez de cair direto no cardápio por trás. Só o Escape
  // (fecha tudo de uma vez, ver o useEffect correspondente) sai
  // completamente sem passar por "Sua conta" de novo.
  function abrirFavoritos() {
    setContaOpen(false);
    setFavoritosOpen(true);
  }
  function fecharFavoritos() {
    setFavoritosOpen(false);
    setContaOpen(true);
  }
  function abrirPedidos() {
    setContaOpen(false);
    setPedidosOpen(true);
  }
  function fecharPedidos() {
    setPedidosOpen(false);
    setContaOpen(true);
  }
  function abrirFidelidade() {
    setContaOpen(false);
    setFidelidadeOpen(true);
  }
  function fecharFidelidade() {
    setFidelidadeOpen(false);
  }
  // Extrato saiu do Clube de Fidelidade e virou uma janela própria,
  // acessada a partir de "Sua conta" (mesmo molde de Favoritos/Pedidos) —
  // o Clube de Fidelidade em si só é aberto pelo botão "Usar meus pontos",
  // não por "Sua conta", então fechar ele não volta pra lá.
  function abrirExtrato() {
    setContaOpen(false);
    setExtratoOpen(true);
  }
  function fecharExtrato() {
    setExtratoOpen(false);
    setContaOpen(true);
  }
  function abrirReservas() {
    setContaOpen(false);
    setReservasOpen(true);
  }
  function fecharReservas() {
    setReservasOpen(false);
    setContaOpen(true);
  }
  function criarReservaMesa(dados) {
    if (sessao.tipo !== "usuario") {
      showToast("Entre na sua conta pra reservar uma mesa");
      return false;
    }
    const resultado = criarReservaUtil(sessao.email, dados);
    if (resultado.ok) {
      showToast("Mesa reservada! 📅");
    } else {
      showToast(resultado.erro);
    }
    return resultado.ok;
  }
  function cancelarReservaMesa(reservaId) {
    if (sessao.tipo !== "usuario") return;
    cancelarReservaUtil(sessao.email, reservaId);
    showToast("Reserva cancelada");
  }
  function resgatarPontos(recompensaId) {
    if (sessao.tipo !== "usuario") return;
    const resultado = resgatarRecompensa(sessao.email, recompensaId);
    // getContaFidelidade não é estado React (só localStorage) — o toast abaixo
    // já dispara um setState que re-renderiza o provider inteiro, então o
    // FidelidadeSheet relê o saldo novo na hora sem precisar de estado extra.
    if (resultado.ok) {
      showToast(`Recompensa resgatada: ${resultado.recompensa.nome} 🎁`);
    } else {
      showToast(resultado.erro);
    }
  }
  // Todas as funções de conta abaixo agora falam com o back-end (server/) —
  // por isso viram assíncronas (Promise<boolean>, mesmo contrato de antes,
  // só que resolvido depois de uma resposta de rede em vez de na hora). Ver
  // AccountSheet.jsx, que já usa `await` nesses `onSubmit`.
  // login/cadastro resolvem `true` (entrou), `false` (erro, já mostrou o toast) ou
  // `"verificar"` (e-mail ainda não confirmado: a tela vai pedir o código recebido).
  function login(email, senha) {
    return apiFetch("/api/auth/login", { method: "POST", body: { email, senha } })
      .then((sessaoNova) => {
        setSessao(sessaoNova);
        recarregarPedidos();
        showToast(`Bem-vindo(a) de volta, ${sessaoNova.nome.split(" ")[0]}!`);
        return true;
      })
      .catch((err) => {
        showToast(err instanceof ApiError ? err.message : "E-mail ou senha inválidos");
        return err instanceof ApiError && err.dados?.precisaVerificar ? "verificar" : false;
      });
  }
  function cadastro(nome, email, senha) {
    return apiFetch("/api/auth/cadastro", { method: "POST", body: { nome, email, senha } })
      .then((resp) => {
        if (resp.precisaVerificar) {
          showToast(
            resp.emailEnviado === false
              ? "Conta criada, mas não conseguimos enviar o e-mail agora. Toque em “Reenviar código” em instantes."
              : `Enviamos um código para ${email}`,
          );
          return "verificar";
        }
        setSessao(resp);
        recarregarPedidos();
        showToast(`Conta criada! Bem-vindo(a), ${nome.split(" ")[0]}!`);
        return true;
      })
      .catch((err) => {
        showToast(err instanceof ApiError ? err.message : "Não foi possível criar a conta");
        return false;
      });
  }
  // Confirma o e-mail com o código recebido; já deixa a pessoa logada.
  function confirmarEmail(email, codigo) {
    return apiFetch("/api/auth/verificar-email", { method: "POST", body: { email, codigo } })
      .then((sessaoNova) => {
        setSessao(sessaoNova);
        recarregarPedidos();
        showToast(`E-mail confirmado! Bem-vindo(a), ${sessaoNova.nome.split(" ")[0]}!`);
        return true;
      })
      .catch((err) => {
        showToast(err instanceof ApiError ? err.message : "Não foi possível confirmar o e-mail");
        return false;
      });
  }
  function reenviarCodigoEmail(email) {
    return apiFetch("/api/auth/reenviar-codigo", { method: "POST", body: { email } })
      .then(() => {
        showToast("Se o e-mail estiver pendente de confirmação, enviamos um novo código");
        return true;
      })
      .catch((err) => {
        showToast(err.message);
        return false;
      });
  }
  function continuarComoVisitante() {
    apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSessao({ tipo: "visitante", nome: "Visitante" });
    showToast("Navegando como visitante");
  }
  function sair() {
    apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSessao({ tipo: "visitante", nome: "Visitante" });
    recarregarPedidos();
    showToast("Você saiu da sua conta");
  }
  function verificarEmailCadastrado(email) {
    // Resolve "email" (código foi pra caixa de entrada), "log" (modo desenvolvimento:
    // o código sai no log do servidor) ou false (erro). Os dois primeiros são truthy.
    return apiFetch("/api/auth/recuperar", { method: "POST", body: { email } })
      .then((resp) => {
        showToast(
          resp.via === "email"
            ? "Se a conta existir, enviamos um código para o e-mail"
            : "Se a conta existir, o código saiu no log do servidor (modo desenvolvimento)",
        );
        return resp.via || "log";
      })
      .catch((err) => {
        showToast(err.message);
        return false;
      });
  }
  function redefinirSenha(email, codigo, novaSenha) {
    return apiFetch("/api/auth/redefinir", { method: "POST", body: { email, codigo, novaSenha } })
      .then(() => {
        showToast("Senha redefinida com sucesso! Faça login com a nova senha.");
        return true;
      })
      .catch((err) => {
        showToast(err.message);
        return false;
      });
  }

  /* ---------------- Indique um amigo ---------------------------------------- */
  function codigoIndicacaoAtual() {
    if (sessao.tipo !== "usuario") return null;
    return getCodigoIndicacao(sessao.email);
  }
  function totalAmigosIndicados() {
    if (sessao.tipo !== "usuario") return 0;
    return totalIndicados(sessao.email);
  }
  function usarCodigoIndicacao(codigo) {
    if (sessao.tipo !== "usuario") {
      showToast("Entre na sua conta pra usar um código de indicação");
      return;
    }
    const resultado = aplicarCodigoIndicacao(codigo, sessao.email);
    if (resultado.ok) {
      showToast("Código aplicado! Você ganhou 50 pontos de boas-vindas 🎁");
    } else {
      showToast(resultado.erro);
    }
  }

  /* ---------------- Missão semanal ------------------------------------------ */
  function missaoSemanalAtual() {
    if (sessao.tipo !== "usuario") return null;
    return progressoMissaoSemanal(sessao.email, pedidos);
  }
  function resgatarMissao() {
    if (sessao.tipo !== "usuario") return;
    const missao = missaoSemanalAtual();
    if (!missao || !missao.completa || missao.jaResgatou) return;
    resgatarMissaoSemanal(sessao.email, missao.chaveResgate);
    showToast("Missão concluída! Pontos bônus creditados 🏆");
  }

  /* ---------------- Oferta personalizada ------------------------------------ */
  const [ofertaDispensada, setOfertaDispensada] = useState(false);
  function ofertaPersonalizadaAtual() {
    if (sessao.tipo !== "usuario" || ofertaDispensada) return null;
    return getOfertaPersonalizada(sessao.email, pedidos);
  }
  function aplicarOfertaPersonalizada() {
    const oferta = ofertaPersonalizadaAtual();
    if (!oferta) return;
    setCupomAplicado(oferta.cupom);
    setOfertaDispensada(true);
    showToast(`Cupom ${oferta.cupom.codigo} aplicado! 🏷️`);
  }
  function dispensarOfertaPersonalizada() {
    setOfertaDispensada(true);
  }

  /* ---------------- Clube de assinatura (Casa do Pato+) ------------------------ */
  function assinaturaAtiva() {
    if (sessao.tipo !== "usuario") return false;
    return getAssinatura(sessao.email).ativo;
  }
  function assinarClube() {
    if (sessao.tipo !== "usuario") {
      showToast("Entre na sua conta pra assinar o Casa do Pato+");
      return;
    }
    definirAssinatura(sessao.email, true);
    showToast("Assinatura Casa do Pato+ ativada! 10% de desconto em todo pedido 🔥");
  }
  function cancelarAssinaturaClube() {
    if (sessao.tipo !== "usuario") return;
    definirAssinatura(sessao.email, false);
    showToast("Assinatura Casa do Pato+ cancelada");
  }

  /* ---------------- Carteira --------------------------------------------- */
  function recarregarSaldoCarteira(valor) {
    if (sessao.tipo !== "usuario") {
      showToast("Entre na sua conta pra usar a carteira");
      return;
    }
    if (!(valor > 0)) {
      showToast("Informe um valor válido");
      return;
    }
    adicionarSaldoCarteira(sessao.email, valor);
    showToast(`${fmt(valor)} adicionado(s) à sua carteira 💰`);
  }

  // A janela da carteira é protegida por PIN (hash forte, ver
  // utils/criptografia.js) — abre travada (`carteiraDesbloqueada=false`)
  // toda vez, mesmo se já foi destravada antes nessa sessão, pra não deixar
  // alguém que pegue o celular destravado já com o app aberto entrar direto
  // (ver CarteiraSheet.jsx). Aberta a partir do item de menu em "Sua conta"
  // (mesmo molde de Favoritos/Pedidos/Extrato) — fechar volta pra lá.
  const [carteiraOpen, setCarteiraOpen] = useState(false);
  const [carteiraDesbloqueada, setCarteiraDesbloqueada] = useState(false);
  function abrirCarteira() {
    setContaOpen(false);
    setCarteiraDesbloqueada(false);
    setCarteiraOpen(true);
  }
  function fecharCarteira() {
    setCarteiraOpen(false);
    setCarteiraDesbloqueada(false);
    setContaOpen(true);
  }
  function bloquearCarteira() {
    setCarteiraDesbloqueada(false);
  }
  async function criarPinCarteira(pin, confirmarPin) {
    if (sessao.tipo !== "usuario") return false;
    if (!/^\d{4,6}$/.test(pin)) {
      showToast("O PIN precisa ter de 4 a 6 números");
      return false;
    }
    if (pin !== confirmarPin) {
      showToast("Os PINs não coincidem");
      return false;
    }
    await definirPinCarteiraUtil(sessao.email, pin);
    setCarteiraDesbloqueada(true);
    showToast("PIN da carteira criado 🔒");
    return true;
  }
  async function desbloquearCarteira(pin) {
    if (sessao.tipo !== "usuario") return false;
    const ok = await conferirPinCarteiraUtil(sessao.email, pin);
    if (ok) {
      setCarteiraDesbloqueada(true);
    } else {
      showToast("PIN incorreto");
    }
    return ok;
  }
  function adicionarCartaoCarteira(dados) {
    if (sessao.tipo !== "usuario") return false;
    const resultado = salvarCartaoUtil(sessao.email, dados);
    if (resultado.ok) {
      showToast(`Cartão •••• ${resultado.cartao.final4} salvo`);
    } else {
      showToast(resultado.erro);
    }
    return resultado.ok;
  }
  function removerCartaoCarteira(cartaoId) {
    if (sessao.tipo !== "usuario") return;
    removerCartaoUtil(sessao.email, cartaoId);
    showToast("Cartão removido");
  }
  function comprarValePresenteCarteira(valor, destinatario) {
    if (sessao.tipo !== "usuario") return null;
    const resultado = comprarValePresenteUtil(sessao.email, valor, destinatario);
    if (resultado.ok) {
      showToast(`Vale-presente de ${fmt(resultado.valor)} criado 🎁`);
      return resultado.codigo;
    }
    showToast(resultado.erro);
    return null;
  }
  function resgatarValePresenteCarteira(codigo) {
    if (sessao.tipo !== "usuario") return false;
    const resultado = resgatarValePresenteUtil(sessao.email, codigo);
    if (resultado.ok) {
      showToast(`Vale-presente resgatado: +${fmt(resultado.valor)} na sua carteira 🎁`);
    } else {
      showToast(resultado.erro);
    }
    return resultado.ok;
  }

  /* ---------------- Acessibilidade ------------------------------------------ */
  function toggleContraste() {
    setContrasteAlto((v) => !v);
  }
  function aumentarFonte() {
    setFontScale((v) => Math.min(1.4, Math.round((v + 0.1) * 100) / 100));
  }
  function diminuirFonte() {
    setFontScale((v) => Math.max(0.85, Math.round((v - 0.1) * 100) / 100));
  }
  function toggleReduzirMovimento() {
    setReduzirMovimento((v) => !v);
  }
  function toggleLeitor() {
    const novo = !leitorAtivo;
    setLeitorAtivo(novo);
    if (novo) {
      showToast("Leitura em voz alta ativada — passe o foco pelos itens com Tab");
    } else {
      window.speechSynthesis?.cancel();
      showToast("Leitura em voz alta desativada");
    }
  }
  function toggleLegendas() {
    setLegendasAtivas((v) => !v);
  }
  // Pede permissão do navegador pra notificação nativa (ver o setInterval de
  // status acima) — precisa ser um clique explícito, navegador nenhum deixa
  // pedir isso sozinho ao carregar a página.
  function pedirPermissaoNotificacao() {
    if (typeof Notification === "undefined") {
      showToast("Seu navegador não suporta notificações");
      return;
    }
    if (Notification.permission === "granted") {
      setNotificacoesAtivas(true);
      showToast("Notificações já estão ativadas");
      return;
    }
    Notification.requestPermission().then((permissao) => {
      setNotificacoesAtivas(permissao === "granted");
      showToast(
        permissao === "granted"
          ? "Notificações ativadas — vamos avisar quando seu pedido mudar de status 🔔"
          : "Notificações não autorizadas pelo navegador",
      );
    });
  }

  function estimarTempoFilaPedido(pedido) {
    return estimarTempoFila(filaAtiva, pedido);
  }

  // Tudo que qualquer componente pode ler/chamar via useApp() — um objeto
  // só, recriado a cada render do Provider (por isso os formulários não-
  // controlados de AccountSheet, ver account.jsx). Agrupado por assunto na
  // mesma ordem dos blocos de estado acima, pra facilitar achar a função
  // correspondente a cada pedaço de estado.
  const value = {
    fmt,
    // carrinho / checkout
    cart,
    itensAtivos,
    tipoPedido,
    setTipoPedido,
    formaPagamento,
    setFormaPagamento,
    pagamentoTiming,
    setPagamentoTiming,
    pagarDepoisComo,
    setPagarDepoisComo,
    cartaoEscolhidoId,
    setCartaoEscolhidoId,
    dinheiroOpcao,
    escolherOpcaoDinheiro,
    precisaTroco,
    setPrecisaTroco,
    valorTroco,
    setValorTroco,
    trocoCalculado,
    gerarPixCopiaCola,
    numeroMesa,
    setNumeroMesa,
    enderecoEntrega,
    setEnderecoEntrega,
    enderecos,
    salvarEndereco,
    selecionarEndereco,
    removerEndereco,
    agendamento,
    setAgendamento,
    observacoes,
    setObservacoes,
    cupomAplicado,
    aplicarCupom,
    removerCupom,
    usarCashbackNoCarrinho,
    setUsarCashbackNoCarrinho,
    saldoCashbackDisponivel,
    pessoasDivisao,
    alterarPessoasDivisao,
    divisaoPagamentos,
    definirPagamentoDivisao,
    valoresDivisaoConta,
    divisaoModo,
    setDivisaoModo,
    valoresDivisaoPorParticipante,
    dividindoAConta,
    divisaoPagamentosPorNome,
    definirPagamentoDivisaoPorNome,
    chamarGarcomAgora,
    adicionarItemAoCarrinho,
    removerDoCarrinho,
    incQtdCarrinho,
    decQtdCarrinho,
    totalCarrinho,
    calcularDesconto,
    totalComDesconto,
    estimarTempoPedido,
    estimarTempoFilaPedido,
    cartOpen,
    abrirCarrinho,
    fecharCarrinho,
    finalizarPedido,
    // pedido em grupo
    grupoAtivo,
    grupoObj,
    criarGrupoPedido,
    entrarGrupoPedido,
    sairGrupoPedido,
    // pix / checkout
    pixOpen,
    pixEtapa,
    pixCarregando,
    fecharPix,
    simularPagamento,
    // favoritos
    favoritos,
    isFavorito,
    toggleFavorito,
    favoritosPersonalizados,
    temPersonalizacao,
    salvarComboAtual,
    precoComboPersonalizado,
    adicionarFavoritoPersonalizadoAoCarrinho,
    removerFavoritoPersonalizado,
    // pedidos / histórico
    pedidos,
    statusTick,
    repetirPedido,
    avaliarPedido,
    pedidoAvaliandoId,
    // ficha do produto
    produtoAtual,
    qtdAtual,
    selecaoAddons,
    selecaoIngredientes,
    productSheetOpen,
    abrirProduto,
    fecharProduto,
    incQtd,
    decQtd,
    alterarAddonQtd,
    toggleIngrediente,
    calcularTotalProduto,
    adicionarProdutoAoCarrinho,
    // avaliações
    getReviews,
    mediaEstrelas,
    enviarAvaliacao,
    // chamado de garçom (motivo + avaliação de atendimento)
    chamadaPendenteAvaliacao,
    avaliarGarcom,
    // navegação / busca
    tabAtiva,
    setTabAtiva,
    termoBusca,
    setTermoBusca,
    searchOpen,
    setSearchOpen,
    irParaInicio,
    iaResultado,
    iaCarregando,
    iaErro,
    buscarComIA,
    limparBuscaIA,
    // conta
    sessao,
    nomeExibicao,
    contaOpen,
    abrirConta,
    fecharConta,
    favoritosOpen,
    abrirFavoritos,
    fecharFavoritos,
    pedidosOpen,
    abrirPedidos,
    fecharPedidos,
    fidelidadeOpen,
    abrirFidelidade,
    fecharFidelidade,
    extratoOpen,
    abrirExtrato,
    fecharExtrato,
    reservasOpen,
    abrirReservas,
    fecharReservas,
    criarReservaMesa,
    cancelarReservaMesa,
    resgatarPontos,
    login,
    cadastro,
    continuarComoVisitante,
    sair,
    verificarEmailCadastrado,
    confirmarEmail,
    reenviarCodigoEmail,
    redefinirSenha,
    // indique um amigo
    codigoIndicacaoAtual,
    totalAmigosIndicados,
    usarCodigoIndicacao,
    // missão semanal
    missaoSemanalAtual,
    resgatarMissao,
    // oferta personalizada
    ofertaPersonalizadaAtual,
    aplicarOfertaPersonalizada,
    dispensarOfertaPersonalizada,
    // clube de assinatura
    assinaturaAtiva,
    assinarClube,
    cancelarAssinaturaClube,
    // carteira
    recarregarSaldoCarteira,
    carteiraOpen,
    abrirCarteira,
    fecharCarteira,
    carteiraDesbloqueada,
    bloquearCarteira,
    criarPinCarteira,
    desbloquearCarteira,
    adicionarCartaoCarteira,
    removerCartaoCarteira,
    comprarValePresenteCarteira,
    resgatarValePresenteCarteira,
    // acessibilidade
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
    legendaAtual,
    falarTexto,
    notificacoesAtivas,
    pedirPermissaoNotificacao,
    a11yBarOpen,
    setA11yBarOpen,
    garcomBarOpen,
    setGarcomBarOpen,
    // toast
    toast,
    showToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook usado por todo componente que precisa de estado/ações globais — o
// único jeito de ler o AppContext (nenhum componente usa useContext direto).
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp precisa estar dentro de <AppProvider>");
  return ctx;
}
