# Changelog

Registro das etapas de desenvolvimento do TCC — cada entrada documenta o que
foi feito numa sessão de trabalho, pra servir de histórico e apoiar a
redação do TCC em si. Não confundir com `CLAUDE.md` (documentação viva da
arquitetura atual, sem histórico) — aqui é histórico; lá é o "estado atual".

---

## 2026-10-09 (2) — Catálogo no Postgres e preço conferido no servidor

### Problema
- `total`, preço e cupom do pedido vinham do cliente (o cardápio morava no front): quem mexesse
  no DevTools pagava R$ 0,01. E tudo que o admin editava (preço, pratos novos, estoque,
  categorias, adicionais) ficava no `localStorage` do navegador dele — os celulares dos
  clientes nunca viam.

### O que mudou
- Tabelas `CatalogoConfig` e `EstoquePrato` (migration `catalogo_servidor`); `GET /api/catalogo`
  entrega o cardápio efetivo; o app cliente recebe e atualiza ao vivo (`catalogo:atualizado`).
- O painel admin grava no servidor (Pratos, Categorias, Adicionais, estoque); fotos reduzidas a 800px.
- `conferirPedido`: preço, adicionais, cupom e estoque por prato recalculados/conferidos no servidor
  (400/409 com mensagem); estoque do prato baixado de forma atômica (testado com 2 pedidos
  simultâneos no último item). PDV também.
- Módulo `src/data/catalogoAplicar.js` compartilhado (regras de aplicar edições); `data.js` deixou
  de ler `localStorage`. Corrigido: preço editado no admin agora descarta a promoção do prato base
  (antes o cliente continuava cobrando o preço promocional antigo).

### Limite que sobrou
- Cashback e assinatura (desconto de 10%) continuam vindos do cliente porque a fidelidade é
  `localStorage`; o servidor limita ao subtotal e exige conta logada. Fechar de vez = mover a
  fidelidade pro Postgres.
- As edições antigas do admin no `localStorage` não foram migradas.

---

## 2026-10-09 — Limite por cadastro, avaliações no banco, IA, carrinho e busca

### Limite de pedido pelo cadastro
- `validarEstoquePedido` (servidor) soma o consumo dos ingredientes ativos cadastrados
  na ficha técnica e recusa com 409 e mensagem clara quando não cobre o pedido;
  `POST /api/pedidos/disponibilidade` confere antes do checkout. Sem ficha/insumo
  cadastrado não há limite (decisão: não travar o restaurante com cadastro vazio).

### Avaliações no Postgres
- Nova tabela `Avaliacao` (migration `avaliacoes`), `GET/POST /api/avaliacoes`, evento
  `avaliacao:nova`. O admin lê do banco. "Avaliar pedido" agora marca `avaliado` no
  servidor (antes só no estado local, voltava a "não avaliado" ao recarregar). Foto
  reduzida no navegador. Avaliações antigas do `localStorage` não são migradas.

### IA
- Causa no deploy: `GEMINI_API_KEY` não existe no Render (a rota respondia 503). O código
  funciona (testado com chave real). Mensagens de erro passaram a ser claras (503/429/502),
  aviso no log de subida e, se uma sugestão falha, o campo é limpo em vez de esconder o cardápio.

### Carrinho e busca
- Carrinho: sugestões saíram da faixa fixa (roubava metade da tela no celular) e entram na
  rolagem; mais espaço entre itens, alvos de toque maiores, cupom recolhido por padrão.
- Busca: o painel não tinha fundo (sugestões ficavam por cima do cardápio) nem limite de
  altura; chips viraram linhas roláveis, o campo ganha foco ao abrir, `Esc` fecha e fechar
  limpa o termo (antes o filtro continuava valendo escondido e o cardápio parecia vazio).

### Achados nos testes e corrigidos
- Avaliação aparecia duplicada (resposta do POST + socket): deduplicada por id.
- Admin abria fixo em ago/2026: pedidos novos não apareciam em Pedidos/Visão Geral. Agora
  abre no mês atual.
- Foto do Pudim (Unsplash) saiu do ar e o texto alternativo gigante tomava o card: fallback
  `FotoItem` pro emoji e URL removida.
- Toast longo ficava estreito e sumia rápido: largura e duração proporcionais ao texto.

---

## 2026-10-08 — Segurança, equipe no banco, e-mail, identidade e deploy no Render

### Resumo
Revisão de segurança do back-end e correção do que ela achou, contas de
funcionário no Postgres (fim da chave única do admin), confirmação de e-mail e
recuperação de senha por e-mail, troca de nome/identidade para **Casa do Pato**,
unificação do catálogo entre app e admin, README/licença e publicação no Render.

### Segurança
- Revisão estática do `server/` e do admin apontou: redefinição de senha sem
  prova de posse (qualquer um trocava a senha de qualquer conta), XSS armazenado
  no admin (`statusManual`/`unidade` sem validação, `esc()` sem escapar aspas),
  rotas e sala de socket do admin abertas, sem rate limit, enumeração de e-mails.
- Correções: código de 6 dígitos de uso único na recuperação, whitelists e `esc()`
  completo, `exigirAdmin` em todas as rotas do admin, `@fastify/rate-limit`,
  `setErrorHandler` genérico, cookie `secure`/`maxAge`, validação de entrada em
  pedidos/grupo/garçom/IA. Testes em `server/test/` (20 ao todo).

### Equipe do painel no banco
- Tabelas `Funcionario`/`Funcao` (senha bcrypt) no lugar do `localStorage` com senha
  em texto puro e da chave `ADMIN_TOKEN`. CRUD só para a função Administrador;
  protege o último administrador; apagar a conta derruba o acesso na hora.
- `npm run admin:criar` cria o primeiro administrador sem tocar no painel da
  hospedagem. Limite: permissão por seção segue só no painel (client-side).

### E-mail
- Cadastro com confirmação por código e recuperação de senha por e-mail, via API do
  Resend (o plano grátis do Render bloqueia SMTP). Valida formato e domínio (MX).
  Sem `RESEND_API_KEY` volta ao modo desenvolvimento. Sem domínio verificado o
  Resend só entrega ao dono da conta.

### Identidade e catálogo
- Sistema renomeado para Casa do Pato (pacotes, e-mails de exemplo, textos), logo
  e favicon novos. Catálogo-base numa fonte única (`src/data/catalogoBase.js`) com
  gerador para o admin (`npm run gerar:catalogo`); removidos código morto,
  `viewMode`, duas dependências de tipos e docs duplicados.

### Deploy
- `render.yaml`, `start:prod`, `trustProxy: 1`, README com passo a passo. Migrations
  rodam no build (`prisma migrate deploy`; precisa de conexão direta do Neon).

### Bugs encontrados na prática
- **Pedidos não chegavam ao vivo no admin**: o socket conectava antes do login e o
  servidor só lê o cookie no handshake. Correção: reconectar o socket após o login.
- **Autofill do celular** preenchia o e-mail no campo do código: campo de usuário
  invisível + validação de 6 dígitos.
- **`P1002` no deploy**: migration travando pelo pooler do Neon; usar a conexão direta.
- Cadastro mostrava "enviamos o código" mesmo com o envio recusado pelo provedor;
  agora avisa.

### Limitações registradas
Preço/total do pedido vem do cliente; permissão por seção só no painel; códigos em
memória do processo; pagamentos simulados; sem cabeçalhos de segurança (helmet/CSP).

---

## 2026-08-28 (continuação) — Revisão de bugs reais, ortografia e alinhamento

### Resumo

Retomou uma sessão de "Otimização" que tinha sido interrompida por limite de
uso logo depois que a skill `/code-review` (rodando em segundo plano sobre
`src`, `server/src` e `public/admin.html`, nível "high") terminou e encontrou
5 problemas reais — mas antes de mostrar quais eram ou corrigi-los. Como não
sobrou nenhum registro do resultado daquela revisão, os passos foram: (1)
conferir que as edições já aplicadas pela sessão anterior (ortografia/emoji
em `CarteiraSheet`/`ReservaMesaSheet`/`PedidoInfo`/`FormaPagamento`, `minLength`
de senha, o bug de CSS do `hidden` nos chips de busca, a concordância "além
das funções padrão" no admin, e a centralização de `dividindoAConta`)
continuavam intactas; (2) rodar a revisão de código de novo do zero
(resultado desta vez: **10 problemas reais**, não 5 — mais abrangente porque
partiu do zero); (3) fazer uma passada manual em todos os ~50 componentes
`.jsx` procurando ortografia/emoji/alinhamento; (4) subir o app de verdade
(`npm run dev:all`, Postgres real) e navegar pelo Chrome automatizado pra
achar bugs visuais que revisão de código nenhuma pega sozinha.

### Bugs reais encontrados e corrigidos

**Achados só testando no navegador (não apareceriam numa leitura de código):**
1. Badge de desconto duplicado no card "Pato – Cheddar Bacon" — o item tinha
   `tag: "20%"` **e** `descontoPct: 20` no `data.js`, cada um desenhando seu
   próprio selo (vermelho e verde) empilhado por cima do outro. Removida a
   `tag` redundante.
2. `.tipo-pedido-row button` não tinha nenhum estilo `:disabled` — um botão
   de pagamento desabilitado (ex.: "Usar saldo da carteira" com saldo R$0)
   aparecia com a mesma cor cheia de um botão selecionado de verdade, sem
   nenhuma pista visual de que estava bloqueado.

**Achados pela revisão de código, verificados e corrigidos:**
3. `escolherOpcaoDinheiro` (`AppContext.jsx`) ligava `usarCashbackNoCarrinho`
   ao escolher "usar saldo da carteira", mas nunca desligava ao trocar pra
   "pagar em nota" — o desconto do saldo continuava sendo aplicado mesmo o
   cliente achando que ia pagar 100% em dinheiro físico.
4. O handler global de Esc (fecha todos os modais) ficou sem
   `setCarteiraOpen`/`setCarteiraDesbloqueada`/`setReservasOpen` — esses dois
   sheets foram adicionados depois que o handler foi escrito. Esc não fechava
   a Carteira nem re-travava o PIN, quebrando a garantia documentada de que
   ela nunca fica destravada depois de fechada.
5. `cartaoEscolhidoId` fica `"motoboy"` salvo entre pedidos; num pedido
   *não*-entrega seguinte, `FormaPagamento.jsx` calculava `naMaquininha` só
   pelo id salvo (ignorando o tipo do pedido), escondendo a lista de cartões
   salvos sem nenhuma forma de escolher um.
6. `precoBase`/`ItemCard.jsx` tratavam `precoPromo` com valor `0` (uma
   promoção "grátis") como falsy — o item caía de volta pro preço cheio em
   vez de custar R$0,00.
7. `apiFetch` (`utils/api.js`) chamava `JSON.parse` sem `try/catch` antes de
   checar `resp.ok` — uma resposta de erro não-JSON (proxy/502) quebrava com
   `SyntaxError` cru em vez do `ApiError` esperado pelos `catch` espalhados
   pelo `AppContext`.
8. Condição de corrida real em `PATCH /api/grupo/:codigo/itens/:itemId`
   (server): lia `qtd` com `findFirst`, calculava a nova quantidade em JS e
   gravava com `update` — dois participantes tocando "+1" quase ao mesmo
   tempo podiam perder um incremento, e dois decrementos simultâneos até
   `qtd: 0` podiam estourar um `P2025` não tratado no segundo `delete`.
   Trocado por `updateMany` com `{ increment }` (atômico no banco) + captura
   do `P2025` no delete concorrente.
9. `POST /api/auth/cadastro` fazia "checa depois cria" sem tratar a colisão
   de e-mail (`P2002`) — dois cadastros simultâneos pro mesmo e-mail faziam
   o segundo estourar 500 em vez do 409 esperado (mesmo padrão que
   `grupo.js` já usava pra colisão de código de grupo).
10. `secoesPermitidas` (`admin.html`) caía no fallback "todas as seções"
    (pensado só pra `admin`, com `secoesPadrao: null` de propósito) sempre
    que a função de um funcionário não era encontrada — uma função apagada/
    renomeada depois de o funcionário já existir dava acesso total,
    incluindo "Funcionários" (RH), pra qualquer cargo. Corrigido pra checar
    `"admin"` pelo id explicitamente; função não encontrada agora cai em
    "nenhum acesso".
11. "18 item(ns)" (aba Pratos do admin) — concordância que não faz sentido
    em português (plural de "item" é "itens", não "item" + "ns"). Trocado
    por um `? "item" : "itens"` de verdade.

**Fechando pendências de sessões anteriores:**
- O bug de CSS dos chips de busca (`.busca-sugestoes`/`.busca-sugestoes-ia`
  sobrescrevendo `hidden`), registrado como pendente na sessão de ontem
  ("Próximas etapas" #1), já tinha sido corrigido pela sessão de Otimização
  interrompida — confirmado ao vivo no navegador, não precisou de nova
  correção.
- "Sincronizar a cópia-fonte do admin" (`Adm/brasa-sal-admin.html`),
  pendente desde a sessão de back-end (item #4 de ontem), deixou de fazer
  sentido: o usuário confirmou que apagou aquela cópia de propósito (era só
  demonstrativa). `CLAUDE.md` atualizado pra não descrever mais 2 cópias
  pra manter em sincronia.

**Não corrigidos de propósito (limitação arquitetural, não bug simples):**
- `pedidos.js` grava `body.total` do jeito que o cliente manda, sem
  recalcular contra `itens[]` — corrigir de verdade exigiria migrar
  cupom/cashback pro back-end (hoje 100% client-side de propósito, ver
  `CLAUDE.md`), fora do escopo de uma limpeza de bugs.
- `POST /api/grupo/:codigo/sair` aceita qualquer `participanteId` do corpo
  sem provar que quem pediu é aquele participante — qualquer um no grupo já
  vê o id de todo mundo via Socket.IO, então dá pra remover outro
  participante sabendo o id dele. Precisaria de um token por participante
  (mudança de schema), não só um fix de lógica.

### Testado manualmente (Chrome automatizado, ponta a ponta)

- Cardápio, ficha de produto (adicionais, ingredientes, avaliação com foto)
  e carrinho, sem regressão visual.
- Cadastro de conta nova, medidor de força de senha, Clube de Fidelidade
  (Bronze · 0 pontos), Carteira (criação de PIN, saldo, cartão, vale-
  presente).
- Esc fechando a Carteira e re-travando o PIN (era o bug #4 acima).
- "Na mesa" → Dinheiro → confirmação visual de que "Usar saldo da carteira"
  desabilitado (saldo R$0) agora aparece esmaecido, e a lista de cartões
  salvos aparece corretamente mesmo com `cartaoEscolhidoId` herdado de
  "motoboy" (bugs #2 e #5).
- Painel admin: login, Visão Geral, Pratos (contagem "itens" corrigida),
  Funcionários, Mesas — sem regressão depois do fix de `secoesPermitidas`
  (admin continua vendo todas as seções).
- `npm run lint` limpo (só os 2 avisos pré-existentes e benignos) e o
  back-end reiniciou 9x sem erro (`node --watch`) durante as edições em
  `grupo.js`/`auth.js`.

### Próximas etapas

1. Se o TCC for demonstrar pedido em grupo entre desconhecidos numa mesa
   real (não só entre amigos que confiam uns nos outros), vale endereçar o
   `participanteId` sem prova de identidade do `/sair` (ver acima).
2. Testes automatizados — ponto que já vem se arrastando desde a sessão de
   back-end; os bugs de race condition encontrados hoje (#8) são exatamente
   o tipo de caso que um teste de integração pegaria antes de ir pra
   produção.
3. Continua sem suite de testes — mesma nota das duas sessões anteriores.

---

## 2026-08-28 — Carteira, IA no cardápio, pagamento realista e RH do admin

### Resumo

Sessão longa, em cima do back-end MVP de ontem. Trocou de figura em três
blocos: (1) três apostas competitivas escolhidas a partir de um raio-x
comparando o app com iFood/99Food/McDonald's/BK/Starbucks — divisão
inteligente da conta, gamificação do garçom e busca por IA no cardápio;
(2) criptografia mais forte na senha de cadastro + uma Carteira nova
(cartão salvo, saldo, vale-presente, protegida por PIN); (3) um pacote
grande pedido de uma vez — carteira pro perfil, IA "mais livre", pagamento
do carrinho bem mais realista (Pix Copia e Cola, cartão salvo/maquininha
do motoboy, dinheiro com troco), mesa com "pagar depois", reserva de mesa
no perfil, e funções/permissões dinâmicas no RH do admin. Tudo com
`npm run lint`/`npm run build` limpos e testado ao vivo no navegador a
cada etapa (Chrome automatizado), não só revisão de código.

### O que foi construído

**Divisão inteligente da conta** (`CartExtra.jsx`, `AppContext.jsx`): dentro
de um pedido em grupo com ≥2 participantes com item no carrinho, alterna
entre rateio igual (já existia) e um novo modo que soma o que cada pessoa
realmente pediu (`participanteNome` por item, que o pedido em grupo já
carregava) e rateia cupom/cashback proporcionalmente.

**Gamificação do garçom** (`admin.html`, aba Garçons): placar/pódio
🥇🥈🥉 rankeando a equipe pela nota média do cliente (mín. 2 avaliações pra
entrar), o oposto de gamificar o cliente pra ele gastar mais (que é o que
McDonald's/BK fazem).

**Busca por IA no cardápio** (`POST /api/ia/busca`, Gemini): pergunta
livre vira recomendação real (não filtro por palavra-chave), com chips de
sugestão ("Me surpreenda" etc.) pra baixar a fricção — depois "afrouxada"
ainda mais no pacote grande (prompt reescrito pra opinar/montar combo,
limite de 6→8 itens, pensamento automático do modelo).

**Criptografia forte + Carteira**: bcrypt do cadastro subiu de cost 10 pra
12, com validação de senha forte (8+ caracteres, letra e número) nos dois
lados. Carteira nova (depois movida pro perfil no pacote grande):
protegida por PIN hasheado com PBKDF2-SHA256 + salt via Web Crypto API
nativa do navegador (sem dependência); cartão salvo (simulado, só 4 últimos
dígitos); vale-presente com código único resgatável 1x entre contas
diferentes.

**Mapa de entrega real**: trocou a barra decorativa por um mapa Leaflet +
tiles do OpenStreetMap de verdade (gratuito, sem chave), com rota
tracejada e ícone se movendo — a rota em si continua ilustrativa (loja
fixa, destino derivado do id do pedido, sem geocodificar o endereço de
texto de verdade).

**Pagamento do carrinho, bem mais realista**:
- Pix ganhou um "Copia e Cola" simulado (formato solto tipo BR Code) com
  botão de copiar.
- Cartão passou a listar os cartões salvos na Carteira pra escolher, ou
  (só em entrega) "pagar na maquininha do motoboy".
- Dinheiro ganhou duas sub-opções — "usar saldo da carteira" (atalho pro
  toggle de cashback que já existia) ou "pagar em nota", que revela uma
  calculadora de troco (precisa/não precisa + quanto vai pagar, mesmo
  cálculo do troco do PDV do admin, agora do lado do cliente).

**Mesa: "pagar agora ou depois"**: tirou "Agendar horário" do carrinho de
mesa (não fazia sentido pra quem já tá sentado) e colocou uma escolha
entre pagar já (fluxo normal) ou pagar depois — chamando o garçom ou no
caixa —, que pula o `PixSheet` inteiro e manda o pedido direto pra cozinha
com o pagamento marcado como pendente.

**Reserva de mesa** (novo, no perfil): repaginou o conceito de "agendar
horário" — agora é reservar uma mesa pra um horário futuro, sem relação
com nenhum pedido específico, com lista e cancelamento.

**RH do admin — funções e acesso dinâmicos**: a lista de funções
(Administrador/Cozinha/PDV/Garçom) deixou de ser fixa — dá pra criar uma
função nova ou apagar uma sem uso (bloqueado se algum funcionário ainda
usa ela). No cadastro de funcionário, um checklist agrupado por seção do
menu deixa escolher exatamente onde cada pessoa pode acessar, pré-sugerido
pela função escolhida mas ajustável por pessoa — "admin" continua sempre
vendo tudo, sem exceção.

### Bugs reais encontrados durante a implementação

1. `gemini-2.5-flash` foi descontinuado pra contas novas no meio da sessão
   — a própria API respondeu 404 recomendando `gemini-3.6-flash`; só foi
   pego testando a chamada de verdade contra a API, não teria aparecido
   numa revisão de código.
2. Bug de CSS **pré-existente** (não introduzido nesta sessão, só
   percebido durante teste): o atributo `hidden` dos chips de categoria da
   busca (`SearchBar.jsx`) é sobrescrito pela regra `.busca-sugestoes {
   display: flex }`, então os chips continuam visíveis mesmo digitando
   algo no campo. Reportado ao usuário, não corrigido (fora do escopo do
   que foi pedido).

### Testado manualmente (Chrome automatizado, ponta a ponta)

- Divisão inteligente: valores batendo certo por participante.
- Busca por IA: resposta em português, sugestões coerentes, fallback 503
  gracioso sem `GEMINI_API_KEY`.
- Carteira: criação de PIN, PIN errado bloqueando, PIN certo destravando,
  re-trava ao fechar/reabrir, recarga de saldo, cartão salvo com bandeira
  detectada, vale-presente comprado por uma conta e resgatado por outra
  (com bloqueio de autorresgate e resgate duplicado).
- Mapa de entrega: tiles reais carregando (nomes de rua verdadeiros),
  rota e marcadores corretos.
- Pagamento: Pix Copia e Cola gerado a cada checkout; troco calculado
  batendo (pago − total) e aparecendo no resumo do `PixSheet`; fluxo
  "pagar depois" pulando o `PixSheet` e gravando `pagamento:
  "pendente-garcom"` direto, aparecendo certo no histórico.
- RH do admin: criação de função nova, cadastro de funcionário com acesso
  restrito a 2 seções, login como esse funcionário mostrando **só** essas
  2 seções no menu lateral (teste de ponta a ponta, não só leitura de
  código), bloqueio de apagar função em uso, remoção de função sem uso.

### Próximas etapas

1. **Corrigir o bug de CSS dos chips de busca** (`.busca-sugestoes`
   sobrescrevendo `hidden`) — pequeno, não bloqueia nada, mas incomoda.
2. **Sincronizar a cópia-fonte do admin** (`Adm/brasa-sal-admin.html`) —
   segue não localizada nesta máquina; todas as mudanças de RH/Garçons
   desta sessão só estão em `public/admin.html`.
3. **"Esqueci meu PIN" da Carteira** — hoje não existe recuperação; dá pra
   reaproveitar o `login()` já existente do `AppContext` pra reverificar a
   senha da conta antes de deixar redefinir o PIN.
4. **Testes automatizados** — segue valendo o ponto já registrado ontem;
   os cálculos mais sensíveis de hoje (troco, divisão inteligente,
   PBKDF2) também são bons candidatos.

---

## 2026-08-27 — Back-end MVP: pedidos + tempo real

### Resumo

Até essa sessão, o projeto era 100% front-end (React + `localStorage`,
"servidor" simulado com `setTimeout`). Hoje ele ganhou um **back-end de
verdade** pra 4 partes específicas — contas/login, pedidos, chamado de
garçom e pedido em grupo — escolhidas por serem exatamente as áreas onde a
simulação client-only tinha uma limitação real (dado inseguro, sem
sincronização entre dispositivos). O resto do app (cardápio, fidelidade,
PDV/caixa, funcionários) continua exatamente como estava, propositalmente,
pra não virar uma reescrita gigante.

**Stack decidida e implementada:** Node.js + Fastify + Prisma + PostgreSQL
(banco gratuito no Neon) + Socket.IO (tempo real) + `bcryptjs` (hash de
senha) + `@fastify/secure-session` (sessão via cookie). Justificativa de
cada escolha (o que o mercado usa hoje vs. o que fazia sentido pro prazo do
TCC) ficou registrada na conversa e no raciocínio por trás do `CLAUDE.md`.

**O que foi construído:**
- Projeto `server/` completo: schema Prisma (`User`, `Order`, `WaiterCall`,
  `GroupOrder`/`GroupParticipant`/`GroupItem`), rotas REST de auth/pedidos/
  garçom/grupo, plugins de sessão e Socket.IO, servidor único que também
  serve o front em produção.
- `src/context/AppContext.jsx` migrado: `pedidos`, `sessao`, `grupoObj` e o
  fluxo de chamado de garçom passaram a vir da API + Socket.IO em vez de
  `localStorage`. Funções de conta (`login`/`cadastro`/etc.) viraram
  assíncronas.
- `public/admin.html` migrado nas seções de Pedidos/Cozinha/Delivery/Mesas/
  PDV/Garçons/Clientes, mantendo o mesmo formato de retorno das funções
  existentes (cache em memória + patch otimista) pra não precisar reescrever
  as ~15 funções de renderização já existentes.
- `CLAUDE.md` atualizado por inteiro pra documentar a arquitetura híbrida
  nova (o que ainda é `localStorage` vs. o que agora é back-end).

**Bugs reais encontrados e corrigidos durante a implementação/teste:**
1. Socket do admin conectava antes do listener de `"connect"` ser
   registrado — `admin:entrar` nunca disparava, então o painel nunca recebia
   nada em tempo real. Corrigido pra entrar na room imediatamente se já
   estiver conectado.
2. Migrar as contas pro Postgres quebrou a aba "Clientes" e "Membros" da
   Fidelidade no admin (liam `tnm_usuarios`, que o cliente parou de
   escrever). Criada a rota `GET /api/auth/usuarios` e corrigidos os dois
   pontos de leitura.
3. (De uma sessão anterior, mesmo dia) 3 bugs de UI no cliente: `Upsell.jsx`
   e `BottomNav.jsx` liam `cart` em vez de `itensAtivos` (quebrava durante
   pedido em grupo); o rodapé do carrinho não refletia o desconto de
   cashback no total exibido.
4. (Também da sessão de bugs) escape duplo de HTML numa tabela do admin
   (`esc("Mesa " + esc(o.mesa))`), causando entidades HTML literais em vez
   do caractere pra mesas com `&`/`<`/`>`/`"` no número.

**Testado manualmente de ponta a ponta, contra o Postgres real:**
- Cadastro/login/logout e persistência de sessão via cookie.
- Pedido feito no cliente aparecendo ao vivo na Cozinha do admin.
- Admin avançando o KDS e isso refletindo ao vivo no histórico do cliente.
- Venda pelo PDV aparecendo nos boards de Cozinha **e** Delivery, sem
  duplicar ação entre os dois botões de avançar status.
- Ciclo completo de chamado de garçom: chamar → aparece ao vivo em Mesas →
  atender → prompt de avaliação aparece ao vivo no cliente → avaliar → nota
  aparece na aba Garçons.
- Reconexão: back-end reiniciado no meio da sessão (derrubando os sockets),
  e ambas as pontas (cliente e admin) reconectaram e resincronizaram
  sozinhas, sem precisar recarregar a página.
- **Pedido em grupo entre duas sessões diferentes** (o ganho principal desta
  etapa): participante entrando e item sendo adicionado aparecem ao vivo um
  pro outro, com o `participanteNome` certo.
- Regressão: fidelidade/cashback do cliente (login → compra → pontos e
  cashback creditados certos) e as telas do admin fora de escopo
  (Funcionários, Fidelidade/config/membros) continuam funcionando.

### Próximas etapas

Em ordem sugerida (não é obrigatório seguir assim, mas é a ordem que faz
mais sentido dado o que já existe):

1. **Deploy público** (recomendado como próximo passo imediato) — colocar o
   `server/` no ar (Render ou Railway, gratuito) servindo o `dist/` junto
   (já preparado em `server/src/plugins/staticFrontend.js`), usando o mesmo
   Postgres do Neon já configurado. É o que transforma "pedido em grupo
   entre dispositivos" e "acesso via QR Code" em algo demonstrável de
   verdade na banca, em vez de precisar de dois laptops na mesma rede local.
   **Ponto de atenção**: as rotas do admin (PDV/KDS/garçom) ainda não têm
   autenticação de verdade — aceitável pra uma demo controlada (mesmo nível
   de risco que já existia com `localStorage`), mas vale ter em mente antes
   de compartilhar o link publicamente.
2. **Fase 2 do back-end (opcional)** — migrar fidelidade/cashback pro
   mesmo back-end (hoje ainda é 100% `localStorage`/client-side). Só faz
   sentido se o TCC precisar demonstrar consistência de pontos entre
   dispositivos também; do contrário, o ganho é menor que o da etapa de
   hoje.
3. **Testes automatizados** — o projeto inteiro (front e back) não tem
   nenhuma suite de testes hoje. Pelo menos os cálculos mais sensíveis
   (`statusPedido`, `estimarTempoFila`, FIFO de pontos em
   `utils/fidelidade.js`, rateio de divisão de conta) seriam bons candidatos
   a testes unitários antes de mexer mais no código.
4. **Sincronizar a cópia-fonte do admin** — `CLAUDE.md` já documenta que
   `Adm/brasa-sal-admin.html` (pasta irmã fora deste projeto) precisa ser
   mantida manualmente em sincronia com `public/admin.html`; nesta sessão
   ela não foi localizada na máquina, então as correções de hoje (bug do
   escape duplo, migração pro back-end) só estão em `public/admin.html`.
   Replicar lá se/quando essa cópia for encontrada ou recriada.
5. **Autorização real nas rotas de admin** — se o plano é seguir usando o
   sistema além de uma demo de TCC, as rotas usadas só pelo painel
   administrativo (PDV, KDS, garçom, `/todos`) precisariam de autenticação
   de verdade (hoje qualquer um que descubra a URL consegue chamar).
