# Casa do Pato — Cardápio Digital (React)

Protótipo de TCC: cardápio digital acessado via QR Code na mesa (estilo
iFood/Uber Eats, mas para pedir e pagar sem sair da mesa, sem app nativo).

**Arquitetura híbrida** desde a etapa "back-end MVP: pedidos + tempo real":
a maior parte do app (cardápio, favoritos, avaliações, fidelidade/cashback,
carteira, acessibilidade, cupom/assinatura...) continua 100% front-end,
simulada com `setTimeout` e persistida em `localStorage`, exatamente como
era antes. **4 fatias migraram pra um back-end de verdade** (`server/`, ver
seção própria abaixo): contas/login, pedidos, chamado de garçom e pedido em
grupo — essas 4 agora vivem no Postgres e sincronizam em tempo real via
Socket.IO entre qualquer dispositivo, não só entre abas do mesmo navegador
como era antes de existir back-end. Existe ainda uma **5ª fatia bem mais
leve**, a busca por IA do cardápio (`POST /api/ia/busca`) — só existe no
back-end pra não expor a chave da API do Gemini no cliente, não guarda
estado nenhum (ver "Busca por IA no cardápio" abaixo e "Back-end (`server/`)").

Este projeto tem um **painel administrativo companheiro** (`public/admin.html`
— ver "Integração com o painel administrativo" mais abaixo), que roda como
HTML solto na mesma origem. Cardápio, estoque, caixa/PDV (preço/cupom) e o
clube de fidelidade continuam compartilhados via `localStorage`, do jeito que
sempre foi; pedidos e chamado de garçom agora são compartilhados via o mesmo
back-end (REST + Socket.IO), não mais via `localStorage`.

## Stack

- **React 19** + **Vite 8** (`@vitejs/plugin-react`), sem TypeScript.
- **Sem router** — é uma SPA de tela única, a "navegação" é só troca de
  seções (rolagem) dentro da mesma página.
- **Sem biblioteca de UI/CSS** — um único `src/style.css` global, com
  variáveis CSS para tema (contraste alto, escala de fonte).
- **Sem gerenciador de estado externo** — um único Context (`AppContext`)
  concentra todo o estado da aplicação.
- **Back-end** (`server/`, ver seção própria): Node.js + Fastify + Prisma +
  PostgreSQL + Socket.IO + `@google/genai` (busca por IA). Projeto Node
  separado, próprio `package.json`.
- **Leaflet** (front-end, `leaflet` no npm) + tiles do OpenStreetMap — mapa
  de entrega real (ver "Mapa de entrega" abaixo). Gratuito, sem chave de
  API — único pacote de mapa/terceiro usado no projeto.
- Lint: `oxlint` (`npm run lint`). Build: `vite build` (`npm run build`).
  Dev server: `npm run dev` (só front) ou `npm run dev:all` (front + back
  juntos, via `concurrently`).

## Como rodar

```
npm install
npm run dev:all   # front (5173) + back (4000) juntos — recomendado
# ou separado:
npm run dev        # só o front — precisa do back rodando à parte pra
                    # pedidos/garçom/grupo/login funcionarem
npm run dev:server # só o back
npm run build       # gera dist/
npm run lint
```

Antes da 1ª vez, configure `server/.env` (copie de `server/.env.example`) com
um `DATABASE_URL` de um Postgres (ex.: projeto gratuito no
[neon.tech](https://neon.tech)) e um `SESSION_SECRET` de 32 bytes em hex
(`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
depois rode as migrations: `cd server && npm install && npm run prisma:migrate`, e crie o 1º
administrador do painel: `npm run admin:criar` (pergunta nome, e-mail e senha; em produção,
`DATABASE_URL="..." npm run admin:criar` apontando pro banco de lá).
Opcional: `GEMINI_API_KEY` (grátis em [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
pra ligar a busca por IA do cardápio — sem ela, a busca cai de volta pro
filtro de texto comum (ver "Busca por IA no cardápio" abaixo).

### Deploy (Render)

`render.yaml` na raiz descreve 1 serviço web Node (Fastify serve `dist/` + API +
Socket.IO, ver `staticFrontend.js`). Vercel e outras plataformas serverless
**não servem**: Socket.IO precisa de processo persistente, e o código de
recuperação de senha e o rate limit vivem na memória do processo. Build:
`npm install --include=dev && npm run build && cd server && npm install &&
npx prisma generate && npx prisma migrate deploy`; start: `cd server && npm run
start:prod` (sem `--env-file`, as variáveis vêm do painel). `prisma` está em
`dependencies` do server de propósito (o Render roda com `NODE_ENV=production`,
que pula devDependencies). Em produção o Fastify usa `trustProxy: 1` (1 proxy
na frente) pro rate limit enxergar o IP real; fora dela, `false`. `DATABASE_URL`
precisa ser a conexão **direta** do Neon (sem `-pooler`) pras migrations.

## Arquitetura geral

```
src/
  main.jsx                 # entry point, monta <App /> em #root
  App.jsx                  # layout raiz: monta header fixo, conteúdo, modais e toast — também
                              # carrega ModalSheet, Toast, LegendaFlutuante e AvaliarGarcomPrompt,
                              # os 4 componentes "soltos" que não pertencem a nenhuma área
  style.css                # todo o CSS do app (tema, componentes, responsivo, a11y)
  context/AppContext.jsx   # ÚNICO estado global da aplicação (ver abaixo)
  data/data.js             # "banco de dados" mockado: cardápio, categorias, cupons, avaliações
  utils/utils.js           # TODOS os helpers/hooks client-side num arquivo só: formatação,
                              # cliente HTTP (apiFetch) e singleton do Socket.IO pro back-end,
                              # useLocalStorageState/useLocalStorageString, senha, PBKDF2
                              # (criptografia), fidelidade/cashback, engajamento (indicação/
                              # missão/oferta/assinatura), carteira (PIN/cartões/vale-presente),
                              # reservas de mesa, status/pagamento de pedido e mapa de entrega —
                              # ver as seções próprias de cada assunto abaixo pra detalhe
  components/
    header.jsx    # TopBar, AccessibilityBar, GarcomBar, SearchBar, TabsNav, BottomNav
    menu.jsx      # FidelidadeBanner, MenuSections, FavoritesSection,
                    # FavoritesSheet, ItemCard, ComboCard, Estrelas, OfertaPersonalizada
    product.jsx   # ProductSheet, AddonGroup, Ingredientes, SalvarCombo, Reviews
    cart.jsx      # CartDrawer, CartItem, PedidoInfo, FormaPagamento, CartExtra, Upsell,
                    # GrupoPedido (pedido em grupo)
    checkout.jsx  # PixSheet — checkout simulado (Pix/Cartão/Dinheiro)
    orders.jsx    # OrdersSection, OrdersSheet, OrderCard, StatusStepper,
                    # MapaEntrega (mapa real)
    account.jsx   # AccountSheet (login/cadastro/perfil/indique um amigo),
                    # FidelidadeSheet (clube/cashback/missão/assinatura),
                    # ExtratoSheet (histórico de pontos/cashback),
                    # CarteiraSheet (PIN, cartões salvos, saldo, vale-presente) e
                    # ReservaMesaSheet (reservar mesa)
public/
  admin.html               # painel administrativo (HTML/JS solto) — ver seção própria abaixo
  logo-icon.png            # ícone (cabeçalho do app, menu do admin); favicon.png/apple-touch-icon.png são derivados dele
  logo-horizontal.png      # logo com nome (tela de login do admin), fundo transparente
server/                    # back-end (Node/Fastify/Prisma/Postgres/Socket.IO) — ver seção própria
```

`src/` foi reorganizado num arquivo por área (13 arquivos ao todo, contra
~60 antes) — cada área listada acima virou 1 único `.jsx`/`.js` exportando
todos os componentes/funções daquele assunto, sem trocar nome nenhum nem
comportamento. Ao longo deste documento, uma referência como
`cart.jsx#PedidoInfo` significa "o componente `PedidoInfo`, dentro de
`src/components/cart.jsx`". `ModalSheet`, `Toast`, `LegendaFlutuante` e
`AvaliarGarcomPrompt` vivem dentro do próprio `App.jsx` (chrome global, não
pertencem a nenhuma área específica) — como vários dos arquivos de área
importam `ModalSheet` de volta de `App.jsx`, e `App.jsx` importa os
componentes de cada área, existe import circular entre eles de propósito;
funciona porque cada um só é usado dentro de corpo de função/JSX (nunca
avaliado no topo do módulo), padrão comum em apps React com vários arquivos
de componente.

`App.jsx` monta tudo simultaneamente: o header fixo (`TopBar`,
`AccessibilityBar`, `SearchBar`, `TabsNav`), a faixa `FidelidadeBanner` (nível/
saldo + botão "Usar meus pontos", fixada entre as abas e as seções do
cardápio), o conteúdo principal (`MenuSections`), a navegação inferior mobile
(`BottomNav`) e os 10 modais (`ProductSheet`, `CartDrawer`, `PixSheet`,
`AccountSheet`, `FavoritesSheet`, `OrdersSheet`, `FidelidadeSheet`,
`ExtratoSheet`, `CarteiraSheet`, `ReservaMesaSheet`) sempre presentes no DOM
(escondidos via `inert`, não desmontados — ver `App.jsx#ModalSheet`).

## Estado global — `AppContext.jsx`

Um único `AppProvider` expõe tudo via `useApp()`. É o equivalente ao objeto
`state` global do protótipo vanilla original, mas em `useState`s. Cada
pedaço de estado cabe num destes grupos:

- **Persistido no localStorage** (via `useLocalStorageState`/
  `useLocalStorageString`): carrinho pessoal, tipo de pedido, forma de
  pagamento (+ sub-escolhas: quando vai pagar numa mesa, cartão salvo
  escolhido, opção de dinheiro — ver "Forma de pagamento" abaixo), mesa,
  endereço, observações, cupom, se vai usar o saldo de cashback no pedido
  atual, pessoas na divisão da conta (+ modo de divisão inteligente por
  participante), avaliações do usuário, favoritos, favoritos personalizados
  (combos salvos).
- **Vem do back-end** (`server/`, via `apiFetch`/Socket.IO — ver seção
  própria mais abaixo): `pedidos` (histórico), `sessao` (login/visitante),
  `grupoObj` (carrinho compartilhado do pedido em grupo), chamado de garçom
  pendente de avaliação. `pedidos`/`sessao` são buscados 1x no mount
  (`GET /api/pedidos/meus`/`GET /api/auth/me`) e atualizados por eventos de
  socket depois disso — não são mais `useLocalStorageState`.
- **Transiente** (só em memória, reseta ao recarregar a página): view
  ativa/aba/busca, ficha do produto aberta e sua seleção de
  adicionais/ingredientes, quais modais estão abertos, etapa do checkout,
  preferências de acessibilidade, toast.

Chaves usadas no `localStorage` (prefixo `tnm_`): `tnm_cart`,
`tnm_tipo_pedido`, `tnm_pagamento`, `tnm_mesa`, `tnm_endereco`, `tnm_obs`,
`tnm_cupom`, `tnm_usar_cashback`, `tnm_pessoas`, `tnm_reviews_user`,
`tnm_favoritos`, `tnm_favoritos_personalizados`. `tnm_pedidos` e
`tnm_sessao` **não existem mais** — pedidos e sessão de login vêm do
back-end agora (ver acima); `tnm_usuarios` também não existe mais do lado
do cliente (contas viraram tabela `User` no Postgres, ver seção do
back-end) — só sobrevive em `public/admin.html`, que tem seu próprio
sistema de login de funcionário sem relação com contas de cliente.

Chaves da forma de pagamento estendida (ver "Forma de pagamento" abaixo):
`tnm_pagamento_timing` (`"agora"` | `"depois"` — só importa pra mesa),
`tnm_pagar_depois_como` (`"garcom"` | `"caixa"`), `tnm_cartao_escolhido`
(id de um cartão salvo, ou `"motoboy"`), `tnm_dinheiro_opcao` (`"carteira"`
| `"nota"`) — `precisaTroco`/`valorTroco` são transientes de propósito
(detalhe pontual do checkout, sem sentido sobreviver a um recarregamento).

Chaves dos recursos de engajamento (só client-side, sem leitura pelo admin):
`tnm_agendamento` (pedido agendado pra balcão/entrega — `null` = assim que
possível, senão `{data, hora}`; **não existe mais pra tipo "mesa"**, ver
"Reservar mesa" abaixo), `tnm_enderecos` (lista de endereços salvos com
rótulo), `tnm_divisao_pagamentos` (forma de pagamento escolhida por pessoa
ao dividir a conta no rateio igual — ver `tnm_pessoas` acima), `tnm_grupo_ativo`
(`{codigo, participanteId, nome}` — só a identidade de qual grupo/participante
ESTE DISPOSITIVO é; o carrinho do grupo em si vem do back-end, não é mais
`tnm_grupo_<codigo>` local), `tnm_minhas_chamadas` (ids dos chamados de
garçom feitos por este cliente, usado só pra saber qual chamado pedir pra
ele avaliar depois — ver seção do back-end), `tnm_codigos_indicacao` (mapa
código → e-mail de quem indica), `tnm_indicacoes` (histórico de códigos
usados), `tnm_missoes_resgatadas` (chaves `email:inícioDaSemana` já
resgatadas, evita creditar 2x), `tnm_assinaturas` (status do Casa do Pato+
por e-mail), `tnm_reservas` (reservas de mesa por e-mail — ver "Reservar
mesa" abaixo).

Chaves da Carteira (ver "Carteira" abaixo, todas 100% client-side, sem
leitura pelo admin): `tnm_carteira_pin` (hash PBKDF2 + salt do PIN por
e-mail, nunca o PIN em texto puro), `tnm_cartoes_salvos` (cartões
simulados por e-mail — só bandeira/4 últimos dígitos/nome/validade/apelido,
nunca o número completo), `tnm_vale_presentes` (registro de vale-presentes
por código, não por e-mail — quem resgata pode não ter conta ainda quando o
código foi gerado).

Chaves adicionais compartilhadas com o **painel administrativo**
(escritas/lidas pelos dois lados — ver "Integração com o painel
administrativo"): `tnm_admin_menu_overrides`, `tnm_admin_menu_extra`
(edições de cardápio/estoque feitas no admin), `tnm_admin_categorias`
(categorias renomeadas/criadas no admin, aba Categorias),
`tnm_admin_addon_groups` (grupos de adicionais editados/criados no admin,
aba Adicionais Globais), `tnm_fidelidade` (extrato de pontos/cashback por
conta), `tnm_admin_fidelidade_config` (config do clube, editada só pelo
admin), `tnm_admin_caixas` (abertura/fechamento de caixa do PDV, só existe
no admin), `tnm_admin_config_loja` (nome da loja, horário de funcionamento, taxa de
entrega e tempo médio de preparo — só existe no admin, usada no PDV).

### Funcionalidades cobertas pelo Context

- **Carrinho**: adicionar/remover/alterar quantidade, cálculo de subtotal,
  desconto por cupom, total, estimativa de tempo de entrega/preparo.
  **Importante**: qualquer total exibido na UI (rodapé do carrinho, checkout)
  deve vir de `totalComDesconto()`, não de `totalCarrinho() - calcularDesconto()`
  — só `totalComDesconto()` também desconta o cashback usado
  (`usarCashbackNoCarrinho`/`calcularDescontoCashback`). O `cart.jsx#CartDrawer`
  já teve esse bug: mostrava o total sem refletir o cashback marcado, então
  o valor só "batia" na tela de pagamento seguinte (`checkout.jsx#PixSheet`, que
  sempre usou `totalComDesconto()` corretamente).
- **Cupons**: `TCC10` (10%) e `BEMVINDO8` (R$ 8,00), definidos em
  `data/data.js`.
- **Favoritos**: favoritar/desfavoritar item do cardápio, e "combos
  personalizados" salvos (um item + adicionais/ingredientes específicos,
  com nome próprio — estilo "meu pedido de sempre" do Starbucks).
- **Ficha do produto**: seleção de adicionais (grupos com mínimo/máximo,
  ex. "Turbine seu Hambúrguer"), personalização "monte do seu jeito"
  (remover ingredientes padrão sem alterar preço), cálculo de total.
- **Avaliações**: nota (1–5 estrelas) + comentário por item; mistura
  avaliações mockadas (`REVIEWS_MOCK`) com as do próprio usuário.
- **Busca por IA no cardápio** (`header.jsx#SearchBar`, `POST /api/ia/busca` —
  ver "Back-end (`server/`)"): opt-in, só dispara no clique em "✨ Perguntar
  à IA" ou num dos chips de sugestão livre (`SUGESTOES_IA` — "Me
  surpreenda", "Algo leve e barato" etc., pra baixar a fricção de "não sei
  o que digitar"), nunca a cada tecla digitada. Manda a pergunta + o
  catálogo inteiro (`MENU`, incluindo `tag` de promoção/novidade) pro
  back-end, que usa o **Gemini** (`gemini-3.6-flash`, tier gratuito do
  Google AI Studio) com um prompt de propósito "solto" — não é filtro por
  palavra-chave, é pra agir como recomendação de verdade: pode opinar,
  montar combinação (prato + bebida + sobremesa), reagir bem a pedidos
  vagos. Responde um JSON validado por schema (`resposta`: 1-3 frases;
  `itemIds`: até 8, do mais pro menos relevante) — o servidor sempre
  filtra `itemIds` contra os ids reais recebidos antes de devolver, então a
  IA nunca consegue fazer a UI mostrar um item inventado. Com resultado
  presente, `menu.jsx#MenuSections` troca o agrupamento por categoria por uma
  lista única ordenada pela relevância que a IA devolveu. Sem
  `GEMINI_API_KEY` configurada no servidor, a rota responde 503 e a UI cai
  de volta pro filtro de texto comum — nunca quebra a busca por causa
  disso.
- **Checkout simulado**: Pix, Cartão ou Dinheiro — cada um com
  texto/ícone próprios (`PAGAMENTO_CHECKOUT` em `utils/utils.js`).
  "Pagar" é um botão que dispara dois `setTimeout` em sequência
  (confirmação → preparo, encenação preservada exatamente como antes) e só
  então **grava o pedido de verdade no back-end** (`POST /api/pedidos`,
  dentro do 2º `setTimeout`, via `enviarPedidoAoServidor` — reaproveitada
  também pelo fluxo "pagar depois" da mesa, ver abaixo) — é nesse mesmo
  ponto que o pedido também baixa estoque (`baixarEstoque`, ainda 100%
  client-side) e credita/debita fidelidade (`creditarCompra`/`usarCashback`,
  idem), nunca antes da confirmação. Diferença de quando isso era só
  `localStorage`: agora essa gravação pode falhar de verdade (rede/servidor)
  — se falhar, mostra um toast de erro e **não** limpa carrinho/cupom, pra
  dar pra tentar de novo.
  - **Forma de pagamento** (`cart.jsx#FormaPagamento`): cada forma abre uma
    sub-escolha, só pra dar mais contexto no checkout — nenhuma delas
    processa pagamento de verdade (sem gateway real, mesmo espírito do
    resto do checkout):
    - **Pix**: ao chegar no `PixSheet`, `gerarPixCopiaCola` monta um código
      "Copia e Cola" solto (formato inspirado no BR Code/EMVCo, **não é um
      payload Pix válido**) com botão de copiar — regenerado a cada
      checkout aberto (`PixSheet` nunca desmonta, ver "Modais/janelas",
      então um `useEffect` watching `pixOpen` gera um código novo toda vez,
      não só na 1ª montagem).
    - **Cartão**: escolhe entre os cartões salvos na Carteira (ver
      "Carteira" abaixo, lidos direto de `utils/utils.js#getCartoesSalvos`)
      ou, só em pedido tipo "Entrega", "pagar na maquininha do motoboy"
      (`cartaoEscolhidoId === "motoboy"`). O `pagamento` gravado no pedido
      vira `"cartao-motoboy"` nesse caso, só `"cartao"` nos outros — ver
      `PAGAMENTO_LABEL` em `utils/utils.js` pros rótulos.
    - **Dinheiro**: "Usar saldo da carteira" (atalho que liga
      `usarCashbackNoCarrinho`, mesmo mecanismo de desconto que já existia
      — não é um método de pagamento novo, só reorganizado como opção) ou
      "Pagar em nota" (rótulo muda por tipo: "pro entregador"/"pro
      garçom"/"no caixa"), que revela uma calculadora de troco — "Precisa
      de troco?" sim/não e, se sim, "vai pagar com quanto" (`valorTroco`,
      `trocoCalculado()` no `AppContext`, mesmo cálculo que o troco do PDV
      do admin já tinha, agora do lado do cliente). O `pagamento` gravado
      vira `"dinheiro-carteira"` ou `"dinheiro-nota"`. **O troco e o cartão
      escolhido não são gravados no pedido** — só existem durante o
      checkout, mesma limitação que o troco do PDV já tinha (ver
      "Limitações conhecidas").
- **Clube de fidelidade + cashback** (`utils/utils.js`): só funciona
  pra quem está logado (pedido de visitante não linka a nenhuma conta). Cada
  compra credita pontos (multiplicados pelo nível — Bronze/Prata/Ouro,
  calculado por pontos acumulados na vida toda, `pontosVitalicios`) e
  cashback (% configurável). Pontos vencem: cada compra gera um **lote**
  com validade própria, e resgates/ajustes consomem os lotes mais antigos
  primeiro (FIFO) — pontos vencidos somem sozinhos do saldo gastável, sem
  job de limpeza. Cashback vira saldo de carteira, aplicável como desconto
  no carrinho (`usarCashbackNoCarrinho`, ver `cart.jsx#CartExtra`). Interface
  dividida em duas janelas: `account.jsx#FidelidadeSheet` (nível, saldo, aviso de
  pontos vencendo em 30 dias, catálogo de recompensas com filtro por custo
  em pontos) — aberta só pelo botão "Usar meus pontos" do `FidelidadeBanner`
  no topo do cardápio, não tem mais entrada pelo painel de conta — e
  `account.jsx#ExtratoSheet` (histórico de lançamentos: compra, resgate, uso de
  cashback, ajuste da equipe, recarga, vale-presente comprado/resgatado —
  ver "Carteira" abaixo), aberta pelo item "Extrato" em "Sua conta".
  Saldo/recarga da carteira (que antes vivia dentro do `FidelidadeSheet`,
  seção "Carteira") virou a janela própria `account.jsx#CarteiraSheet`, ver abaixo
  — o que sobrou aqui é só um link "Abrir carteira →" apontando pra lá.
  Configuração (pontos por real, validade, % cashback, níveis, recompensas)
  é editada só pelo painel admin, em `tnm_admin_fidelidade_config`.
  O catálogo de recompensas em `FidelidadeSheet` é renderizado como
  cards horizontais roláveis (imagem/ícone + nome + custo em pontos, estilo
  "Clube BK") — recompensa sem `foto` cadastrada cai no ícone 🎁; a que o
  saldo atual não alcança fica com opacidade reduzida e um cadeado 🔒 por
  cima da imagem, botão "Resgatar" desabilitado. O campo opcional `foto`
  (dataURL base64) é definido só pelo admin, na aba Fidelidade.
- **Pedidos / histórico**: os pedidos em si (`pedidos` no `AppContext`)
  agora vêm do back-end — `GET /api/pedidos/meus` no mount (escopado pela
  sessão: conta logada ou `guestId` de visitante, nunca "todos os pedidos
  deste navegador" como era antes) e mantidos em dia por um listener de
  socket (`pedido:atualizado`) que faz patch no array local quando o admin
  avança o KDS ou cancela. O **cálculo do status em si continua 100%
  client-side**: `statusPedido` (`utils/utils.js`) deriva do tempo
  decorrido desde `criadoEm`: recebido (0–10s) → preparo (10–30s) → pronto
  (30–50s) → entregue (50s+) — puramente uma simulação de UX estilo "pizza
  tracker" do Domino's, sem precisar do servidor pra isso. **Exceção**: se a
  equipe mexer no pedido pelo Painel de Cozinha (KDS) do admin, ele ganha um
  campo `statusManual` gravado no banco (`PATCH /api/pedidos/:id/status`,
  que emite `pedido:atualizado` pro dono do pedido em tempo real), e a
  partir daí `statusPedido` ignora o relógio pra sempre nesse pedido — vira
  "cozinha real" pontual, sem afetar os pedidos que ninguém tocou. Um
  `setInterval` de 3s (client-side, sem depender do servidor) recalcula o
  status e dispara um toast quando ele muda, além de também repuxar a fila
  pública (`filaAtiva`, ver "Tempo estimado pela fila real" abaixo).
  "Repetir pedido" reenche o carrinho; "Avaliar pedido" abre a ficha do 1º
  item do pedido com o formulário de avaliação em foco. Cada pedido carrega
  também `clienteEmail` (derivado da sessão no servidor, nunca confiado do
  corpo da requisição), `cashbackUsado`, `agendamento` (`null` ou `{data,
  hora}` — ver "Pedido agendado" abaixo), `divisao` (array por pessoa
  quando a conta foi dividida — ver "Split de pagamento" abaixo) e `grupo`
  (`{codigo, participantes}` quando veio de um pedido em grupo, senão
  `null`) — campos lidos pelo painel admin (ou só exibidos de volta pro
  próprio cliente no histórico), não usados em mais nada do lado do
  cliente.
- **Pedido agendado**: só pra tipo "Retirar no balcão" ou "Entrega" — no
  carrinho, alternar "Assim que possível" / "📅 Agendar horário"
  (`cart.jsx#PedidoInfo`) grava `{data, hora}` em `agendamento` (`tnm_agendamento`)
  — só é anexado ao pedido em `montarPedidoPendente`; nada dispara
  automaticamente no horário marcado (sem back-end, é só um dado que
  acompanha o pedido e aparece no histórico do cliente). **Não existe mais
  pra tipo "Na mesa"** — não fazia sentido agendar horário de quem já está
  sentado à mesa; virou "Reservar mesa" no perfil (ver abaixo). Um `useEffect`
  em `AppContext` limpa `agendamento` sozinho se o tipo virar "mesa" com um
  agendamento herdado de balcão/entrega.
- **Endereços salvos**: lista de endereços com rótulo (`enderecos` /
  `tnm_enderecos`, `salvarEndereco`/`selecionarEndereco`/`removerEndereco`
  no `AppContext`) — exibidos como chips em `cart.jsx#PedidoInfo` quando o tipo
  é "Entrega", pra preencher `enderecoEntrega` com 1 toque em vez de
  redigitar toda vez.
- **Reservar mesa** (`account.jsx#ReservaMesaSheet`, `utils/utils.js`): janela
  própria no perfil (item "Reservar mesa" em "Sua conta"), sem relação com
  nenhum pedido específico — herdou o conceito do agendamento que saiu do
  carrinho de mesa (ver "Pedido agendado" acima). Formulário simples (data,
  hora, quantas pessoas, observação opcional), 100% `localStorage` por
  e-mail (`tnm_reservas`), com lista das reservas feitas e cancelamento —
  só pra quem está logado.
- **Pedido em grupo** (rotas `/api/grupo/*` no back-end, painel
  `cart.jsx#GrupoPedido`): carrinho compartilhado por código de 5
  caracteres, agora sincronizado **de verdade entre dispositivos
  diferentes** via Postgres + Socket.IO (room `grupo:<codigo>`) — não é
  mais uma limitação do protótipo, era a principal motivação da etapa de
  back-end. `grupoAtivo` (`{codigo, participanteId, nome}`) continua
  `useLocalStorageState` — é identidade de qual grupo/participante **este
  dispositivo** é, isso genuinamente é por dispositivo; já `grupoObj` (o
  carrinho compartilhado em si) é `useState` alimentado por
  `GET /api/grupo/:codigo` ao entrar/criar + patches em tempo real dos 6
  eventos `grupo:*` (participante entrou/saiu, item adicionado/removido/
  alterado, carrinho limpo no checkout). Enquanto `grupoAtivo` está setado,
  `itensAtivos` (o que a UI mostra/edita) passa a ser `grupoObj.itens` em
  vez do carrinho pessoal — `adicionarItemAoCarrinho`/`removerDoCarrinho`/
  `incQtdCarrinho`/`decQtdCarrinho` todos verificam `grupoAtivo` e chamam a
  API nesse caso; o checkout (`montarPedidoPendente`) usa os itens do grupo
  e marca cada item com `participanteNome`. **Importante**: por causa
  disso, qualquer componente que lista/conta itens do carrinho (badge de
  quantidade, upsell etc.) precisa ler `itensAtivos` do Context, nunca
  `cart` direto — `cart` é só o carrinho pessoal e fica vazio durante um
  pedido em grupo. `header.jsx#BottomNav` e `cart.jsx#Upsell` já tiveram esse bug (liam
  `cart`, então o badge do carrinho no mobile ficava zerado e o carrossel
  de upsell sumia/sugeria itens repetidos durante um pedido em grupo).
- **Split de pagamento por pessoa**: ao dividir a conta ("Na mesa"),
  `cart.jsx#CartExtra` oferece dois modos (`divisaoModo`, só relevante dentro de
  um pedido em grupo com ≥2 participantes com item no carrinho):
  - **Rateio igual** (`valoresDivisaoConta`, sempre disponível): divide o
    total em `pessoasDivisao` partes iguais (arredondadas ao centavo, resto
    na última pessoa — mesmo cálculo do PDV do admin), com seletor de forma
    de pagamento (Pix/Débito/Crédito/Dinheiro) por pessoa
    (`divisaoPagamentos` / `tnm_divisao_pagamentos`).
  - **Divisão inteligente por participante** (`divisaoModo === "porPedido"`,
    padrão dentro de um pedido em grupo — ver "Pedido em grupo" abaixo):
    em vez de ratear igual, soma o que cada participante realmente pediu
    (`valoresDivisaoPorParticipante`, usando `participanteNome` que cada
    item do carrinho de grupo já carrega) e rateia cupom/cashback usado
    proporcionalmente, com forma de pagamento por pessoa
    (`divisaoPagamentosPorNome`). Só existe porque o pedido em grupo já
    tinha esse dado — nenhum concorrente com carrinho compartilhado expõe
    esse cálculo.
  O pedido grava `pagamento:"dividido"` + `divisao: [{pessoa, valor,
  pagamento}]` nos dois modos (`pessoa` é um número no rateio igual, o
  nome do participante na divisão inteligente), mesmo formato que o PDV do
  admin já usava — o `orders.jsx#OrderCard` do cliente exibe essa divisão no
  histórico, tratando `pessoa` numérico ("Pessoa N") e nome (direto) de
  forma diferente na exibição.
- **Mesa — pagar agora ou depois**: só pra tipo "Na mesa", uma escolha
  antes da forma de pagamento em si (`pagamentoTiming`, `cart.jsx#PedidoInfo`) —
  **"Pagar agora"** cai no fluxo normal de Pix/Cartão/Dinheiro; **"Pagar
  depois"** esconde a forma de pagamento e pede só "Chamando o garçom" ou
  "Pagando no caixa" (`pagarDepoisComo`), imitando como se paga de verdade
  numa mesa de restaurante. Nesse caso, `finalizarPedido` **pula o
  `PixSheet` inteiro** — não tem pagamento pra simular — e chama
  `enviarPedidoPagarDepois`, que grava o pedido direto no back-end
  (reaproveitando `enviarPedidoAoServidor`, ver "Checkout simulado" acima)
  com `pagamento: "pendente-garcom"` ou `"pendente-caixa"`. O pedido já
  vai pra cozinha na hora — só o pagamento em si fica pendente; o
  `orders.jsx#OrderCard` mostra esse estado no histórico via `PAGAMENTO_LABEL`
  ("A pagar — chamando o garçom"/"A pagar — no caixa").
- **Chamar garçom** (`chamarGarcomAgora` no `AppContext`, `POST
  /api/garcom/chamadas` no back-end): registra um pedido de atendimento,
  associado ao número de mesa salvo (`numeroMesa`/`tnm_mesa`) — pede pra
  informar a mesa se ainda não tiver uma salva. Tem throttle de 60s no
  cliente (evita clique repetido acidental, não persistido — recarregar a
  página libera de novo; se a chamada falhar, o throttle é liberado na
  hora pra dar pra tentar de novo). Ao chamar, escolhe um **motivo**
  (`MOTIVO_GARCOM` em `utils/utils.js`: só chamando, talheres, pedir a
  conta, dúvida, outro) numa barrinha própria (`header.jsx#GarcomBar`, mesmo molde
  da `AccessibilityBar`) que abre ao clicar no 🔔 do `TopBar` ou no botão
  dentro de `cart.jsx#PedidoInfo` (quando "Na mesa"). O admin recebe isso em
  tempo real via Socket.IO (evento `garcom:nova`, room `admin` — Visão
  Geral mostra um alerta com contagem, aba Mesas lista, mostra o motivo e
  permite "Atender" — ver "Mesas" e "Garçons" mais abaixo). Depois que o
  admin atende (`PATCH /api/garcom/chamadas/:id/atender`, emite
  `garcom:atendida` pra quem fez o chamado), o `App.jsx#AvaliarGarcomPrompt`
  (flutuante, canto inferior) pergunta pro cliente "como foi o
  atendimento?" ao vivo — só pra chamados feitos por ELE (rastreados em
  `tnm_minhas_chamadas`, que agora também serve pra entrar nas rooms de
  socket certas e pra um catch-up via `GET /api/garcom/chamadas/minhas` se
  a resposta chegou com a aba fechada); a nota (1–5) grava `notaCliente` no
  próprio chamado, lido de volta pela aba Garçons do admin (média por
  funcionário).
- **Conta/sessão**: login, cadastro (com confirmação do e-mail por código
  quando o envio está ligado), recuperação de senha por código enviado ao e-mail
  (2 etapas) e modo visitante — ver "Segurança" pro fluxo de e-mail. Contas agora
  vivem numa tabela `User` no Postgres (`server/`), com senha em hash
  **bcrypt cost 12** (via `bcryptjs`, sem precisar compilar binário nativo)
  — não é mais texto puro como era antes (isso continua valendo só pro
  cliente; a equipe do admin também tem hash bcrypt, em tabela própria, ver
  "Segurança"). Cadastro e redefinição de senha exigem senha
  forte (`motivoSenhaFraca` em `server/src/lib/senha.js` — mín. 8
  caracteres, 1 letra, 1 número; servidor é sempre a fonte da verdade, o
  front só espelha a regra em `src/utils/utils.js` pra dar feedback antes
  de enviar, com medidor de força visual — `account.jsx#MedidorForcaSenha`
  — nos dois formulários). Sessão via cookie assinado/cifrado (`@fastify/secure-session`,
  sem tabela de sessão no banco), guardando `userId` (conta logada) e
  `guestId` (identidade de visitante, gerada automaticamente na 1ª
  request) — é o `guestId` que permite um visitante ver seu próprio
  histórico de pedidos sem precisar de conta. A entrada padrão do app
  (acesso via QR Code) nunca é bloqueada por login — sem sessão salva,
  `GET /api/auth/me` já devolve "visitante" e o usuário cai direto lá.
  E-mail de conta é sempre normalizado (`normalizarEmail` — trim +
  minúsculo) em `server/src/routes/auth.js`, nas 4 rotas que comparam/gravam
  e-mail (cadastro/login/recuperar/redefinir): `email String @unique` no
  Postgres é case-sensitive por padrão (sem `citext`), e o campo de
  login/cadastro é `type="text"` (não `type="email"`, de propósito, pra
  aceitar telefone também), então o teclado do celular pode maiusculizar a
  1ª letra sozinho — sem normalizar, "Alex@teste.com" e "alex@teste.com"
  seriam contas diferentes e o login voltava "E-mail ou senha inválidos"
  mesmo com a senha certa. Os 3 campos de e-mail em `account.jsx#AccountSheet`
  também têm `autoCapitalize="off"` como reforço, pra evitar que o teclado
  capitalize antes de chegar no servidor (que continua a fonte da verdade).
  Os inputs de e-mail/senha/nome dos formulários de login, cadastro e
  "esqueci minha senha" (`account.jsx#AccountSheet`) são **não-controlados**
  (`defaultValue`, não `value`) de propósito: o `value` do `AppContext`
  (único Context global) é um objeto recriado a cada render do Provider —
  inclusive pelo `statusTick` de 3 em 3s que atualiza o status do pedido,
  que roda sempre, sheet de conta aberto ou não — e um input controlado
  nesses formulários fazia o React reescrever o DOM de volta pro estado
  (vazio) toda vez que isso disparava, apagando o que o autofill/gerenciador
  de senha do navegador tinha acabado de preencher; cadastro/login então
  chegava com senha "" mesmo com o campo visivelmente preenchido na tela.
  Por serem não-controlados, cada `onSubmit` lê o valor real do DOM pelo id
  do input (`valorReal`, com o estado como fallback) em vez de confiar só
  no estado — `onChange` continua atualizando o estado só pra alimentar o
  medidor de força de senha (`MedidorForcaSenha`).
- **Indique um amigo** (`utils/utils.js`): código curto e
  determinístico por e-mail (`getCodigoIndicacao`, hash simples, não
  precisa de cadastro prévio — só "nasce" registrado em
  `tnm_codigos_indicacao` na 1ª vez que a pessoa abre "Sua conta"). Usar o
  código de outra pessoa (`usarCodigoIndicacao`) credita +100 pontos bônus
  pra quem indicou e +50 pra quem usou, 1 uso por e-mail na vida — ver
  `AccountSheet.jsx#PerfilLogado`.
- **Missão semanal** (`utils/utils.js#MISSAO_SEMANAL`): missão fixa
  ("peça 2x essa semana, ganhe 30 pontos"), progresso calculado direto de
  `pedidos` do próprio cliente na semana corrente (sem estado próprio) e
  exibido no `account.jsx#FidelidadeSheet` com barra de progresso; resgate manual
  (`resgatarMissao`) credita o bônus e marca `tnm_missoes_resgatadas` pra
  não creditar 2x na mesma semana.
- **Oferta personalizada** (`menu.jsx#OfertaPersonalizada`, logo abaixo do
  `FidelidadeBanner`): se o cliente logado está ≥3 dias sem pedir,
  `getOfertaPersonalizada` sugere um cupom automático (hoje fixo,
  `VOLTEI15` — 15%) num banner dispensável; "Aplicar" seta `cupomAplicado`
  direto, sem precisar digitar o código.
- **Clube de assinatura "Casa do Pato+"** (`utils/utils.js`,
  `assinaturaAtiva`/`assinarClube`/`cancelarAssinaturaClube` no
  `AppContext`, UI no fim do `account.jsx#FidelidadeSheet`): mensalidade simulada
  (não cobra nada de verdade) que aplica **10% de desconto automático**
  em todo pedido — só entra em `calcularDesconto` quando não há nenhum
  cupom digitado manualmente (cupom sempre tem prioridade sobre a
  assinatura, nunca somam).
- **Carteira** (`account.jsx#CarteiraSheet`, `utils/utils.js`): janela própria
  aberta pelo item "Carteira" em "Sua conta" (não é mais um ícone no
  `TopBar` — ver "Navegação/roteamento" abaixo), reunindo saldo/recarga,
  cartões salvos e vale-presente. **Protegida por PIN** de 4-6 dígitos
  (`temPinCarteira`/`definirPinCarteira`/`conferirPinCarteira`): quem ainda
  não tem PIN vê a tela de criação; quem já tem, precisa digitar o PIN
  toda vez que abre a carteira — `carteiraDesbloqueada` é transiente
  (nunca persistido) e reseta pra `false` sempre que a carteira fecha, de
  propósito (não fica destravada entre uma visita e outra, nem entre abrir
  e fechar na mesma sessão). O PIN nunca fica em texto puro: `utils/utils.js`
  faz hash com **PBKDF2-SHA256 via Web Crypto API** (210 mil iterações,
  salt aleatório por registro — nativo do navegador, sem dependência) —
  mesmo espírito do bcrypt que protege a senha de login no servidor, só que
  rodando no cliente porque essa parte do app não tem back-end.
  - **Saldo/recarga**: "Adicionar saldo" chama `recarregarSaldoCarteira` →
    `adicionarSaldoCarteira` em `utils/utils.js`, que credita direto
    no mesmo campo `cashback` da conta (é o mesmo saldo gastável no
    carrinho) e grava um lançamento tipo `"recarga"` no extrato, pra
    diferenciar de cashback ganho por compra. Um link "Ver extrato
    completo →" fecha a carteira e abre o `ExtratoSheet`.
  - **Cartões salvos** (`getCartoesSalvos`/`salvarCartao`/`removerCartao`):
    só simulação/exibição, sem gateway de pagamento real — guarda bandeira
    (detectada pelo 1º dígito), só os 4 últimos dígitos, nome, validade e
    apelido opcional, nunca o número completo. Usados como opção de
    pagamento no carrinho (ver "Checkout simulado" acima).
  - **Vale-presente** (`comprarValePresente`/`resgatarValePresente`): quem
    "compra" escolhe um valor e ganha um código único (`GFT-XXXXXX`, ver
    `gerarCodigoValePresente`) pra compartilhar manualmente — sem
    e-mail/SMS real. O valor **não sai do saldo de quem presenteia** (mesmo
    espírito sem gateway real da recarga acima — só fica registrado no
    extrato dele como `"vale-presente-comprado"`, pra transparência, sem
    mexer no saldo). Quem resgata digita o código na própria carteira e
    recebe o valor direto no saldo (`creditarValePresente`, tipo
    `"vale-presente-resgatado"` no extrato) — código é de uso único, e
    ninguém pode resgatar o próprio vale-presente.
- **Notificação push do navegador**: além do toast (que só aparece com a
  aba em primeiro plano), o mesmo `setInterval` de 3s que detecta mudança
  de status dispara `new Notification(...)` quando `Notification.permission
  === "granted"` — funciona com a aba em segundo plano/minimizada. Permissão
  é pedida por um clique explícito em "🔔 Notificações do navegador" na
  `AccessibilityBar` (`pedirPermissaoNotificacao`); navegador nenhum deixa
  pedir isso sozinho.
- **Mapa de entrega** (`orders.jsx#MapaEntrega`, `utils/utils.js`): só
  aparece no histórico pra pedidos `tipo:"entrega"` ainda não entregues —
  desde que virou um **mapa real** (Leaflet + tiles do OpenStreetMap,
  gratuitos e sem chave de API, ver Stack), a rota em si continua
  ilustrativa: `COORDS_LOJA` é fixa (ajustar pro endereço real do
  estabelecimento antes de qualquer uso real) e o ponto de entrega é
  derivado de forma determinística a partir do id do pedido
  (`coordsEntregaPedido` — mesmo pedido sempre cai no mesmo lugar), porque
  o app nunca geocodifica o endereço de texto livre que o cliente digita
  de verdade (exigiria um serviço tipo Nominatim, com limite de uso). O
  ícone 🛵 se move ao longo da rota tracejada com `interpolarPosicao`,
  posição calculada pelo tempo decorrido (ou pelo estágio atual, se o
  pedido já tem `statusManual`) — mesma lógica de antes, só que desenhada
  sobre ruas de verdade em vez de uma barra decorativa. Leaflet é
  inicializado 1x por pedido (`useEffect` com dep `[pedido.id, visivel]`,
  nunca por causa do `pct` mudando) e só reposiciona o marcador da moto nos
  ticks seguintes — recriar o mapa a cada 3s seria caro e piscaria.
- **Tempo estimado pela fila real** (`estimarTempoFila` em
  `utils/utils.js`, exposta como `estimarTempoFilaPedido` no
  `AppContext`): no histórico, em vez de um tempo fixo por etapa, soma
  ~3 min por pedido "na frente" (criado antes, ainda não entregue) ao
  tempo base. A lista usada pra isso é `filaAtiva`, alimentada por
  `GET /api/pedidos/fila` (atualizada junto do `statusTick` a cada 3s) — um
  endpoint público e enxuto (id/status/tipo, sem itens/endereço de outros
  clientes) que reflete a fila de TODOS os clientes de verdade, não só os
  meus. Antes da migração pro back-end isso reutilizava `pedidos` (que por
  só refletir "este navegador" funcionava por coincidência como proxy da
  fila real); agora que `pedidos` é genuinamente "meus pedidos" (escopado
  pela sessão), reaproveitar `pedidos` pioraria a estimativa — daí o
  endpoint separado.
- **Avaliação com foto**: o formulário de avaliação (`product.jsx#Reviews`) aceita
  uma foto opcional (`<input type="file">` → base64 via `FileReader`,
  mesmo padrão usado pelo admin pra fotos de prato/recompensa), salva no
  campo `foto` da review e mostrada abaixo do comentário.
- **Acessibilidade**: alto contraste, aumentar/diminuir fonte (CSS var
  `--font-scale`), reduzir movimento, leitura em voz alta via
  `SpeechSynthesisUtterance` ao focar cards/adicionais/avaliações
  (Tab/foco, não mouse). `falarTexto` (função única no `AppContext`,
  reaproveitada pela leitura por foco e pelo resumo em voz) também guarda o
  último texto falado em `legendaAtual`, mostrado pelo `App.jsx#LegendaFlutuante`
  quando o modo **"💬 Legendas da leitura"** está ativo — útil pra
  acompanhar o texto sem áudio. Ao abrir o checkout, `falarResumoPedido`
  lê em voz alta os itens e o total antes de confirmar o pagamento (só com
  o leitor ativo).
- **Toast**: notificação simples, autodesaparece em 2.6s.

## Navegação / roteamento de tela

Não há URL routing nem troca de view: o contêiner principal sempre mostra
`menu.jsx#MenuSections`; Favoritos/Pedidos abrem como sheets próprios. A barra de abas superior
(`TabsNav`) só navega entre categorias do cardápio (Início, Combos,
Hambúrgueres, Lançamentos, Acompanhamentos, Sobremesas, Bebidas) —
rolando até a seção correspondente. **Favoritos e Pedidos não têm aba
própria na navegação.**

Em vez disso, dentro do painel "Sua conta" (`account.jsx#AccountSheet`, aberto
pelo ícone 👤 no `TopBar`/`BottomNav`), sob "seus itens" existem cinco
**itens de menu clicáveis** — "♥ Favoritos", "🧾 Pedidos", "🏅 Extrato",
"👛 Carteira" e "📅 Reservar mesa" (ícone + rótulo + contador opcional +
seta ``›``, estilo lista de configurações) — que cada um abre a sua
**própria janela** (`menu.jsx#FavoritesSheet` / `orders.jsx#OrdersSheet` /
`account.jsx#ExtratoSheet` / `account.jsx#CarteiraSheet` / `account.jsx#ReservaMesaSheet`), um
sheet independente empilhado por cima, com cabeçalho próprio e botão de
voltar. **Carteira não tem mais ícone próprio no `TopBar`** — foi movida
pra cá, dentro do perfil. Clicar num item de menu fecha o painel de conta
e abre o sheet correspondente (`abrirFavoritos`/`abrirPedidos`/
`abrirExtrato`/`abrirCarteira`/`abrirReservas` no `AppContext`). O botão
"Voltar" (←) ou clique fora de cada uma dessas 5 janelas
(`fecharFavoritos`/`fecharPedidos`/`fecharExtrato`/`fecharCarteira`/
`fecharReservas`) **reabre "Sua conta"** em vez de fechar tudo — elas
foram empilhadas por cima dela, não abertas no lugar dela, então fechar
uma volta pra onde a pessoa estava. Só a tecla Escape foge dessa regra e
fecha todos os sheets de uma vez (ver "Modais/janelas" abaixo). Já abrir a
ficha de um produto ou repetir um pedido a partir de dentro dessas janelas
fecha-as sem reabrir "Sua conta" (evita telas empilhadas — vai direto pro
produto/carrinho).
"Sua conta" **não** tem mais item de menu pro Clube de Fidelidade — quem
quer usar os pontos entra pelo `FidelidadeBanner` (ver abaixo), não pelo
painel de conta.

O `menu.jsx#FidelidadeBanner` é uma faixa fixada no topo do cardápio (entre as
abas de categoria e as seções de itens — não é um modal, faz parte do fluxo
normal da página) mostrando nível/saldo de pontos/cashback disponível (pra
quem está logado) e um botão **"Usar meus pontos"**, que abre o
`FidelidadeSheet` (`abrirFidelidade`). É a **única** entrada pro Clube de
Fidelidade — quem não está logado vê ali um convite compacto pra entrar na
conta em vez do resumo de pontos.

## Modais / janelas (`App.jsx#ModalSheet`)

Todos os "sheets" do app (`ProductSheet`, `CartDrawer`, `PixSheet`,
`AccountSheet`, `FavoritesSheet`, `OrdersSheet`, `FidelidadeSheet`,
`ExtratoSheet`, `CarteiraSheet`, `ReservaMesaSheet`) são construídos sobre
o mesmo `ModalSheet`: permanecem sempre no DOM (usam
`inert` quando fechados, em vez de desmontar), prendem o foco dentro do
modal com Tab enquanto abertos, e devolvem o foco pra quem abriu ao fechar. Isso é uma
escolha deliberada de acessibilidade compartilhada entre todos eles.
Cada sheet tem seu próprio par de estados `xxxOpen`/`abrirXxx`/`fecharXxx`
no `AppContext`; a tecla Escape fecha todos de uma vez.

## Cards de pedido clicáveis (`orders.jsx#OrderCard`)

Cada card do histórico de pedidos (dentro de `OrdersSection`) começa
**recolhido**, mostrando apenas número do pedido, tipo/hora, status e
total. A cabeça do card é um `<button>` (`aria-expanded`/`aria-controls`)
que expande/recolhe os detalhes completos (stepper de status, mensagem,
itens, observações, total detalhado e ações "Repetir pedido"/"Avaliar
pedido").

## Componentes principais por arquivo

- **`App.jsx`**: além do layout raiz (`App`), carrega os 4 componentes
  "soltos" que não pertencem a nenhuma área — `ModalSheet` (sheet/drawer
  genérico e acessível, reusado por todos os sheets), `Toast`,
  `LegendaFlutuante` (legenda do que está sendo lido em voz alta) e
  `AvaliarGarcomPrompt` (prompt "como foi o atendimento?" pós-chamado de
  garçom).
- **`components/header.jsx`**: `TopBar` (marca, saudação, atalhos conta/
  a11y/chamar garçom/busca/carrinho — **sem** ícone de carteira, ver
  "Navegação/roteamento"), `AccessibilityBar` (painel de opções de
  acessibilidade), `GarcomBar` (barra de motivo ao chamar o garçom),
  `SearchBar` (busca por texto + chips de categoria + busca por IA, ver
  "Busca por IA no cardápio"), `TabsNav` (abas de categoria do cardápio),
  `BottomNav` (nav fixa mobile: início/busca/carrinho/perfil).
- **`components/menu.jsx`**: `FidelidadeBanner`
  (faixa de nível/pontos/cashback + botão "Usar meus pontos", topo do
  cardápio), `MenuSections` (todas as categorias com itens, filtradas por
  busca), `FavoritesSection` (favoritos + combos salvos — conteúdo
  reaproveitado dentro do `FavoritesSheet`), `FavoritesSheet` (janela
  própria de Favoritos, aberta a partir do item de menu em "Sua conta"),
  `ItemCard` (card de item, com favoritar, tag de promoção/novidade, nota
  média), `ComboCard` (card de combo personalizado salvo), `Estrelas`
  (render de 1–5 estrelas), `OfertaPersonalizada` (faixa de reengajamento).
- **`components/product.jsx`**: `ProductSheet` (ficha completa do item),
  `AddonGroup` (grupo de adicionais com contador min/max), `Ingredientes`
  (toggle de ingredientes padrão), `SalvarCombo` (salvar personalização
  atual como favorito), `Reviews` (lista de avaliações + formulário).
- **`components/cart.jsx`**: `CartDrawer` (carrinho completo), `CartItem`
  (linha do carrinho), `PedidoInfo` (observações, tipo de pedido, mesa/
  endereço + botão "Chamar garçom" quando é "Na mesa", agendamento —
  exceto mesa —, "pagar agora ou depois" — só mesa), `FormaPagamento`
  (Pix/Cartão/Dinheiro + sub-escolhas: cartão salvo/maquininha do motoboy,
  usar saldo da carteira/troco — ver "Checkout simulado"), `CartExtra`
  (cupom, toggle de usar cashback — só aparece com saldo > 0 e conta
  logada —, divisão da conta com os dois modos, ETA), `Upsell` (sugestões
  de acompanhamento/bebida no carrinho), `GrupoPedido` (criar/entrar num
  pedido em grupo).
- **`components/checkout.jsx`**: `PixSheet` (checkout genérico Pix/Cartão/
  Dinheiro, com Pix Copia e Cola e resumo de troco).
- **`components/orders.jsx`**: `OrdersSection` (lista de pedidos do
  usuário — conteúdo reaproveitado dentro do `OrdersSheet`), `OrdersSheet`
  (janela própria de Pedidos, aberta a partir do item de menu em "Sua
  conta"), `OrderCard` (card clicável de um pedido — ver acima),
  `StatusStepper` (stepper visual dos 4 estágios do pedido), `MapaEntrega`
  (mapa real Leaflet + OpenStreetMap, rota ilustrativa — ver "Mapa de
  entrega").
- **`components/account.jsx`**: `AccountSheet` (login/cadastro/recuperar
  senha/perfil, com medidor de força de senha nos formulários, mais os
  itens de menu clicáveis "Favoritos", "Pedidos", "Extrato", "Carteira" e
  "Reservar mesa" que abrem seus próprios sheets), `FidelidadeSheet`
  (janela do clube de fidelidade — nível, pontos, cashback, catálogo de
  recompensas com filtro por custo em pontos; só abre pelo botão "Usar
  meus pontos" do `FidelidadeBanner`), `ExtratoSheet` (histórico de
  lançamentos de pontos/cashback, aberta a partir do item de menu
  "Extrato" em "Sua conta"), `CarteiraSheet` (PIN, saldo/recarga, cartões
  salvos, vale-presente — aberta a partir do item de menu "Carteira"),
  `ReservaMesaSheet` (formulário + lista de reservas de mesa — aberta a
  partir do item de menu "Reservar mesa").

## Dados mockados — `data/data.js`

- `NAV_TABS`: abas da navegação superior (hoje só categorias do cardápio).
- `CATEGORIES`: categorias usadas em `MenuSections`/busca. Igual ao `MENU`
  abaixo, é `aplicarCategoriasAdmin(CATEGORIES_BASE)` — rótulo das
  categorias base pode ser renomeado pelo admin (aba Categorias, ids fixos
  porque `NAV_TABS`/itens do cardápio referenciam por id) e categorias
  extras criadas lá são anexadas (`tnm_admin_categorias`).
- `MENU`: catálogo completo de itens (id, categoria, nome, descrição,
  preço, preço promocional opcional, tag, ícone/imagem, grupos de
  adicionais aplicáveis, ingredientes removíveis). Imagens (`imgUrl`) são
  placeholders do Unsplash — substituir por fotos reais do estabelecimento
  antes de qualquer uso real. **`MENU` não é o array cru**: é
  `aplicarCatalogoAdmin(MENU_BASE)`, calculado 1x no carregamento do
  módulo — remove itens que o painel admin marcou indisponível/sem estoque
  (`tnm_admin_menu_overrides`), aplica edição de nome/preço/descrição feita
  no admin (campos `name`/`price`/`desc` do override viram `nome`/`preco`/
  `desc` do item), e anexa itens criados no admin (`tnm_admin_menu_extra`).
  Pra ver uma edição feita no admin, recarregue a página do cliente (não é
  reativo entre abas).
- `UPSELL_IDS`: itens sugeridos no carrinho.
- `COUPONS`: cupons válidos (mesmos códigos espelhados no PDV do admin).
- `ADDON_GROUPS`: grupos de adicionais reutilizáveis entre itens (ex.
  "Turbine seu Hambúrguer", "Escolha o molho", "Escolha sua bebida"). Assim
  como `MENU`, é `aplicarAddonsAdmin(ADDON_GROUPS_BASE)` — grupos base têm
  nome/min/max/itens sobrescrevíveis pelo admin (aba Adicionais Globais,
  `tnm_admin_addon_groups`, id fixo porque `item.addons` referencia por
  id), grupos extras criados lá são anexados. **Limitação**: a ficha de
  prato do admin (aba Pratos) não tem campo pra atribuir grupos de
  adicionais a um item — um grupo extra só passa a valer pra algum prato
  se alguém editar `item.addons` manualmente em `data/data.js`.
- `REVIEWS_MOCK`: avaliações fictícias pré-existentes por item.
- `baixarEstoque(itensPedido)`: exportada por este módulo (não é "dado", é
  a única função aqui) — debita o estoque controlado pelo admin quando um
  pedido é finalizado; ver `AppContext#finalizarPedido`.

## Back-end (`server/`) — MVP: pedidos + tempo real

Projeto Node separado (próprio `package.json`), irmão de `src/`. É dono de
4 fatias com estado de verdade — **auth (contas + sessão), pedidos,
chamado de garçom e pedido em grupo** — decidido deliberadamente assim pra
não virar um projeto do zero de "reescrever tudo": cardápio/estoque,
fidelidade/cashback, carteira, PDV/caixa e config da loja continuam 100%
`localStorage`, exatamente como descrito no resto deste documento (a equipe do
painel — funcionários e funções — já mora no Postgres, ver "Segurança"). Tem ainda uma **5ª fatia bem mais leve, sem estado nenhum**: a
busca por IA do cardápio (`POST /api/ia/busca`), que só existe no back-end
pra não expor a chave da API do Gemini no cliente — não lê nem escreve no
Postgres, só repassa a pergunta + o catálogo (que o cliente manda a cada
chamada) pro Gemini e devolve o resultado.

**Stack**: Fastify (servidor HTTP), Prisma + PostgreSQL (ORM/banco — testado
com um projeto gratuito no [neon.tech](https://neon.tech)), Socket.IO
(tempo real, anexado ao mesmo `http.Server` do Fastify), `bcryptjs` (hash de
senha, puro JS — evita compilar binário nativo no Windows),
`@fastify/secure-session` (sessão via cookie assinado/cifrado, sem tabela de
sessão no banco), `@google/genai` (SDK do Gemini, só usado pela busca por
IA — ver "Busca por IA no cardápio").

**Estrutura** (`server/src/`): `app.js` monta a instância Fastify (plugins +
rotas, sem `.listen()`); `server.js` é o entrypoint que sobe a porta;
`plugins/` — `prisma.js` (singleton do `PrismaClient`), `session.js`
(`@fastify/secure-session` + garante `guestId` em toda request),
`sockets.js` (anexa o Socket.IO, rooms `admin`/`grupo:<codigo>`/
`chamada:<id>`), `staticFrontend.js` (só em produção — serve o `dist/` da
raiz, que já inclui `public/admin.html`, num único processo); `routes/` —
`auth.js`, `pedidos.js`, `garcom.js`, `grupo.js`, `ia.js` (busca por IA,
sem tabela própria), `equipe.js` (funcionários e funções do painel), mais as
rotas do ERP; `plugins/admin.js` (login do painel e `exigirAdmin`);
`scripts/criar-admin.js` (`npm run admin:criar`); `lib/` — `email.js` (envio via
Resend + validação de domínio), `codigos.js` (códigos de 6 dígitos), `funcoes.js`
(funções padrão), `senha.js` (hash bcrypt cost 12 +
`motivoSenhaFraca`, validação de senha forte), `ids.js` (formata `seq` do
Prisma como `"PD-"`/`"CG-"` + `seq`), `serializers.js` (linha do Prisma →
shape JSON que o front já espera, mesmo nome de campo que tinha em
`localStorage`).

**Schema Prisma** (`server/prisma/schema.prisma`): `User` (contas),
`Order` (pedido — campos escalares tipados pra tudo que é simples,
`itens`/`divisao`/`agendamento`/`grupoSnapshot` em JSONB porque a forma é
100% definida pelo front e nada aqui precisa consultar isso
relacionalmente), `WaiterCall` (chamado de garçom — `atendidoPor` também é
JSON, um snapshot do funcionário que atendeu — a equipe agora existe nas
tabelas `Funcionario`/`Funcao`, mas o snapshot evita depender dela no
histórico), `Funcionario` + `Funcao` (equipe do painel), `GroupOrder` + `GroupParticipant` +
`GroupItem` (pedido em grupo — aqui SIM normalizado em tabelas de verdade,
não JSONB, porque o antigo `utils/grupo.js` mutava o carrinho por índice de
array, o que era uma corrida latente entre 2 participantes mexendo ao mesmo
tempo; IDs de linha reais eliminam esse risco e permitem o Socket.IO mandar
só o diff de 1 item por evento).

**Sem CORS em lugar nenhum**: em dev, o Vite (`vite.config.js`) faz proxy de
`/api` e `/socket.io` pro back-end (porta 4000) — tanto o app React quanto
`public/admin.html` (servido como estático pelo próprio Vite) chamam essas
rotas com URL relativa e caem no proxy. Em produção, o próprio Fastify serve
o `dist/` inteiro (`staticFrontend.js`) — um processo só.

**Rotas** — auth: `/api/auth/{cadastro,verificar-email,reenviar-codigo,login,
logout,me,recuperar,redefinir,usuarios}`; painel: `/api/admin/{login,logout,
funcionarios,funcoes}`. Pedidos: `POST /api/pedidos` (checkout do cliente, identidade
sempre da sessão, nunca do corpo), `POST /api/pedidos/pdv` (venda do PDV
admin), `GET /api/pedidos/meus` (histórico da sessão atual — conta ou
`guestId`), `GET /api/pedidos/fila` (fila pública mínima, pra
`estimarTempoFila`), `GET /api/pedidos/todos` (usada pelo admin),
`PATCH /api/pedidos/:id/status` (KDS), `PATCH /api/pedidos/:id/cancelar`.
Garçom: `POST /api/garcom/chamadas`, `GET /api/garcom/chamadas{,/pendentes,
/minhas}`, `PATCH /api/garcom/chamadas/:id/{atender,avaliar}`. Grupo:
`POST /api/grupo` (criar), `POST /api/grupo/:codigo/{entrar,sair,limpar}`,
`GET /api/grupo/:codigo`, `POST /api/grupo/:codigo/itens`,
`DELETE/PATCH /api/grupo/:codigo/itens/:itemId`. IA: `POST /api/ia/busca`
(pergunta + catálogo → `{resposta, itemIds}`; 503 sem `GEMINI_API_KEY`
configurada, 502 se a chamada ao Gemini falhar). **As rotas usadas pelo
admin (PDV, KDS, garçom, `/todos`) exigem a sessão de admin** — ver
"Segurança" abaixo.

**Socket.IO** — rooms: `admin` (todo `admin.html`, entra via evento
`admin:entrar` — precisa ser emitido tanto dentro do handler de `"connect"`
quanto imediatamente se `socket.connected` já for `true` na hora de
registrar os listeners, porque o socket conecta assim que o módulo carrega,
bem antes do login acontecer — só escutar `"connect"` tarde demais faz
perder esse evento pra sempre nessa conexão). `grupo:<codigo>` (participantes
daquele pedido em grupo). `chamada:<id>` (quem fez aquele chamado
específico). Eventos: `pedido:novo`/`pedido:atualizado` (pro admin e pro
dono do pedido), `garcom:nova`/`garcom:atendida`/`garcom:avaliada`,
`grupo:participante-entrou`/`-saiu`, `grupo:item-adicionado`/`-removido`/
`-alterado`, `grupo:limpo`.

**No cliente React**: `apiFetch` (`credentials: "include"`) e o singleton
`socket` do `io()` (sobrevive a re-renders do `AppProvider`) — ambos em
`src/utils/utils.js` — são os únicos pontos novos de acesso ao back-end —
usados só dentro de `AppContext.jsx`, nas partes que migraram (`pedidos`,
`sessao`, `grupoObj`, chamado de garçom pendente de avaliação).
`login`/`cadastro`/`verificarEmailCadastrado`/`redefinirSenha` viraram
assíncronas (`Promise<boolean>`, mesmo contrato de antes) — os `onSubmit`
que os chamam em `account.jsx#AccountSheet` usam `await`.

**Dev**: `npm run dev:all` na raiz sobe os dois (`concurrently`);
`server/package.json` tem `dev`/`start` (`node --watch`/`node`, sem
`nodemon` — Node 20.6+ já tem `--env-file`), `prisma:migrate`,
`prisma:generate`, `prisma:studio` (GUI do banco, boa pra demonstrar na
banca), `db:seed`.

**Verificação manual** (sem suite de testes automatizada, ver "Convenções
do código"): cadastro/login persistindo após reload; pedido de visitante
aparecendo no histórico após reload (via `guestId` no cookie); pedido feito
no app cliente aparecendo AO VIVO na Cozinha do admin sem refresh; admin
avançando o KDS refletindo ao vivo no histórico do cliente; venda do PDV
aparecendo nos boards de Cozinha/Delivery; chamar garçom → atender → prompt
de avaliação aparecendo ao vivo; e o teste principal — **pedido em grupo
entre duas sessões/dispositivos de verdade** (não só abas do mesmo
navegador): criar grupo numa sessão, entrar com o código em outra, e
confirmar que item adicionado por uma aparece ao vivo pra outra com o
`participanteNome` certo.

## Segurança (`server/`)

- **Admin**: contas de funcionário no Postgres (`Funcionario`/`Funcao`,
  senha bcrypt, `lib/funcoes.js`). `plugins/admin.js` — `POST /api/admin/login
  {usuario, senha}` (5/min) grava `adminAte` (12h) + `funcionarioId` na sessão
  cifrada e devolve `{id,nome,usuario,funcao,secoesPermitidas}`; sem conta
  existente o login gasta bcrypt do mesmo jeito (não revela se o usuário
  existe). `exigirAdmin` (qualquer funcionário logado **que ainda exista** —
  apagar a conta derruba o acesso na hora) e `exigirAdministrador` (função
  `admin`, usada em `routes/equipe.js`: CRUD de funcionários e funções; ler
  funções vale pra qualquer funcionário logado). Regras: não remove nem rebaixa
  o último administrador, não apaga função em uso nem a `admin`, usuário único,
  senha forte. `fastify.exigirAdmin` protege estoque/compras/financeiro (hook do plugin
  inteiro), `/api/auth/usuarios`, `/api/pedidos/{pdv,todos,:id/status,:id/cancelar}`
  e `/api/garcom/chamadas{,/pendentes,/:id/atender}`. A room de socket `admin`
  só aceita `admin:entrar` com sessão de funcionário válida (cookie lido no
  handshake, `sockets.js`); `admin:sair` sai dela. No `admin.html` o login é
  só usuário e senha. **Importante**: o servidor lê o cookie só
  no handshake, e o socket do painel conecta ao carregar a página (antes do
  login) — por isso `init.js` faz `socket.disconnect(); socket.connect()` logo
  depois de logar; sem isso a conexão nunca é reconhecida como de funcionário e
  pedidos novos só aparecem ao recarregar.
- **Rate limit** (`@fastify/rate-limit`): 300/min global; 10/min em login/
  cadastro/recuperar/redefinir e na busca por IA; 5/min no login admin;
  20/min em `POST /api/pedidos`; 30/min nas rotas de entrar/ler grupo.
- **Erros**: `setErrorHandler` em `app.js` — 5xx nunca devolve mensagem
  interna; 4xx devolve `{erro}`.
- **E-mail e códigos** (`lib/email.js`, `lib/codigos.js`): envio pela API HTTPS do
  Resend (`RESEND_API_KEY`/`EMAIL_FROM`; SMTP não serve — o Render grátis bloqueia
  as portas). `emailAtivo()` = chave presente. **Ligado**: `/cadastro` valida
  formato (`emailComFormatoValido`) e domínio (`dominioRecebeEmail`, MX via DNS;
  `EMAIL_VERIFICAR_DNS=0` desliga nos testes), manda o código e responde
  `{precisaVerificar:true}` SEM logar; `/verificar-email` confere o código, grava
  `User.emailVerificadoEm` e loga; `/reenviar-codigo` reenvia; `/login` de conta
  não confirmada dá 403 `{precisaVerificar:true}`. Recadastrar um e-mail ainda não
  confirmado sobrescreve nome/senha (ninguém "reserva" o e-mail dos outros).
  **Desligado** (dev): cadastro entra direto e o código de recuperação sai no log.
  Códigos de 6 dígitos em memória do processo: 15 min, 5 tentativas, uso único, 1
  envio/min por chave (`ver:<email>`, `rec:<email>`). `/recuperar` sempre responde
  200 (não enumera e-mails; `via` = "email"|"log" só escolhe o texto da tela);
  `/redefinir` valida a senha nova ANTES de gastar o código e também confirma a
  conta. Login gasta bcrypt mesmo com e-mail inexistente. A migration
  `email_verificado` marcou as contas existentes como confirmadas.
- **XSS no admin**: `esc()` escapa `& < > " '`; `statusPill` escapa o
  rótulo; `statusManual` (whitelist recebido/preparo/pronto/entregue) e
  `unidade` de insumo (kg/g/l/ml/un) são validados no servidor.
- **Cookie de sessão**: `secure` em produção, `maxAge` de 30 dias.
- **Testes**: `cd server && npm test` (`test/seguranca.test.js`,
  `test/socket-admin.test.js`, `test/email.test.js` — 20 testes). Usam o banco do
  `.env`: criam registros temporários (`...@teste.local`, funcionários e contas de
  cliente) e apagam no fim; o Resend é simulado, nenhum e-mail sai. **Não rode
  apontando pro banco de produção.**

## ERP administrativo (`server/`)

Módulo administrativo (só usado pelo `public/admin.html` — sem nenhum
equivalente no app cliente React) cobrindo 4 frentes: estoque de insumos
com ficha técnica, compras/fornecedores, contas a pagar/receber e um
relatório gerencial consolidado. Ao contrário do resto do admin (cardápio,
PDV, caixa, funcionários, config da loja, todos `localStorage`), esse
módulo nasceu **direto no back-end** (Postgres), seguindo o mesmo padrão
arquitetural das 4 fatias do MVP (`seq` autoincrement + `lib/ids.js` pra
formatar id, `Decimal` pra dinheiro/quantidade, eventos de Socket.IO pro
room `admin`).

**Schema Prisma** (`server/prisma/schema.prisma`): `Insumo` (matéria-prima,
com `estoqueAtual`/`estoqueMinimo`/`custoUnitario` e `fornecedorPadraoId`
opcional), `RecipeItem` (ficha técnica — `itemId` é o id do prato no
catálogo do front, `data/data.js`/`MENU_BASE`, sem FK porque o catálogo não
vive no Postgres; `quantidade` = consumo por 1 unidade vendida), `MovimentoEstoque`
(ledger imutável de entrada/saída, alimentado por venda/compra/ajuste
manual), `Fornecedor`, `PurchaseOrder`/`PurchaseItem` ("Compra" — ao criar,
já gera a `ContaPagar` vinculada na mesma transação; "receber" credita o
estoque dos insumos, tudo-ou-nada, sem recebimento parcial), `ContaPagar`
(pode ou não estar vinculada a uma compra — se estiver, só pode ser editada/
excluída cancelando a compra, nunca direto) e `ContaReceber` (só recebíveis
avulsos, não ligados a `Order` — o pedido do cliente já tem seu próprio
ciclo de pagamento via Pix/cartão/dinheiro/pendente-*).

**Baixa de estoque por venda** (`server/src/lib/estoque.js#baixarEstoquePorVenda`):
chamada de dentro de **ambas** as rotas que criam `Order`
(`POST /api/pedidos` do cliente e `POST /api/pedidos/pdv` do admin, ver
`routes/pedidos.js`) — pra cada item do pedido com `RecipeItem` cadastrado,
decrementa `Insumo.estoqueAtual` (`{decrement}` atômico, mesmo padrão de
`grupo.js`) e grava um `MovimentoEstoque` de saída com motivo
`"venda:<idDoPedido>"`. Prato sem ficha técnica cadastrada é ignorado
silenciosamente — é um recurso opt-in, não every prato precisa ter. Diferente
do `dish.estoque` (finished-good, duplicado em `data.js` e `admin.html`
porque nasceu sem back-end), aqui a lógica mora **só** no servidor —
ponto único de verdade. **Limitação**: só considera o `itemId` do prato
principal, adicionais (`addons`) não têm ficha técnica própria.

**Rotas**: `server/src/routes/estoque.js` (insumos, ficha técnica via
`PUT /api/estoque/receitas/:itemId` — substitui a lista inteira a cada
salvamento —, movimentos, `GET /api/estoque/baixo-estoque`),
`server/src/routes/compras.js` (fornecedores + compras/recebimento/
cancelamento), `server/src/routes/financeiro.js` (contas a pagar/receber +
marcar pago/recebido). Eventos de socket pro room `admin`: `estoque:baixo`
(insumo cruzou o mínimo), `estoque:atualizado`, `compra:nova/-recebida/-cancelada`,
`conta-pagar:nova/-atualizada`, `conta-receber:nova/-atualizada` — mesmo
padrão de `pedido:novo`/`garcom:nova`.

**No admin.html**: 7 seções novas — "Insumos" e "Ficha Técnica" (grupo
Produtos), "Fornecedores" e "Compras" (novo grupo Compras), "Contas a
Pagar", "Contas a Receber" e "Relatórios" (novo grupo Financeiro — a aba
"Financeiro" que já existia, de folha de pagamento mockada, continua
intacta no grupo Sistema, sem relação com essas). "Relatórios" cruza
`pedidosCache` (receita do período) com `movimentosCache` × `custoUnitario`
do insumo (CMV estimado) e as duas contas — tudo calculado client-side a
partir dos caches já existentes, sem endpoint de agregação dedicado (mesmo
espírito do Dashboard). Um banner na Visão Geral avisa quando há insumo com
estoque abaixo do mínimo (`insumosBaixoEstoque()`), mesmo padrão do alerta
de chamados de garçom pendentes.

Como essas seções não mudam sozinhas com o tempo (ao contrário de
pedidos/mesas, que têm status calculado pelo relógio), elas ficam **fora**
do poll de 3s (`rerenderRelogio`, ver `initSocket`) — entrar numa dessas
abas de novo (`goTo`) força um re-render a partir do cache atual, e eventos
de socket também re-renderizam na hora se a aba já estiver aberta. Ações
sem confirmação nativa (`confirm()`/`prompt()`) — mesmo espírito do
"remove-dish" em Pratos — só o formulário "Nova compra"/"Nova conta" usa
`alert()` de validação síncrona, igual às outras abas do admin.

## Integração com o painel administrativo

Existe um painel administrativo (`Casa do Pato — Admin`) construído em
**HTML/CSS/JS vanilla, sem build e sem React** — não faz parte do bundle
deste app. Existia uma 2ª cópia fora do projeto
(`Adm/brasa-sal-admin.html`, pasta irmã `TCC/Adm/`) que era só demonstrativa —
foi removida; `public/admin.html` é hoje a única cópia, sem nada pra manter
em sincronia.

- `public/admin.html` **dentro deste projeto** — cópia servida pelo Vite na
  mesma origem do app (`http://localhost:5173/admin.html` em dev, ou junto
  do `dist/` em produção), porque **`localStorage` é isolado por origem**
  E porque as chamadas a `/api`/`/socket.io` usam URL relativa (ver "Sem
  CORS em lugar nenhum" na seção do back-end acima): o admin só reflete
  cardápio/fidelidade (localStorage) e pedidos/chamado de garçom (back-end)
  reais quando aberto a partir dessa mesma origem, com o Vite (dev) ou o
  Fastify (produção) rodando. Aberto como arquivo solto (`file://`), tanto o
  `localStorage` quanto as chamadas de API/socket ficam "vazios"/falham.

**`admin.html` é só o shell** (`<style>` inteiro + o `<body>`, que por sua
vez é só login/rail vazio/`<div id="content">` vazio — todo o HTML de cada
seção é gerado via `innerHTML` em JS, não existe markup estático por
seção). O JS em si mora em `public/admin/`, organizado por área — mesmo
princípio do CLIENTE (ver "Arquitetura geral" no topo deste documento),
só que na direção oposta: lá foram MUITOS arquivos virando poucos; aqui era
**1 arquivo de 4390 linhas** (uma única IIFE) virando vários, carregados
via `<script type="module" src="/admin/init.js">` — módulo ES nativo do
navegador, sem precisar de bundler pra isso (`<script src="/socket.io/
socket.io.js">` continua um script clássico antes dele, definindo `io`
global). Igual ao cliente, uma referência como `operacao.js#renderPdv`
significa "a função `renderPdv`, dentro de `public/admin/operacao.js`".

| Arquivo | Conteúdo |
|---|---|
| `core.js` | Toda a camada de dado/estado: `state`, `SECTIONS`, catálogo-base importado de `catalogo.gerado.js` (gerado de `src/data/catalogoBase.js`), `lsGet`/`lsSet`/`api`, helpers genéricos (`esc`/`brl`/`statusPill`/`exportarCSV`/...), TODAS as funções `getX`/`saveX` de todo domínio (categorias, adicionais, pratos/estoque, pedidos/chamados, funcionários/funções/permissões, insumos/fornecedores/compras/contas ERP, config da loja, caixas, fidelidade), `socket`, `initSocket`, `carregarCachesEmTempoReal`. |
| `nav.js` | Shell, menu lateral (rail) e orquestração: `buildShell`/`buildNav`/`goTo`/`buildFilters`, `renderAll`/`renderPeriodDependent`/`rerenderSecaoAtiva`/`rerenderRelogio` — importa a função `render*` de todos os 8 arquivos de área abaixo. |
| `init.js` | `init()` + wiring de login/logout/hambúrguer — o entry point (`<script type="module">`). |
| `desempenho.js` | Visão Geral, Produtos (ranking), Garçons. |
| `produtos.js` | Categorias, Pratos, Adicionais Globais, Insumos, Ficha Técnica. |
| `compras.js` | Fornecedores, Compras. |
| `operacao.js` | PDV, Cozinha, Mesas, Delivery — juntar essas 4 seções no mesmo arquivo elimina a circularidade Cozinha↔Delivery (viram chamada direta, sem import). |
| `vendas.js` | Pedidos, Histórico de Caixas, Avaliações. |
| `financeiro.js` | Contas a Pagar, Contas a Receber, Relatórios (ERP). |
| `gestao.js` | Funcionários, Clientes, Fidelidade. |
| `sistema.js` | Financeiro (folha de pagamento), Configurações. |

Vários desses arquivos importam uns aos outros de volta (ex.: `operacao.js`
chama `renderDashboard` de `desempenho.js`, que por sua vez chama `goTo` de
`nav.js`) — import circular de propósito, mesmo padrão já usado no CLIENTE
(`App.jsx` ↔ `menu.jsx`/etc.): seguro porque toda chamada acontece dentro
de corpo de função (handler de clique, callback de socket), nunca no topo
do módulo.

Login do admin é validado **no servidor** (`POST /api/admin/login`, ver
"Segurança"): a equipe mora nas tabelas `Funcionario`/`Funcao` do Postgres,
com senha em bcrypt — sem relação com as contas de cliente (`User`). Não existe
conta padrão: o 1º administrador é criado por `npm run admin:criar` (também
semeia as 4 funções padrão). Ao entrar, o painel apaga do `localStorage` as
chaves antigas `tnm_admin_funcionarios`/`tnm_admin_funcoes` (versões anteriores
guardavam a equipe lá, com senha em texto puro).

**Funções são editáveis, não mais uma lista fixa**: a tabela `Funcao`
(cache `state.funcoesCache`, lido por `getFuncoes()`; escrita por
`api("/api/admin/funcoes")`), com 4 padrão
(`admin`/`cozinha`/`pdv`/`garcom`, seed em `FUNCOES_PADRAO`) mais quantas o
`admin` criar na aba "Funcionários" (formulário "Nova função" — só o
nome; a função nova nasce com `secoesPadrao: []`, sem acesso nenhum até
alguém marcar). Apagar uma função é bloqueado (botão desabilitado, com
motivo no `title`) se algum funcionário ainda estiver com ela — "admin" em
si nunca pode ser apagada nem editada. `funcaoLabel(id)` resolve o rótulo
em qualquer lugar que precisar exibir o nome da função.

**O que cada funcionário vê é decidido por pessoa, não só pela função**:
`secoesPermitidas(funcionario)` prioriza `funcionario.secoesPermitidas`
(array de chaves de `SECTIONS`, cadastrado num checklist agrupado pelos
mesmos grupos do menu lateral — Desempenho/Produtos/Operação/Vendas/
Gestão/Sistema — na hora de criar/editar o funcionário) e só cai pro
`secoesPadrao` da função se a pessoa não tiver uma lista própria. Trocar a
função no formulário **re-sugere** o checklist com o padrão daquela
função (a pessoa ainda pode ajustar antes de salvar); função "admin"
esconde o checklist inteiro (sempre vê tudo, sem exceção — `secoesPadrao:
null` cai no fallback "todas as seções" de `secoesPermitidas`). `garcom`
continua caindo direto em Mesas por padrão — é de lá que atende os
chamados (ver "Mesas" abaixo) — mas isso agora é só o `secoesPadrao`
inicial da função `garcom`, editável por funcionário como qualquer outra.
Novos funcionários são cadastrados na seção "Funcionários" (só visível pra
`admin`), que também edita/remove — protegido contra remover o último
`admin` existente.

O grid desse checklist (`.secoes-checklist`) já teve um bug de layout: usava
`grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`, e o `1fr`
esticava cada coluna pra preencher todo o espaço do painel — em telas
largas isso afastava os 8 grupos uns dos outros com vãos enormes entre
eles (ex.: "Operação" e "Vendas" ficavam nas pontas opostas do card) e
chegava a empurrar o texto do `.meta` ao lado do título "Cadastrar
funcionário" pra fora da área visível. Corrigido trocando o `1fr` por uma
largura fixa (`minmax(200px, 210px)`), o que mantém as colunas compactas e
agrupadas à esquerda em vez de esticadas.

Teve um 2º bug de layout nesse mesmo checklist, de especificidade CSS: como
ele mora dentro do `<form class="add-form">` do "Cadastrar funcionário",
as regras genéricas `.add-form label` (`display: block` + texto em
maiúsculas) e `.add-form input` (`width: 100%` + caixa estilizada) tinham
especificidade maior que `.secoes-checklist-item`/`.secoes-checklist-item
input` e vazavam pra cá — cada checkbox esticava pra 100% da largura da
coluna, empurrando o texto do item pra própria linha de baixo (e ainda em
maiúsculas/negrito, igual ao cabeçalho do grupo, em vez do texto normal do
item). Corrigido qualificando os seletores como `.secoes-checklist
.secoes-checklist-item`/`... input` (mais específico que `.add-form
label`/`.add-form input`) e resetando explicitamente `text-transform`,
`letter-spacing`, `font-weight`, `margin-bottom` no label e `width`,
`padding`, `border`, `background` no input.

**Importante**: como é HTML solto, todo texto vindo de fora (nome/e-mail de
cliente ou funcionário, comentário de avaliação, motivo de chamado, campos
digitados no PDV etc.) é montado em `innerHTML` via concatenação de string —
sempre passar esse texto pela função `esc()` (helper de escape em
`core.js`) antes de interpolar, exatamente **uma vez** cada trecho. Já
houve um bug de escape duplo (`esc("Mesa " + esc(o.mesa))` na tabela
"Últimos pedidos" da Visão Geral), que fazia mesas com `&`/`<`/`>`/`"` no
número aparecerem com entidades HTML literais em vez do caractere — corrigido
pra escapar uma vez só, igual ao resto do painel.

### O que o admin lê/escreve do localStorage deste app (e do back-end)

O admin usa módulos ES entre os próprios arquivos de `public/admin/` (ver
tabela acima), mas continua sem importar nada do lado do CLIENTE — são
dois projetos/origens de módulo diferentes (o cardápio do cliente vive em
`src/data/data.js`, dentro do build do Vite/React). Por isso o catálogo-base
(`MENU_BASE`, `CATEGORIES_BASE`, `ADDON_GROUPS_BASE`, `COUPONS`, `REVIEWS_MOCK`) vive numa **fonte única**,
`src/data/catalogoBase.js` (módulo sem imports, lido por `data.js`), e
`scripts/gerar-catalogo-admin.mjs` gera `public/admin/catalogo.gerado.js`
(visão reduzida dos itens `{id,cat,name,price,desc}`, `price` = `precoPromo ?? preco`; categorias sem o `icon`)
— roda sozinho em `npm run dev`/`build` (`predev`/`prebuild`), ou à mão com
`npm run gerar:catalogo`. **Edite o cardápio em `catalogoBase.js`, nunca no
arquivo gerado.**

**Pedidos e chamado de garçom não vêm mais de `localStorage`** — migraram
pro back-end (ver "Back-end (`server/`)" acima). O truque que minimizou a
mudança: `getPedidosReais()`/`getChamadasGarcom()` continuam **síncronas**
com o mesmo shape de retorno de antes, só que lendo de um cache em memória
(`state.pedidosCache`/`state.chamadasCache`) em vez de `lsGet` — populado 1x
no `init()` via `fetch` e mantido em dia por eventos de socket
(`pedido:novo`/`pedido:atualizado`/`garcom:nova`/`garcom:atendida`/
`garcom:avaliada`, ver `initSocket()`), então as ~15 funções `renderX()` que
já chamavam essas duas funções não precisaram mudar nada.
`toggleCancelPedido`/`avancarStatusPedido`/`atenderChamada` fazem patch
otimista no cache local (UI continua instantânea) + `PATCH` em segundo
plano; a venda do PDV (`pdvFinalizarVenda`) manda `POST /api/pedidos/pdv`
em vez de escrever direto em `tnm_pedidos` — o servidor passa a atribuir
`id`/`criadoEm` (mesma fonte que os pedidos do cliente). `resumoCaixa`
(cálculo do caixa do PDV) também lê de `state.pedidosCache`, não mais de
`lsGet("tnm_pedidos", ...)`. Fora isso, a integração continua via
localStorage compartilhado:

- **Lê** `tnm_reviews_user` (Avaliações, combinado com o mock),
  `tnm_usuarios` (aba Clientes e Membros da aba Fidelidade).
- **Lê e escreve** `tnm_admin_menu_overrides`/`tnm_admin_menu_extra` (aba
  Pratos: esgotar/reabrir/editar nome-preço-descrição/estoque de item
  existente, ou criar/remover item novo — `data.js#aplicarCatalogoAdmin`
  aplica isso no cardápio do cliente), `tnm_admin_categorias` (aba
  Categorias — `data.js#aplicarCategoriasAdmin` aplica no cliente),
  `tnm_admin_addon_groups` (aba Adicionais Globais —
  `data.js#aplicarAddonsAdmin` aplica no cliente),
  `tnm_fidelidade` (ajuste manual de pontos/cashback pela equipe, e crédito
  de compras feitas no PDV) e `tnm_admin_fidelidade_config` (config do
  clube — só o admin edita, o cliente só lê; inclui o campo opcional
  `foto` de cada recompensa).
- **Só existe no admin** (sem equivalente no cliente): `tnm_admin_caixas`
  (sessões de caixa do PDV), `tnm_admin_config_loja` (nome, horário, taxa de entrega,
  tempo médio de preparo — ver "Configurações" abaixo).

### Seções do admin

O menu lateral (`SECTIONS` em `core.js`) agrupa as seções em 8 blocos —
Desempenho, Produtos, Compras, Operação, Vendas, Financeiro, Gestão e
Sistema (`buildNav`/`.rail-group-label`) — só um agrupamento visual (o mesmo
agrupamento é reaproveitado no checklist "Onde pode acessar" do cadastro
de funcionário). Permissão em si é `secoesPermitidas(funcionario)`, por
pessoa — ver "Login do admin" acima.

Com ~25 seções ao todo, `buildNav` também dá dois jeitos de reduzir a
carga visual do trilho, pensados pra não exigir escanear os 8 grupos toda
vez: um campo **"Buscar seção..."** (`#railSearch`/`aplicarFiltroRail`) que
filtra os botões pelo nome em tempo real (some com o grupo inteiro se
nenhum item dele bater); e cada rótulo de grupo virou um botão que
recolhe/expande seus itens (`toggleRailGroup`), com o estado persistido em
`localStorage` (`tnm_admin_rail_colapsado`, lista de nomes de grupo — por
navegador, não por funcionário, é só preferência de tela). Enquanto há
termo na busca, um grupo recolhido é forçado a mostrar os itens que
baterem (senão o resultado ficaria escondido atrás do recolhimento).

- **Visão Geral** (`dashboard`, grupo Desempenho): faturamento/pedidos/
  mesas ocupadas/avaliação média do período selecionado, gráfico de
  faturamento por mês, pratos mais vendidos (top 5), últimos pedidos —
  tudo calculado a partir de `state.pedidosCache` (pedidos reais, agora
  vindo do back-end — ver "Back-end (`server/`)" acima).
- **Produtos** (`produtosDesempenho`, grupo Desempenho — não confundir com
  a aba Pratos, que gerencia o cardápio): ranking completo (não só top 5)
  de produtos vendidos no período selecionado, ordenável por quantidade ou
  por receita, com ticket médio por item.
- **Garçons** (`garcons`, grupo Desempenho): agrega `state.chamadasCache`
  (chamados de garçom, vindo do back-end) por `atendidoPor` — atendimentos,
  tempo médio de resposta (`atendidoEm -
  criadoEm`), **nota média do cliente** (`notaCliente`, 1–5, só conta
  chamados que o cliente já avaliou pelo `App.jsx#AvaliarGarcomPrompt`) e
  último atendimento por funcionário. Chamados de antes dessa função
  existir (sem `atendidoPor` gravado) não entram na lista.
  **Placar** (`renderGarcons`, ranking por nota, não por volume de
  atendimento): pódio 🥇🥈🥉 dos até 3 funcionários com melhor nota média,
  exigindo pelo menos 2 avaliações pra entrar (evita 1 nota isolada decidir
  o 1º lugar) e desempatando por quem atendeu mais chamados; medalha
  também aparece ao lado do nome na tabela completa. É deliberadamente o
  oposto da gamificação que todo app de fidelidade de cliente faz (premiar
  quem gasta mais) — aqui é a qualidade do atendimento da própria equipe
  que vira ranking, com dado operacional real por trás.
- **Categorias** (`categorias`, grupo Produtos): CRUD de categorias do
  cardápio (`tnm_admin_categorias`) — ver `CATEGORIES` em "Dados
  mockados" acima. Categoria base só tem o rótulo editável; categoria
  extra só pode ser excluída se nenhum prato a estiver usando.
- **Adicionais Globais** (`adicionais`, grupo Produtos): CRUD dos grupos
  de adicionais (`tnm_admin_addon_groups`) — ver `ADDON_GROUPS` em "Dados
  mockados" acima, inclusive a limitação de não dar pra atribuir um grupo
  extra a um prato pela UI do admin.
- **Insumos** e **Ficha Técnica** (`insumos`/`fichaTecnica`, grupo
  Produtos), **Fornecedores** e **Compras** (`fornecedores`/`compras`,
  grupo Compras), **Contas a Pagar**, **Contas a Receber** e **Relatórios**
  (`contasPagar`/`contasReceber`/`relatorios`, grupo Financeiro) — módulo
  de ERP, 100% back-end desde o início (nunca foi `localStorage`); ver
  "ERP administrativo (`server/`)" acima pra detalhe completo de cada um.
- **PDV** (`pdv`, grupo Operação): ponto de venda pra atendimento
  presencial (balcão/mesa/entrega registrado pela equipe, não pelo QR Code
  do cliente). Mostra um selo "Loja aberta"/"Loja fechada" no topo,
  calculado a partir de `tnm_admin_config_loja` (ver "Configurações"
  abaixo).
  - Fluxo: grade de produtos (respeitando estoque/indisponibilidade) →
    comanda → tipo de pedido → pagamento (Pix/Cartão/Dinheiro, com campo de
    valor recebido + troco automático no Dinheiro — o campo é `type="text"
    inputmode="decimal"`, não `type="number"`, de propósito: o valor
    re-renderiza a cada tecla pro troco atualizar ao vivo, e `type="number"`
    não permite reposicionar o cursor no fim depois de recriar o `<input>`,
    o que fazia os dígitos entrarem em ordem invertida) → e-mail do cliente
    (opcional — se informado, credita pontos/cashback igual a uma compra
    pelo QR Code, via `creditarCompraFid`, espelho de `creditarCompra` do
    cliente) → cupom opcional → "Finalizar venda", que manda
    `POST /api/pedidos/pdv` (mesmo formato do cliente, só que com
    `origem:"pdv"`) e confirmação instantânea (sem a encenação de
    Pix/maquininha que o cliente tem). Pedido tipo "Entrega" soma a taxa de entrega configurada
    (`tnm_admin_config_loja.taxaEntrega`) ao total, mostrada como linha
    separada na comanda e no recibo (`pedido.taxaEntrega`) — só existe
    nas vendas feitas pelo PDV; o checkout do cliente (QR Code) não cobra
    taxa de entrega.
  - **Dividir a conta**: checkbox "Dividir a conta entre várias pessoas"
    substitui o seletor único de pagamento por um rateio igual do total
    entre 2–10 pessoas (`pdvValoresDivisao` — resto da divisão de centavos
    vai pra última pessoa, pra soma bater exato), cada uma com sua própria
    forma de pagamento (Pix/Débito/Crédito/Dinheiro — mais granular que o
    pagamento único, que não distingue débito de crédito). O pedido grava
    `pagamento:"dividido"` + um array `divisao` (`{pessoa, valor,
    pagamento}` por pessoa) em vez de um pagamento só; recibo e resumo pós-
    venda mostram a fatia de cada pessoa. `resumoCaixa` soma o campo
    `divisao` pedido a pedido (em vez do total inteiro) pra calcular o
    esperado em dinheiro/débito/crédito da gaveta — essencial pra reconciliar
    o caixa quando só parte de uma conta dividida foi paga em espécie.
  - **Caixa**: precisa abrir caixa (operador + fundo de troco inicial)
    antes de vender; **sangria** registra retirada de dinheiro do caixa;
    **fechar caixa** compara o valor contado na gaveta com o esperado
    (fundo + vendas em dinheiro − sangrias) e mostra sobra/falta.
  - **Recibo**: botão "Imprimir recibo" abre o diálogo de impressão do
    navegador (`window.print()` + `#reciboImprimir` com CSS `@media
    print`) com um recibo formatado — é **não-fiscal**, tem aviso explícito
    disso impresso nele (cupom fiscal de verdade exigiria certificado
    digital + integração com Sefaz, fora do escopo de um protótipo).
- **Cozinha (KDS)** (`cozinha`, grupo Operação): painel de preparo com 3
  colunas (Recebido/Em preparo/Pronto), juntando pedidos do cliente (QR) e
  do PDV, de qualquer tipo (balcão/mesa/entrega). Cada card tem um botão
  pra avançar pro próximo estágio — a 1ª vez que um pedido é tocado aqui,
  ele grava `statusManual` em si mesmo e passa a ignorar o relógio pra
  sempre (ver `statusPedido`/`statusPedidoReal`); pedidos nunca tocados
  continuam 100% automáticos, como sempre foram.
- **Delivery** (`delivery`, grupo Operação): o mesmo board de 3 colunas da
  Cozinha, só que filtrado a pedidos `tipo:"entrega"` — avança o mesmo
  `statusManual` (`avancarStatusPedido`), então uma ação aqui também
  reflete na Cozinha e vice-versa (os dois `renderCozinha`/`renderDelivery`
  se chamam mutuamente pra ficar em sincronia, mas cada um usa sua própria
  classe de botão — `.avancar-status` na Cozinha, `.avancar-status-delivery`
  no Delivery — porque as duas seções ficam sempre no DOM ao mesmo tempo, e
  reusar a mesma classe faria o clique disparar os dois handlers). Mostra o
  endereço do pedido (`pedido.endereco`) quando informado, e lista as
  últimas 10 entregas concluídas.
- **Pratos**: cardápio (ver acima) + campo de estoque por item — ao chegar
  a 0, some do cardápio do cliente automaticamente (`aplicarCatalogoAdmin`).
  Vendas do PDV **e** pedidos do cliente decrementam o mesmo estoque
  (`decrementarEstoque` no admin, `baixarEstoque` em `data.js` do cliente —
  mesma lógica, duplicada). Preço aceita casas decimais livres (`step`
  0.01, não trava em múltiplos de R$0,50). Adicionar/editar prato aceita
  upload de foto (`<input type="file">` lido como base64 via `FileReader`,
  campo `foto` no override/extra) — mostrada no card do admin no lugar do
  ícone de letra, e propagada pro cliente como `imgUrl` do item via
  `aplicarCatalogoAdmin`. Botão "Editar" abre um modal pra corrigir nome/
  preço/descrição/foto de um item (base ou criado no admin) — reflete no
  cliente via `aplicarCatalogoAdmin` (ver acima).
- **Avaliações / Pedidos**: ver pedidos reais; filtro de avaliações por
  nota inclui 1 a 5 estrelas (mais "Todas"). A aba Pedidos tem botão
  "Exportar CSV" do período filtrado (`exportarCSV`, Blob + `<a download>`,
  sem lib externa).
- **Mesas** (grupo Operação): deriva ocupação de pedidos ativos com
  `tipo:"mesa"` (mesas 1–8 fixas, sem equivalente real no cliente — que usa
  número de mesa livre). Mostra também a fila de "chamados de garçom"
  pendentes (`state.chamadasCache`, vindo do back-end), com o **motivo** do
  chamado (`MOTIVO_GARCOM`, espelho do cliente) e botão "Atender" — grava
  `atendidoPor` no chamado com `{id, nome, funcao}` do funcionário logado
  no momento do clique (sem formulário nem seletor: é a mesma pessoa que
  clicou), usado na aba Garçons pra calcular atendimentos/tempo de
  resposta por pessoa. É a única seção visível pra quem loga como
  `garcom` — ver "Login do admin" acima.
- **Histórico de Caixas** (`caixas`, grupo Vendas): lista somente-leitura
  de todos os caixas já abertos (`tnm_admin_caixas`), fechados ou não —
  operador, abertura, fechamento, fundo inicial, total vendido (via
  `resumoCaixa`), sangrias e diferença apurada no fechamento. Complementa
  o "Caixa" do PDV (que só mostra o caixa aberto no momento, ou o último
  fechamento).
- **Clientes**: contas reais de `tnm_usuarios` — sem cruzamento com gasto/
  pedidos, porque pedir no app cliente não exige login.
- **Fidelidade**: config (pontos por real, validade, % cashback), níveis e
  recompensas editáveis (nome, custo em pontos e foto opcional — mostrada
  no card da recompensa no cliente, ver "Clube de fidelidade + cashback"
  acima), lista de membros com nível/saldo calculado, e ajuste manual de
  pontos/cashback (cortesias, correções) — ver `utils/utils.js` do
  lado do cliente pra lógica de crédito/expiração.
- **Financeiro**: folha de pagamento mockada, sem nenhum equivalente no
  cliente (dado só de back-office); também com botão "Exportar CSV". Não
  tem relação com login — é uma lista à parte (`state.employees`, só em
  memória), não confundir com a aba Funcionários abaixo.
- **Funcionários**: só visível pra quem logou como `admin`. Duas partes —
  "Funções" (CRUD da tabela `Funcao`) e
  "Cadastrar funcionário" (tabela `Funcionario`, via `/api/admin/funcionarios`: nome,
  usuário, senha, função e o checklist "Onde pode acessar", agrupado por
  seção do menu). É o que decide quem consegue logar no painel e o que
  cada um vê — ver "Login do admin" acima pro detalhe de como função e
  acesso por pessoa se combinam.
- **Configurações** (`configuracoes`, grupo Sistema): nome do restaurante,
  horário de funcionamento (abre/fecha), taxa de entrega e tempo médio de
  preparo, salvos em `tnm_admin_config_loja`. Horário e taxa de entrega são
  usados de verdade no PDV (selo "Loja aberta"/"Loja fechada" e taxa
  somada no total de pedidos "Entrega" — ver "PDV" acima); tempo médio de
  preparo é só informativo por enquanto, não alimenta nenhum cálculo. A
  comparação de horário não trata virada de dia (loja que abre à noite e
  fecha de madrugada) — assume que fecha ainda no mesmo dia.

## Convenções do código

- Nomes de variáveis, funções e comentários majoritariamente em
  **português** (domínio do negócio); nomes de arquivos/componentes React
  em inglês/PascalCase.
- Comentários existentes explicam decisões não óbvias (por que algo é
  feito de um jeito específico), não o óbvio — seguir esse padrão ao
  editar.
- Testes automatizados só no back-end (`cd server && npm test`, `node:test`); o
  front não tem suíte — é verificado à mão (ver "Verificação manual").

## Limitações conhecidas (é um protótipo)

- Back-end existe só pra 4 fatias com estado (auth, pedidos, chamado de
  garçom, pedido em grupo — ver "Back-end (`server/`)") + a busca por IA
  (sem estado, só repassa pro Gemini) + o módulo de ERP (insumos/compras/
  financeiro, admin-only — ver "ERP administrativo (`server/`)"); o resto
  do app (cardápio, fidelidade, carteira, PDV/caixa, funcionários, config
  da loja) continua `localStorage` + timers simulando latência de rede,
  exatamente como antes.
- **ERP**: baixa de estoque por venda só considera o prato principal
  (adicionais não têm ficha técnica própria); recebimento de compra é
  tudo-ou-nada (sem recebimento parcial); `ContaReceber` é só pra
  recebíveis avulsos, não ligados a pedido; rotas protegidas só por sessão
  de funcionário (ver "Segurança");
  disponibilidade de prato pro cliente React continua 100% baseada no
  `dish.estoque` de hoje, não integrada ao novo estoque de insumo.
- **Carteira**: o PIN protege contra alguém folheando a UI, mas não é uma
  barreira real — mesmo nível de confiança que o resto do app já tem
  documentado (quem mexe no DevTools consegue ler/editar `tnm_carteira_pin`
  direto, mesmo sendo um hash). Cartões salvos são só simulação, sem
  gateway real. Vale-presente não debita o saldo de quem compra (mesmo
  espírito sem gateway real da recarga de carteira) — é uma "impressão"
  simulada de valor pro presenteado, não uma transferência de verdade.
- **Checkout**: Pix Copia e Cola é um código gerado no formato solto do BR
  Code/EMVCo, **não é um payload Pix válido** — colar isso num app de banco
  de verdade não funciona. Troco calculado e cartão escolhido não são
  gravados no pedido — só existem durante o checkout (mesma limitação que
  o troco do PDV do admin já tinha).
- **Busca por IA**: depende de `GEMINI_API_KEY` configurada no servidor
  (gratuita, mas exige conta no Google AI Studio) — sem ela, cai pro filtro
  de texto comum sem avisar que a IA "existe" mas está desligada.
- **Mapa de entrega**: o mapa em si é real (Leaflet + OpenStreetMap), mas a
  rota é ilustrativa — a loja fica num ponto fixo (`COORDS_LOJA` em
  `utils/utils.js`, ajustar pro endereço real antes de qualquer uso real) e
  o destino é derivado do id do pedido, não do endereço de texto que o
  cliente realmente digitou (geocodificação de verdade exigiria um serviço
  como Nominatim, com limite de uso).
- Reserva de mesa (`account.jsx#ReservaMesaSheet`) só guarda o pedido de reserva —
  não bloqueia mesa nenhuma de verdade nem avisa a equipe (sem contraparte
  no admin), é só uma lista pro próprio cliente ver o que já reservou.
- **Permissão por seção só no painel**: o servidor distingue só 2 níveis
  (funcionário logado × função `admin`, que gere a equipe); quais seções cada
  pessoa vê é decidido no `admin.html` (client-side), então um funcionário
  logado que chame a API direto alcança rotas de outras seções (ex.: garçom
  chamando `/api/estoque`). Upgrade: mapear rota → seção no servidor.
- Sessão de admin dura 12h e não há "esqueci minha senha" do painel: o
  administrador redefine a de alguém na aba Funcionários, e quem perdeu o
  acesso total roda `npm run admin:criar` de novo (redefine a senha do e-mail
  informado).
- `POST /api/pedidos` valida formato/limites (itens, qtd, tamanho de texto,
  tipo) mas **continua confiando em `total`/`cupom`/`cashbackUsado`
  vindos do cliente** — o catálogo mora no front, então o servidor não
  recalcula preço. Upgrade: mover `MENU` pro Postgres.
- Códigos de confirmação/recuperação vivem em memória do processo (somem se o
  servidor reiniciar, ex.: o plano grátis do Render "dorme" — o cliente pede outro).
  Sem `RESEND_API_KEY` não há confirmação de cadastro; sem domínio verificado no
  Resend, o e-mail só chega ao dono da conta Resend. Contas criadas com o envio
  desligado ficam sem `emailVerificadoEm` e, ao ligá-lo, precisam usar a
  recuperação de senha (que também confirma a conta).
- Status do pedido avança sozinho com o tempo por padrão (não reflete
  cozinha real) — só passa a refletir ações reais da equipe se alguém
  mexer nesse pedido específico pelo Painel de Cozinha (KDS) do admin.
- Imagens do cardápio são placeholders de banco de imagens (Unsplash).
- Se alguém rodar o admin sem passar por `npm run dev`/`build`,
  `public/admin/catalogo.gerado.js` pode estar desatualizado em relação a
  `src/data/catalogoBase.js` (rode `npm run gerar:catalogo`).
- Fidelidade/cashback só existem pra pedidos com conta logada — pedido de
  visitante nunca credita nada, mesmo que a pessoa se cadastre depois.
- O recibo do PDV é explicitamente não-fiscal (sem certificado
  digital/integração Sefaz) — só serve pra demonstração do protótipo.
- Grupo de adicionais criado na aba Adicionais Globais do admin não tem
  como ser atribuído a um prato pela própria UI do admin (a ficha de
  prato não tem esse campo) — só passa a valer editando `item.addons` à
  mão em `data/data.js`.
- O selo "Loja aberta"/"Loja fechada" e a taxa de entrega
  (`tnm_admin_config_loja`) só existem no PDV do admin — o checkout do
  cliente (QR Code) não os lê nem os aplica.
- Pedido agendado (balcão/entrega, não mais mesa) só guarda `{data, hora}`
  junto do pedido — nada dispara de fato no horário marcado (sem
  back-end/cron), é só informativo no histórico do cliente e do admin.
- Oferta personalizada (`VOLTEI15`) usa uma regra fixa só (≥3 dias sem
  pedir) — não é um motor de recomendação de verdade, é um exemplo de
  cupom automático por comportamento.
- Clube de assinatura "Casa do Pato+" não cobra nada de verdade (sem
  gateway de pagamento) — é só um toggle que liga o desconto automático de
  10%.
- Notificação push do navegador exige permissão explícita do usuário (o
  navegador nunca deixa pedir isso sozinho) e só funciona enquanto a aba
  continuar aberta em algum lugar (fechar a aba encerra o `setInterval`
  que detecta a mudança de status).
