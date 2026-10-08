<p align="center">
  <img src="public/logo-icon.png" alt="Casa do Pato" width="120">
</p>

<h1 align="center">Casa do Pato</h1>

<p align="center">
  Cardápio digital por QR Code para pedir e pagar sem sair da mesa, com painel administrativo e ERP.<br>
  Protótipo desenvolvido como Trabalho de Conclusão de Curso (TCC).
</p>

---

## Sobre o projeto

O cliente escaneia o QR Code da mesa, abre o cardápio no navegador (sem instalar aplicativo), monta o pedido, paga e acompanha o preparo em tempo real. A equipe do restaurante usa um painel administrativo para receber os pedidos na cozinha, atender chamados de garçom, vender no balcão (PDV) e controlar estoque, compras e finanças.

A experiência segue a linha de apps como iFood e Uber Eats, mas pensada para quem já está sentado à mesa. A hamburgueria fictícia **Casa do Pato** serve de cenário de demonstração.

> **Protótipo:** pagamentos, cartões, Pix e e-mails são simulados. Veja [Limitações](#limitações-conhecidas).

## Funcionalidades

### Para o cliente (app React)

- **Cardápio** com categorias, busca por texto e **busca por IA** (Gemini) que recomenda pratos e monta combinações.
- **Ficha do produto** com adicionais (grupos com mínimo e máximo), personalização "monte do seu jeito", avaliações com foto e favoritos.
- **Carrinho e checkout simulado** (Pix, cartão ou dinheiro), cupons, pedido agendado e endereços salvos.
- **Pedido em grupo:** carrinho compartilhado por código, sincronizado em tempo real entre celulares diferentes, com divisão da conta por participante.
- **Acompanhamento do pedido** em tempo real, com notificação do navegador, tempo estimado pela fila real e mapa de entrega (Leaflet + OpenStreetMap).
- **Chamar o garçom** com motivo e avaliação do atendimento.
- **Clube de fidelidade:** pontos com validade, níveis, cashback, missão semanal, indicação de amigo e assinatura "Casa do Pato+".
- **Carteira** protegida por PIN, com saldo, cartões salvos e vale-presente.
- **Reserva de mesa.**
- **Acessibilidade:** alto contraste, tamanho de fonte, redução de movimento, leitura em voz alta e legendas.

### Para a equipe (painel administrativo)

- **Operação:** PDV com abertura e fechamento de caixa, sangria e recibo; cozinha (KDS); mesas; delivery.
- **Cardápio:** pratos, categorias, adicionais globais e estoque por item.
- **ERP:** insumos, ficha técnica, fornecedores, compras, contas a pagar e a receber e relatórios (CMV estimado).
- **Gestão:** funcionários e funções com permissão por seção, clientes, fidelidade e desempenho de garçons.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | React 19, Vite 8, CSS puro (sem biblioteca de UI), Leaflet |
| Painel admin | HTML, CSS e JavaScript puros (módulos ES, sem build) |
| Back-end | Node.js, Fastify, Socket.IO |
| Banco de dados | PostgreSQL com Prisma |
| Segurança | `@fastify/secure-session`, `@fastify/rate-limit`, bcrypt |
| IA | Google Gemini (`@google/genai`) |
| Qualidade | Oxlint e testes com `node:test` |

## Arquitetura

O projeto é **híbrido**:

- **No back-end (Postgres + Socket.IO):** contas e login, pedidos, chamados de garçom, pedido em grupo, ERP e a busca por IA.
- **No navegador (`localStorage`):** cardápio editado, fidelidade, carteira, PDV e caixa, funcionários e configurações da loja.

Tudo que roda no servidor sincroniza em tempo real entre dispositivos. O resto funciona offline, simulando a latência de rede.

```
.
├── src/                  # app React (cliente)
│   ├── components/       # telas e sheets por área
│   ├── context/          # AppContext: único estado global
│   ├── data/             # catálogo-base e dados mockados
│   └── utils/            # helpers, cliente HTTP e Socket.IO
├── public/
│   ├── admin.html        # painel administrativo
│   └── admin/            # JavaScript do painel, por área
├── server/               # API Fastify + Prisma + Socket.IO
│   ├── prisma/           # schema, migrations e seed
│   ├── src/              # rotas, plugins e libs
│   └── test/             # testes de segurança
└── scripts/              # gerador do catálogo do painel
```

Uma descrição detalhada de cada arquivo, componente e decisão de projeto está no [`CLAUDE.md`](CLAUDE.md). O histórico de desenvolvimento está no [`CHANGELOG.md`](CHANGELOG.md).

## Como rodar

### Pré-requisitos

- Node.js 20.6 ou superior
- Um banco PostgreSQL (por exemplo, um projeto gratuito no [Neon](https://neon.tech))

### Instalação

```bash
git clone https://github.com/PereraDev/casa-do-pato.git
cd casa-do-pato
npm install
cd server && npm install && cd ..
```

### Configuração

Copie o arquivo de exemplo e preencha:

```bash
cp server/.env.example server/.env
```

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `SESSION_SECRET` | Chave de 32 bytes em hexadecimal para a sessão |
| `PORT` | Porta da API (padrão `4000`) |
| `GEMINI_API_KEY` | Opcional. Liga a busca por IA; sem ela, a busca usa filtro de texto |
| `RESEND_API_KEY` | Opcional. Liga o envio de e-mail (confirmação do cadastro e recuperação de senha); veja [E-mail](#e-mail) |
| `EMAIL_FROM` | Remetente dos e-mails, ex.: `Casa do Pato <nao-responda@seudominio.com.br>` |

Gere o valor de `SESSION_SECRET` com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois crie as tabelas no banco:

```bash
cd server && npm run prisma:migrate && cd ..
```

Crie o primeiro **administrador do painel** (o comando pergunta nome, e-mail de login e senha, e grava no banco com hash bcrypt):

```bash
cd server && npm run admin:criar && cd ..
```

Opcional: crie uma conta de cliente de demonstração (`demo@casadopato.com`, senha `senha123`):

```bash
cd server && npm run db:seed && cd ..
```

### Executando

```bash
npm run dev:all
```

- App do cliente: http://localhost:5173
- Painel administrativo: http://localhost:5173/admin.html
- API: http://localhost:4000

No painel, entre com o e-mail e a senha do administrador criado no passo anterior. Depois, a aba **Funcionários** permite cadastrar a equipe, criar funções e escolher quais seções cada pessoa acessa.

Sem `RESEND_API_KEY` o envio de e-mail fica desligado (modo desenvolvimento): o cadastro entra direto e o código de recuperação de senha aparece no **console do servidor** (no Render, em **Logs**).

### E-mail

Com `RESEND_API_KEY` configurada:

- **Cadastro:** o app valida o formato e o domínio do e-mail e envia um código de 6 dígitos. A conta só entra depois que o cliente digita o código, o que prova que o endereço existe e é dele. Contas antigas foram marcadas como confirmadas.
- **Recuperação de senha:** o código chega na caixa de entrada da conta.
- O código vale 15 minutos, tem 5 tentativas e só pode ser pedido de novo depois de 1 minuto.

Para criar a chave: abra uma conta gratuita em [resend.com](https://resend.com), gere uma **API Key** e cadastre-a como `RESEND_API_KEY`. **Atenção ao remetente:** sem domínio verificado, o Resend só entrega no e-mail do dono da conta (serve para testar com o seu próprio e-mail). Para enviar a qualquer cliente, verifique um domínio seu em *Domains* no Resend e use um endereço desse domínio em `EMAIL_FROM`.


### Outros comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Só o front-end |
| `npm run dev:server` | Só a API |
| `npm run build` | Gera o `dist/` |
| `npm run lint` | Roda o Oxlint |
| `npm run gerar:catalogo` | Regenera o catálogo do painel (roda sozinho em `dev` e `build`) |
| `cd server && npm test` | Testes de segurança (não escrevem no banco) |
| `cd server && npm run prisma:studio` | Interface gráfica do banco |

## Deploy no Render

O projeto precisa de um servidor Node que fique ligado (Socket.IO usa conexões persistentes), por isso **não** roda em plataformas só de funções serverless, como a Vercel. O arquivo [`render.yaml`](render.yaml) descreve um único serviço web que serve a API, o tempo real, o app e o painel.

1. Tenha um banco PostgreSQL (Neon). Use a string de conexão **direta**, a que não tem `-pooler` no endereço, porque as migrations não funcionam bem pelo pooler.
2. No [Render](https://render.com): **New**, **Blueprint**, escolha este repositório. O Render lê o `render.yaml`. Se o repositório for privado, autorize o acesso do Render ao GitHub.
3. Preencha as variáveis que o Render pedir:
   - `DATABASE_URL`: a string do passo 1.
   - `SESSION_SECRET`: 64 caracteres hexadecimais (gere com o comando de `node -e` da seção Configuração). **Use um valor novo**, diferente do seu `.env` local.
   - `GEMINI_API_KEY`: opcional.
   - `RESEND_API_KEY` e `EMAIL_FROM`: opcionais, ligam o envio de e-mail (veja [E-mail](#e-mail)).
4. Quando o deploy ficar **Live**, crie o administrador do site publicado, **no seu computador**, apontando para o banco de produção (nada é digitado no painel do Render):

   ```bash
   cd server
   DATABASE_URL="<a mesma string do passo 1>" npm run admin:criar
   ```

5. Acesse `https://<nome-do-servico>.onrender.com` e `/admin.html` e entre com essa conta.

No plano gratuito o serviço "dorme" depois de alguns minutos sem acesso, e o primeiro acesso seguinte demora cerca de 1 minuto. Abra o site antes de uma apresentação. Sem `RESEND_API_KEY`, o código de recuperação de senha aparece nos **Logs** do serviço no Render.

## Segurança

- Senhas de clientes com **bcrypt** (custo 12) e política de senha forte validada no servidor.
- Sessão em cookie cifrado e assinado (`httpOnly`, `sameSite`, `secure` em produção).
- Rotas e sala de socket do painel exigem sessão de administrador.
- **Rate limit** global e mais rígido em login, cadastro, recuperação de senha e busca por IA.
- Cadastro com confirmação de e-mail e recuperação de senha por código de uso único, com expiração e limite de envio, sem revelar se o e-mail existe.
- Validação de entrada nas rotas públicas e escape de HTML no painel.
- Segredos ficam só no `server/.env`, que nunca é versionado.

## Limitações conhecidas

Este é um protótipo acadêmico. Em especial:

- **Pagamentos simulados:** Pix, cartão e dinheiro não passam por gateway. O código "Pix copia e cola" não é um payload válido.
- **Preço do pedido vem do cliente:** o cardápio mora no front-end, então o servidor valida formato e limites, mas não recalcula o total.
- **Permissão por seção só no painel:** as contas de funcionário ficam no banco (senha com bcrypt) e a gestão da equipe exige função Administrador no servidor, mas quais seções cada pessoa vê é decidido pelo painel; no servidor, qualquer funcionário logado alcança as rotas operacionais.
- **E-mail depende de configuração:** sem `RESEND_API_KEY` não há confirmação de cadastro e o código de recuperação só aparece no log do servidor; sem domínio verificado no Resend, os e-mails só chegam ao dono da conta Resend.
- **Recibo do PDV não fiscal.**
- As imagens do cardápio são placeholders do Unsplash.

A lista completa está em [`CLAUDE.md`](CLAUDE.md), na seção "Limitações conhecidas".

## Licença

Distribuído sob a licença MIT. Veja o arquivo [`LICENSE`](LICENSE).
