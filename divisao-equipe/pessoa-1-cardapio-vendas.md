# Pessoa 1 — Cardápio, Carrinho, Checkout e Vendas

Fatia funcional: tudo que vai da **descoberta do prato até o pedido virar
uma venda registrada** — cardápio, ficha do produto, carrinho, checkout
simulado, e o espelho disso tudo no PDV/relatórios do admin. Cobre React
(cliente), JS vanilla (admin) e Fastify+Prisma (back-end) — ver
`README.md` na raiz desta pasta pra entender por que a divisão é assim.

## 1. Front-end cliente (React) — arquivos inteiros

Reescrever do zero, mantendo o mesmo comportamento (pode conferir contra o
app rodando: `npm run dev:all`):

- `src/components/menu.jsx` — `MenuContent`, `FidelidadeBanner` (só a
  faixa/leitura de saldo — a lógica de cálculo é da Pessoa 3, ver seção 6),
  `MenuSections`, `FavoritesSection`, `FavoritesSheet`, `ItemCard`,
  `ComboCard`, `Estrelas`. **Exceto** `OfertaPersonalizada` — esse
  componente é da Pessoa 3 (mora neste arquivo, mas é engajamento/cupom
  automático, não cardápio).
- `src/components/product.jsx` — `ProductSheet`, `AddonGroup`,
  `Ingredientes`, `SalvarCombo`, `Reviews`.
- `src/components/cart.jsx` — `CartDrawer`, `CartItem`, `PedidoInfo`,
  `FormaPagamento`, `CartExtra`, `Upsell`. **Exceto** `GrupoPedido` — é da
  Pessoa 2 (pedido em grupo é tempo real).
- `src/components/checkout.jsx` — `PixSheet` inteiro.
- `src/data/data.js` — inclusive `baixarEstoque()`.
- `src/main.jsx` e `index.html` (entry point do Vite).

## 2. `src/context/AppContext.jsx` — funções e estados que são seus

⚠️ Arquivo compartilhado — mexa só nestes trechos (ver `README.md` seção
"arquivos que são de todo mundo"):

- Estados: `cart`, `formaPagamento` + sub-escolhas (`pagamentoTiming`,
  `pagarDepoisComo`, `cartaoEscolhidoId`, `dinheiroOpcao`, `precisaTroco`,
  `valorTroco`), `enderecoEntrega`, `observacoes`, `cupomAplicado`,
  `pessoasDivisao`, `agendamento`, `enderecos`, `divisaoPagamentos`,
  `divisaoModo`, `divisaoPagamentosPorNome`, `reviewsUser`, `favoritos`,
  `iaResultado`/`iaCarregando`/`iaErro`, `produtoAtual`/`qtdAtual`/
  `selecaoAddons`/`selecaoIngredientes`, `productSheetOpen`, `cartOpen`,
  `pixOpen`, `favoritosOpen`, `pixEtapa`/`pixCarregando`.
- Funções: `definirPagamentoDivisaoPorNome`, `buscarComIA`,
  `limparBuscaIA`, `isFavorito`, `toggleFavorito`, `abrirProduto`,
  `fecharProduto`, `incQtd`, `decQtd`, `alterarAddonQtd`,
  `toggleIngrediente`, `calcularTotalProduto`, `adicionarProdutoAoCarrinho`,
  `comboPersonalizadoAtual`, `temPersonalizacao`, `salvarComboAtual`,
  `precoComboPersonalizado`, `adicionarFavoritoPersonalizadoAoCarrinho`,
  `removerFavoritoPersonalizado`, `getReviews`, `mediaEstrelas`,
  `enviarAvaliacao`, `adicionarItemAoCarrinho`, `removerDoCarrinho`,
  `incQtdCarrinho`, `decQtdCarrinho`, `totalCarrinho`, `calcularDesconto`,
  `totalComDesconto` (⚠️ ponto de contato: usa `saldoCashbackDisponivel`/
  `calcularDescontoCashback`, que são da Pessoa 3 — só consome, não
  reescreve), `estimarTempoPedido`, `escolherOpcaoDinheiro`,
  `trocoCalculado`, `gerarPixCopiaCola`, `aplicarCupom`, `removerCupom`,
  `alterarPessoasDivisao`, `definirPagamentoDivisao`,
  `valoresDivisaoConta`, `valoresDivisaoPorParticipante`,
  `dividindoAConta`, `abrirCarrinho`, `fecharCarrinho`,
  `montarPedidoPendente`, `finalizarPedido` (⚠️ ponto de contato: chama
  `enviarPedidoAoServidor`, que grava sessão/login — combine com a Pessoa
  2 antes de alterar a assinatura dessa função), `fecharPix`,
  `enviarPedidoAoServidor`, `simularPagamento`, `enviarPedidoPagarDepois`,
  `repetirPedido`, `avaliarPedido`, `salvarEndereco`,
  `selecionarEndereco`, `removerEndereco`, `abrirFavoritos`,
  `fecharFavoritos`, `resgatarPontos` (⚠️ ponto de contato: mexe em
  saldo de fidelidade, que é modelo/lógica da Pessoa 3 — só chama).

## 3. `src/utils/utils.js` — o que é seu

- Formatação genérica (ex. `brl`/equivalentes usados no carrinho/checkout).
- Cálculo de cupom/desconto.
- `PAGAMENTO_LABEL` (rótulos de forma de pagamento no histórico/recibo).
- Chamada HTTP da busca por IA (o wrapper que o `buscarComIA` usa).

## 4. `src/style.css` — suas seções

Procure pelos comentários de seção (`/* ---... */`) com estes títulos:
Seções / carrossel horizontal · Detalhe do produto / adicionais ·
Avaliações · Favoritos · Carrinho · Informações do pedido no carrinho ·
Up-sell / cross-sell · Cupom de desconto, divisão da conta e tempo
estimado (`#cartExtra`) · Checkout / Pagamento Pix · Agendamento ·
Endereços salvos · Divisão de pagamento por pessoa · Avaliação com foto.

## 5. Painel administrativo (`public/admin.html` + `public/admin/*.js`)

- `public/admin/produtos.js` — `renderPratos`, `renderModalEditarPrato`,
  `renderCategorias`, `renderModalEditarCategoria`, `renderAdicionais`,
  `renderModalEditarGrupo` (as funções de Insumos/Ficha Técnica no mesmo
  arquivo são da Pessoa 3).
- `public/admin/operacao.js` — tudo de **PDV** e **Caixa**: `pdvDisponivel`,
  `pdvSubtotal`, `pdvCupomValido`, `pdvDesconto`, `pdvTaxaEntrega`,
  `pdvTotal`, `pdvAdicionar`, `pdvAlterarQtd`, `pdvValoresDivisao`,
  `pdvDivisaoHtml`, `pdvAjustarPessoas`, `pdvFinalizarVenda`,
  `imprimirRecibo`, `renderPdv`, `wireCaixaBarButtons`, `renderModais`
  (`renderCozinha`/`mesasComStatus`/`renderMesas`/`renderDelivery`, no
  mesmo arquivo, são da Pessoa 2).
- `public/admin/vendas.js` — `renderAvaliacoes`, `renderPedidos`
  (`renderCaixas`, no mesmo arquivo, é da Pessoa 3 — Histórico de Caixas é
  tema financeiro).
- `public/admin/desempenho.js` — `renderDashboard`, `kpi`,
  `drawRevenueChart`, `renderProdutosDesempenho` (`renderGarcons`, no
  mesmo arquivo, é da Pessoa 2).
- `public/admin/sistema.js` — `renderConfiguracoes` (`renderFinanceiro` —
  folha de pagamento — é da Pessoa 3).
- `public/admin/core.js` — funções de cardápio/pedidos: linhas ~1–48
  (estado base, `SECTIONS`, mocks de cardápio), `getCategoriasDados` até
  `catLabel`, `getAddonDados` até `removeAddonGroupExtra`, `getDishes` até
  `isBaseDish`, `getReviews`, `statusPedidoReal` até `avancarStatusPedido`,
  `getConfigLoja`/`saveConfigLoja`/`lojaAberta`, `setEstoqueDish`/
  `decrementarEstoque`.

## 6. Back-end (`server/`)

- `server/src/routes/pedidos.js` — inteiro (`POST /api/pedidos`,
  `POST /api/pedidos/pdv`, `GET /api/pedidos/meus`, `GET
  /api/pedidos/fila`, `GET /api/pedidos/todos`, `PATCH
  /api/pedidos/:id/status`, `PATCH /api/pedidos/:id/cancelar`). ⚠️ ponto
  de contato: identidade do pedido (`userId`/`guestId`) vem da sessão —
  entender `server/src/plugins/session.js` (da Pessoa 2), não reescrever.
- `server/src/routes/ia.js` — inteiro (busca por IA/Gemini).
- `server/src/lib/ids.js` e `server/src/lib/serializers.js` — inteiros
  (formatação de id `PD-`/serialização de pedido; a parte de chamada de
  garçom/grupo dentro de `serializers.js`, se houver, é da Pessoa 2).
- `server/prisma/schema.prisma` — só o `model Order` (⚠️ combine com os
  outros dois antes de mexer no arquivo — ver `README.md`).
- Em `server/src/app.js`: só a linha que registra
  `fastify.register(pedidosRoutes)` / `iaRoutes`.

## O que você usa mas não reescreve

- `apiFetch`/socket (`utils.js`, Pessoa 2), sessão/login (Pessoa 2),
  cálculo de fidelidade/cashback e saldo de carteira (Pessoa 3) — o
  carrinho **consome** esse saldo (`usarCashbackNoCarrinho`), mas não é
  dono da lógica de crédito.
