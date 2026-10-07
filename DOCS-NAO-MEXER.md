# Arquivos e pastas que não precisam (e não devem) ser mexidos

Este projeto tem dois `package.json` (raiz = front React, `server/` =
back-end Node) — cada um gera sua própria árvore de dependências e
arquivos de controle. Nenhum item desta lista é escrito à mão: todos são
gerados por uma ferramenta (`npm install`, `npm run build`, `prisma
migrate`) e regravados automaticamente sempre que essa ferramenta roda de
novo. Editar qualquer um manualmente não "gruda" — na próxima vez que a
ferramenta rodar, sua edição é sobrescrita ou ignorada.

Ver `CLAUDE.md` pra documentação do código que **de fato** é o projeto.

---

## `node_modules/` (raiz **e** `server/node_modules/`)

**O que é**: cópia local de todo pacote de terceiro listado em
`dependencies`/`devDependencies` dos dois `package.json`, baixada pelo
`npm install`. Existem **duas** pastas separadas porque são dois projetos
Node independentes (front na raiz, back-end em `server/`).

**Por que não mexer**: é reconstruída do zero a qualquer momento
(`rm -rf node_modules && npm install` recria idêntica, a partir de
`package.json`/`package-lock.json`). Nunca é enviada pro Git (está no
`.gitignore` da raiz). Editar um arquivo aqui dentro "resolve" um bug na
hora, mas some no próximo `npm install` de qualquer colega/CI — se um
pacote de terceiro tem um problema de verdade, a correção é trocar de
versão no `package.json` ou reportar ao mantenedor do pacote, nunca editar
a cópia local.

**Principais pacotes que moram aqui** (pra referência, não pra editar):

| Pacote | Onde | Papel |
|---|---|---|
| `react`, `react-dom` | raiz | biblioteca de UI do app cliente |
| `vite`, `@vitejs/plugin-react` | raiz | dev server + build |
| `socket.io-client` | raiz | cliente Socket.IO (ver `src/utils/utils.js#socket`) |
| `leaflet` | raiz | mapa de entrega real (ver `orders.jsx#MapaEntrega`) |
| `oxlint` | raiz | linter (`npm run lint`) |
| `concurrently` | raiz | roda front + back juntos (`npm run dev:all`) |
| `fastify` | `server/` | servidor HTTP |
| `@fastify/secure-session` | `server/` | sessão via cookie assinado/cifrado |
| `@fastify/static` | `server/` | serve o `dist/` em produção |
| `fastify-plugin` | `server/` | wrapper `fp()` dos plugins (`server/src/plugins/*.js`) |
| `@prisma/client` + `prisma` | `server/` | ORM + CLI de migrations |
| `socket.io` | `server/` | tempo real (pedidos, garçom, grupo) |
| `bcryptjs` | `server/` | hash de senha de conta de cliente |
| `@google/genai` | `server/` | SDK do Gemini (busca por IA) |

## `package-lock.json` (raiz **e** `server/package-lock.json`)

**O que é**: trava a árvore de dependências inteira (toda versão exata de
todo pacote, incluindo dependências transitivas) — garante que
`npm install` instale exatamente as mesmas versões em qualquer máquina.

**Por que não mexer**: é reescrito automaticamente pelo `npm` toda vez que
`package.json` muda (nova dependência, mudança de versão) ou que
`npm install` roda. Editar à mão facilmente deixa o arquivo inconsistente
com `package.json` — a forma certa de adicionar/atualizar uma dependência
é `npm install <pacote>`/`npm update <pacote>`, nunca editar o lock
direto.

## `dist/` (raiz)

**O que é**: build de produção do front, gerado por `npm run build`
(Vite) — HTML/CSS/JS minificados e com hash no nome do arquivo, mais uma
cópia de `public/` (incluindo `admin.html` e `public/admin/*.js`) copiada
pra dentro. É o que `server/src/plugins/staticFrontend.js` serve quando
`NODE_ENV=production`.

**Por que não mexer**: qualquer edição manual aqui é sobrescrita no
próximo `npm run build`, e o conteúdo é 100% derivado de `src/`,
`public/` e `index.html` — mudar algo aqui sem mudar a fonte é enganar a
si mesmo (a mudança nunca sobrevive a um novo build). Editar código de
verdade sempre na fonte (`src/`, `public/`), nunca em `dist/`.

## `server/prisma/migrations/`

**O que é**: histórico de migrations do banco — uma pasta por migration
aplicada, cada uma com um `migration.sql` gerado automaticamente por
`prisma migrate dev` a partir da diferença entre `schema.prisma` e o
estado atual do banco.

**Por que não mexer**: cada arquivo `.sql` tem um checksum registrado pelo
Prisma (tabela `_prisma_migrations` no próprio banco) — editar o `.sql`
de uma migration já aplicada faz o Prisma detectar o histórico como
corrompido na próxima vez que alguém rodar `prisma migrate dev`/`deploy`.
Pra mudar o schema, a forma certa é sempre editar `server/prisma/
schema.prisma` e rodar `npm run prisma:migrate` de novo (dentro de
`server/`) — isso **gera** uma migration nova sozinho, nunca editar uma
existente.

## `server/.env` (não versionado)

**O que é**: variáveis de ambiente locais do back-end —
`DATABASE_URL` (string de conexão do Postgres) e `SESSION_SECRET` (chave
de 32 bytes em hex usada pelo cookie de sessão), mais opcionalmente
`GEMINI_API_KEY`. Copiado uma vez de `server/.env.example` na primeira
configuração do projeto (ver `CLAUDE.md`, "Como rodar").

**Por que não versionar/não expor**: contém segredos reais (senha do
banco, chave de sessão) — está no `.gitignore` de propósito. Ainda é um
arquivo "seu" (não gerado por ferramenta), então pode e deve ser editado
localmente quando precisar trocar de banco ou girar a chave — só nunca
deve ir pro Git nem ser colado em chat/log. `server/.env.example` (esse
sim versionado) é o único que deve ser editado quando uma variável nova
precisa ser documentada pro time.

---

## Resumindo: o teste rápido

Antes de editar um arquivo, pergunte: **"se eu rodar `npm install` (ou
`npm run build`, ou `prisma migrate dev`) de novo agora, minha edição
sobrevive?"**

- **Não sobrevive** → é gerado, não mexe (`node_modules/`,
  `package-lock.json`, `dist/`, `server/prisma/migrations/*/migration.sql`
  já existentes).
- **Sobrevive porque é a fonte, não o gerado** → pode mexer (`src/`,
  `public/`, `server/src/`, `server/prisma/schema.prisma`, os dois
  `package.json`, `index.html`, `vite.config.js`, `server/.env.example`).
