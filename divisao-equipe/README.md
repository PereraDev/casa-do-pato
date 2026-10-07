# Divisão do projeto entre os 3 integrantes

Objetivo: dividir o Casa do Pato em **3 fatias verticais** — não "um pega só o
front, outro só o back" — pra que **cada pessoa mexa em HTML/CSS, React,
JavaScript vanilla (painel admin) e back-end (Fastify/Prisma) dentro da sua
própria fatia**. Cada arquivo desta pasta é o roteiro de reescrita de uma
pessoa, com nome de arquivo/componente/função exatos (conferidos direto no
código atual), pra não sobrar dúvida de "o que é meu".

- [`pessoa-1-cardapio-vendas.md`](./pessoa-1-cardapio-vendas.md) — Cardápio,
  Carrinho, Checkout e Vendas (cliente QR Code + PDV do admin)
- [`pessoa-2-conta-tempo-real.md`](./pessoa-2-conta-tempo-real.md) — Conta/
  login, chamado de garçom, pedido em grupo, mesas e acompanhamento do
  pedido em tempo real
- [`pessoa-3-fidelidade-erp.md`](./pessoa-3-fidelidade-erp.md) — Fidelidade,
  carteira, engajamento do cliente e o módulo ERP (estoque/compras/
  financeiro) do admin

Os nomes "Pessoa 1/2/3" são só rótulos — troquem entre vocês (você, Cauã,
Yuri) como quiserem, a divisão de arquivos não muda.

## Por que ficou assim (e não "um front, um admin, um back")

O app já é meio "híbrido" por natureza (ver `CLAUDE.md`): a maior parte é
100% front-end + `localStorage`, e só 4 fatias (+ a busca por IA, + o ERP)
têm back-end de verdade. Se a divisão fosse por camada (uma pessoa só React,
uma só admin.html, uma só server), duas pessoas mal encostariam no Node/
Postgres, e quem pegasse o admin não veria React nenhum. Por isso a divisão
aqui é **por funcionalidade de ponta a ponta**: cada pilar carrega um pedaço
de tela do cliente (React), o pedaço correspondente do painel admin
(`public/admin.html` + `public/admin/*.js`, vanilla JS) e, quando existe, a
rota de back-end (`server/`) que sustenta aquilo — assim as 3 pessoas
passam pelas 3 camadas.

## Tamanho aproximado de cada fatia

Contagem de linhas (código atual, sem contar `node_modules`/`dist`). É uma
aproximação — arquivos compartilhados (ver abaixo) foram divididos por
seção/função, não linha a linha:

| Fatia | Cliente (React) | Painel Admin | Back-end (server/) | Total aprox. |
|---|---|---|---|---|
| Pessoa 1 — Cardápio/Vendas | ~2.450 | ~1.620 | ~500 | **~4.600** |
| Pessoa 2 — Conta/Tempo real | ~2.640 | ~1.670 | ~520 | **~4.800** |
| Pessoa 3 — Fidelidade/ERP | ~2.320 | ~1.200 | ~660 | **~4.200** |

(A soma não bate 100% com o total do repositório porque `style.css`,
`utils.js` e `AppContext.jsx` foram repartidos por trecho nomeado, não por
contagem exaustiva de linha — ver seção seguinte.)

## Os 3 arquivos que são de todo mundo (e como dividir sem pisar no pé do outro)

Por causa da arquitetura do projeto (ver `CLAUDE.md`: "Sem gerenciador de
estado externo — um único Context concentra todo o estado", "utils.js —
TODOS os helpers/hooks client-side num arquivo só"), **três arquivos não têm
como ser cortados em 3 arquivos separados sem quebrar o app**:

- `src/context/AppContext.jsx` (estado global do React)
- `src/utils/utils.js` (helpers do cliente)
- `src/style.css` (todo o CSS)
- e, do lado do admin, `public/admin/core.js` (o equivalente do
  `AppContext` do painel) e `server/prisma/schema.prisma` (schema do banco)

Cada documento de pessoa lista **exatamente quais funções/estados/seções
CSS** são dela dentro desses arquivos (com nome, não "grosso modo"). Regras
pra não conflitar:

1. Cada um só edita as funções/estados/seções listadas no seu documento
   dentro desses arquivos compartilhados — o resto é só leitura/uso.
2. Peguem o arquivo compartilhado sempre atualizado antes de mexer (`git
   pull`) e commitem em pedaços pequenos — como cada um mexe numa região
   diferente do arquivo, os merges do Git resolvem sozinhos na maioria das
   vezes.
3. Se duas pessoas precisarem tocar a mesma função (ex.: `finalizarPedido`
   chama tanto lógica da Pessoa 1 quanto da Pessoa 2), combinem antes quem
   mexe — está marcado como "⚠️ ponto de contato" nos documentos.
4. `server/src/app.js` e `server/prisma/schema.prisma` também são
   compartilhados: cada um só adiciona a própria linha de
   `fastify.register(suaRota)` / o próprio `model` no schema, sem editar a
   parte dos outros.

## Ordem sugerida pra reescrever sem travar o time

Reescrever "de fora pra dentro" evita ficar esperando o back-end do colega:

1. **Schema Prisma** — os 3 sentam juntos uma vez só e definem/confirmam os
   `model`s de cada um em `server/prisma/schema.prisma` (rodar `prisma
   migrate` 1x depois disso).
2. Cada um reescreve **suas rotas de back-end** (`server/src/routes/*.js`)
   de forma independente — dá pra testar com `curl`/Postman sem precisar do
   front pronto.
3. Cada um reescreve **seus componentes React** consumindo as próprias
   rotas (ou os `setTimeout`/`localStorage` simulados, nas partes que não
   têm back-end mesmo).
4. Por último, cada um mexe na **sua parte do painel admin**, que também já
   pode testar contra as rotas do passo 2.

## O que NÃO faz parte de nenhuma fatia (não precisa reescrever)

- `vite.config.js`, `package.json` (raiz e `server/`), configs de lint —
  configuração de projeto, mexam só se algo quebrar.
- `server/src/server.js`, `server/src/plugins/prisma.js`,
  `server/src/plugins/staticFrontend.js` — bootstrap/infra, ficam com a
  Pessoa 2 (ver documento dela) mas não precisam ser "reescritos", só
  entendidos.
- Documentação (`CLAUDE.md`, `CHANGELOG.md`, `README.md`) —
  não reescrever, só manter atualizada se mudar algo relevante.
