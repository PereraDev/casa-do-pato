# Pessoa 2 — Conta, Login e Atendimento em Tempo Real

Fatia funcional: **quem é o cliente** (login/cadastro/visitante),
**acompanhamento ao vivo** (chamar garçom, pedido em grupo, status do
pedido, mesas) e o **shell** do app (header, navegação, acessibilidade,
notificações). É a fatia com mais Socket.IO — cobre React (cliente), JS
vanilla (admin) e Fastify+Prisma (back-end) — ver `README.md` na raiz desta
pasta.

## 1. Front-end cliente (React) — arquivos inteiros

- `src/components/header.jsx` — `TopBar`, `AccessibilityBar`, `GarcomBar`,
  `SearchBar`, `TabsNav`, `BottomNav`.
- `src/App.jsx` — `App` (layout raiz) + os 4 componentes soltos:
  `ModalSheet`, `Toast`, `LegendaFlutuante`, `AvaliarGarcomPrompt`.
- `src/components/orders.jsx` — `OrdersSection`, `OrdersSheet`, `OrderCard`,
  `StatusStepper`, `MapaEntrega`.
- `src/components/cart.jsx` → só o componente `GrupoPedido` (o resto do
  arquivo é da Pessoa 1 — combine antes de editar o mesmo arquivo).
- Dentro de `src/components/account.jsx` (arquivo compartilhado com a
  Pessoa 3 — vejam a seção "arquivos que são de todo mundo" no `README.md`):
  `AccountSheet`, `PerfilLogado`, `LoginCadastro`, `RecuperarSenha`,
  `MedidorForcaSenha`, `ReservaMesaSheet` (linhas ~1–535 e ~1305 em diante
  do arquivo atual — confira com `grep -n "^export function\|^function "
  src/components/account.jsx`).

## 2. `src/context/AppContext.jsx` — funções e estados que são seus

⚠️ Arquivo compartilhado.

- Estados: `numeroMesa`, `grupoAtivo`, `grupoObj`, `pedidos`, `filaAtiva`,
  `sessao`, `viewMode`, `tabAtiva`, `termoBusca`, `searchOpen`,
  `pedidoAvaliandoId`, `contaOpen`, `pedidosOpen`, `reservasOpen`,
  `minhasChamadasIds`, `contrasteAlto`, `fontScale`, `reduzirMovimento`,
  `leitorAtivo`, `legendasAtivas`, `legendaAtual`, `notificacoesAtivas`,
  `a11yBarOpen`, `garcomBarOpen`, `toast`, `statusTick`,
  `chamadaParaAvaliar`.
- Funções: `recarregarPedidos`, `falarTexto`, `falarResumoPedido`,
  `showToast`, `chamadaPendenteAvaliacao`, `avaliarGarcom`, `irParaInicio`,
  `chamarGarcomAgora`, `criarGrupoPedido`, `entrarGrupoPedido`,
  `sairGrupoPedido`, `nomeExibicao`, `abrirConta`, `fecharConta`,
  `abrirPedidos`, `fecharPedidos`, `abrirReservas`, `fecharReservas`,
  `criarReservaMesa`, `cancelarReservaMesa`, `login`, `cadastro`,
  `continuarComoVisitante`, `sair`, `verificarEmailCadastrado`,
  `redefinirSenha`, `toggleContraste`, `aumentarFonte`, `diminuirFonte`,
  `toggleReduzirMovimento`, `toggleLeitor`, `toggleLegendas`,
  `pedirPermissaoNotificacao`, `estimarTempoFilaPedido`.
- ⚠️ **Ponto de contato com a Pessoa 1**: `adicionarItemAoCarrinho`,
  `removerDoCarrinho`, `incQtdCarrinho`, `decQtdCarrinho` (funções dela)
  verificam `grupoAtivo` (seu) e chamam a API de grupo nesse caso — não
  duplique essa lógica, só garanta que a rota de grupo aceita a chamada
  que ela faz.
- ⚠️ **Ponto de contato com a Pessoa 1**: `finalizarPedido`/
  `enviarPedidoAoServidor` (dela) usam `sessao` (sua) pra identificar o
  cliente — não mudam o "dono" da função, só combinem a forma como a
  sessão é lida.

## 3. `src/utils/utils.js` — o que é seu

- `apiFetch` (cliente HTTP pro back-end) e o singleton do Socket.IO
  (`socket`/`io()`).
- `useLocalStorageState`/`useLocalStorageString` (hooks genéricos).
- `MOTIVO_GARCOM` (motivos do chamado de garçom).
- Reservas de mesa (helpers usados por `criarReservaMesa`/
  `cancelarReservaMesa`).
- `statusPedido` (deriva o status pelo tempo/`statusManual`) e
  `estimarTempoFila`.
- Mapa de entrega (`COORDS_LOJA`, `coordsEntregaPedido`,
  `interpolarPosicao`).

## 4. `src/style.css` — suas seções

Tokens de tema · Modo alto contraste · Acessibilidade · Header fixo ·
Topbar · Navegação inferior (Bottom Nav) · Navegação principal (abas) ·
Toast · Responsivo · Conta (login/cadastro/visitante) · Meus pedidos
(histórico) · Pedido em grupo · Mapa de entrega · ETA pela fila real ·
Chamado de garçom: avaliação do atendimento · Legenda flutuante.

## 5. Painel administrativo

- `public/admin/operacao.js` — `renderCozinha`, `mesasComStatus`,
  `renderMesas`, `renderDelivery` (o PDV/Caixa, no mesmo arquivo, é da
  Pessoa 1).
- `public/admin/desempenho.js` — `renderGarcons` (o resto do arquivo é da
  Pessoa 1).
- `public/admin/gestao.js` — `renderClientes`, `gruposSections`,
  `renderChecklistSecoes`, `renderFuncionarios` (`renderFidelidade`/
  `renderModalAjusteFidelidade`, no mesmo arquivo, são da Pessoa 3).
- `public/admin/nav.js` — inteiro (`buildShell`, `buildNav`, `goTo`,
  `renderAll`, rail de navegação).
- `public/admin/init.js` — inteiro (login/logout do painel).
- `public/admin.html` — o shell (CSS + esqueleto do `<body>`).
- `public/admin/core.js` — `lsGet`/`lsSet`/`api`, `getChamadasGarcom` até
  `atenderChamada`, `getFuncoes` até `secoesPermitidas`, `getUsuarios`/
  `carregarUsuariosCache`, os helpers genéricos (`brl`, `initials`,
  `dateBR`, `esc`, `exportarCSV`, `statusPill`, `starRow`, `inPeriod`),
  `carregarCachesEmTempoReal`/`initSocket`.

## 6. Back-end (`server/`)

- `server/src/routes/auth.js` — inteiro (cadastro/login/logout/me/
  recuperar/redefinir).
- `server/src/routes/garcom.js` — inteiro.
- `server/src/routes/grupo.js` — inteiro.
- `server/src/plugins/session.js` — inteiro (cookie de sessão,
  `userId`/`guestId`).
- `server/src/plugins/sockets.js` — inteiro (rooms, conexão do Socket.IO).
- `server/src/plugins/staticFrontend.js`, `server/src/app.js`,
  `server/src/server.js` — bootstrap/infra: entendam e mantenham, mas não
  é código pra "reescrever do zero" (⚠️ os outros dois só adicionam a
  própria linha de `fastify.register(...)` em `app.js` — não mexam na
  parte um do outro).
- `server/prisma/schema.prisma` — `model User`, `model WaiterCall`,
  `model GroupOrder`, `model GroupParticipant`, `model GroupItem` (⚠️
  combine com os outros dois antes de editar o arquivo).
- `server/src/lib/serializers.js` — a parte de serialização de chamada de
  garçom e de grupo (a parte de pedido é da Pessoa 1 — mesmo arquivo,
  seções diferentes).

## O que você usa mas não reescreve

- Cálculo de fidelidade/cashback/carteira (Pessoa 3) — o
  `AvaliarGarcomPrompt`/histórico só exibem dado, não calculam pontos.
- `montarPedidoPendente`/checkout em si (Pessoa 1) — vocês só consomem
  `pedidos` depois de gravado.
