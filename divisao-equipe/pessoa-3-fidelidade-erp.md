# Pessoa 3 — Fidelidade, Carteira, Engajamento e ERP

Fatia funcional: tudo que faz o cliente **voltar** (pontos, cashback,
carteira, indicação, missão, assinatura) e a **retaguarda financeira/
estoque** do restaurante no admin (insumos, compras, contas, relatórios).
É a fatia com mais Prisma/modelagem de dados — cobre React (cliente), JS
vanilla (admin) e Fastify+Prisma (back-end) — ver `README.md` na raiz desta
pasta.

## 1. Front-end cliente (React)

Dentro de `src/components/account.jsx` (arquivo compartilhado com a
Pessoa 2 — vejam a seção "arquivos que são de todo mundo" no `README.md`):
`CarteiraSheet`, `CriarPin`, `DesbloquearPin`, `CarteiraConteudo`,
`SecaoCartoes`, `SecaoValePresente`, `ExtratoSheet`, `ExtratoLinha`,
`FidelidadeSheet`, `MissaoSemanal`, `ClubeAssinatura`, `FiltroPontos`,
`RecompensasFiltradas`, `ProximoNivel` (linhas ~536–1304 do arquivo atual
— confira com `grep -n "^export function\|^function "
src/components/account.jsx`).

Além disso, dois componentes pequenos que moram em arquivos de outras
pessoas (combine antes de editar):

- `OfertaPersonalizada`, dentro de `src/components/menu.jsx` (arquivo da
  Pessoa 1).
- O bloco "Indique um amigo" dentro de `PerfilLogado`, em
  `src/components/account.jsx` (mesmo componente da Pessoa 2 —
  `PerfilLogado` é dela, mas o trecho de indicação é seu; combinem quem
  mexe nesse componente por vez).

## 2. `src/context/AppContext.jsx` — funções e estados que são seus

⚠️ Arquivo compartilhado.

- Estados: `ofertaDispensada`, `carteiraOpen`, `carteiraDesbloqueada`,
  `fidelidadeOpen`, `extratoOpen`.
- Funções: `abrirFidelidade`, `fecharFidelidade`, `abrirExtrato`,
  `fecharExtrato`, `resgatarPontos` (⚠️ ponto de contato: chamada também
  a partir do `FidelidadeSheet`, que é seu — mas o botão que dispara fica
  no seu componente, então a dona da função é você mesmo), `saldoCashbackDisponivel`,
  `calcularDescontoCashback` (⚠️ ponto de contato: `totalComDesconto`, da
  Pessoa 1, chama essas duas — não mude a assinatura sem avisar),
  `codigoIndicacaoAtual`, `totalAmigosIndicados`, `usarCodigoIndicacao`,
  `missaoSemanalAtual`, `resgatarMissao`, `ofertaPersonalizadaAtual`,
  `aplicarOfertaPersonalizada`, `dispensarOfertaPersonalizada`,
  `assinaturaAtiva`, `assinarClube`, `cancelarAssinaturaClube`,
  `recarregarSaldoCarteira`, `abrirCarteira`, `fecharCarteira`,
  `bloquearCarteira`, `adicionarCartaoCarteira`, `removerCartaoCarteira`,
  `comprarValePresenteCarteira`, `resgatarValePresenteCarteira`.

## 3. `src/utils/utils.js` — o que é seu

- Hash de PIN da carteira (PBKDF2-SHA256 via Web Crypto API) — funções de
  criar/conferir PIN.
- Cálculo de fidelidade/cashback (níveis, lotes de pontos com validade/
  FIFO, % cashback).
- Carteira (cartões salvos, vale-presente).
- Engajamento: código de indicação (`getCodigoIndicacao`), oferta
  personalizada (`getOfertaPersonalizada`), `MISSAO_SEMANAL`.

## 4. `src/style.css` — suas seções

Clube de fidelidade + cashback · Oferta personalizada · Missão semanal ·
Carteira / clube de assinatura · Carteira (janela própria) · Indique um
amigo.

## 5. Painel administrativo — módulo ERP + Fidelidade

- `public/admin/produtos.js` — `renderInsumos`,
  `renderModalAjustarEstoque`, `renderModalEditarInsumo`,
  `renderFichaTecnica`, `carregarFichaTecnicaDetalhe`,
  `renderFichaTecnicaDetalhe`, `salvarFichaTecnica` (o resto do arquivo —
  Categorias/Pratos/Adicionais — é da Pessoa 1).
- `public/admin/compras.js` — inteiro (`renderFornecedores`,
  `renderModalEditarFornecedor`, `comprasItensFormHtml`, `renderCompras`,
  `wireComprasItensForm`).
- `public/admin/financeiro.js` — inteiro (Contas a Pagar, Contas a
  Receber, Relatórios).
- `public/admin/vendas.js` — `renderCaixas` (Histórico de Caixas; o resto
  do arquivo é da Pessoa 1).
- `public/admin/gestao.js` — `getMembrosFidelidade`, `renderFidelidade`,
  `renderModalAjusteFidelidade` (`renderClientes`/`renderFuncionarios`,
  no mesmo arquivo, são da Pessoa 2).
- `public/admin/sistema.js` — `renderFinanceiro` (folha de pagamento
  mockada; `renderConfiguracoes`, no mesmo arquivo, é da Pessoa 1).
- `public/admin/core.js` — `getInsumos` até `carregarErpCache` (insumos/
  fornecedores/compras/contas), `getCaixas` até `fecharCaixa`,
  `getConfigFidelidade` até `creditarCompraFid`.

## 6. Back-end (`server/`)

- `server/src/routes/estoque.js` — inteiro.
- `server/src/routes/compras.js` — inteiro.
- `server/src/routes/financeiro.js` — inteiro.
- `server/src/lib/estoque.js` — inteiro (`baixarEstoquePorVenda` — ⚠️
  ponto de contato: chamada de dentro de `routes/pedidos.js`, que é da
  Pessoa 1; combinem antes de mudar a assinatura).
- `server/src/plugins/prisma.js` — inteiro (singleton do `PrismaClient` —
  fica com você por ser quem mais usa modelagem de dados, mas os outros
  dois também importam esse arquivo).
- `server/prisma/schema.prisma` — `model Insumo`, `model RecipeItem`,
  `model MovimentoEstoque`, `model Fornecedor`, `model PurchaseOrder`,
  `model PurchaseItem`, `model ContaPagar`, `model ContaReceber` (⚠️
  combine com os outros dois antes de editar o arquivo — ver `README.md`).
- Em `server/src/app.js`: só a linha que registra `fastify.register` das
  suas 3 rotas.

## O que você usa mas não reescreve

- `sessao`/login (Pessoa 2) — fidelidade/cashback só existem pra quem está
  logado, mas a lógica de "quem está logado" não é sua.
- `pedidos` (Pessoa 1 grava, Pessoa 2 lista) — é o que dispara
  `creditarCompraFid`/baixa de estoque, mas o pedido em si não é seu.
