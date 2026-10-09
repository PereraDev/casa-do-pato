// Pedidos contra o catálogo do servidor (preço recalculado, cupom, adicionais, estoque de prato
// e de ingrediente) e avaliações no banco. Cria 2 pratos de teste via API do admin, um insumo,
// pedidos e avaliações marcados com o sufixo do teste, e DEVOLVE o catálogo ao estado original
// no fim (restaura as 4 chaves de config e remove as linhas de estoque criadas).
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { buildApp } from "../src/app.js";
import { CHAVES_CONFIG } from "../src/lib/catalogo.js";
import { garantirFuncoesPadrao } from "../src/lib/funcoes.js";
import { hashSenha } from "../src/lib/senha.js";

const sufixo = crypto.randomBytes(3).toString("hex");
const PRATO = `teste-prato-${sufixo}`; // R$ 10,00, com ficha técnica (insumo estoque 3)
const PRATO_LIVRE = `teste-livre-${sufixo}`; // R$ 7,50, sem ficha técnica
const MARCA = `teste-${sufixo}`;
const ADMIN = `teste-admin-${sufixo}@teste.local`;
let app;
let insumo;
let cookieAdmin;
let configOriginal; // linhas de CatalogoConfig antes do teste (chave -> valor)

// Cada chamada sai de um IP "diferente" (o rate limit é por IP e os testes passam de 20 pedidos/min).
let n = 0;
const req = (method, url, payload, cookie) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {}, remoteAddress: `10.1.${Math.floor(++n / 250)}.${n % 250}` });
const cookieDe = (res) => [res.headers["set-cookie"]].flat()[0].split(";")[0];
const pedido = (itens, extra = {}) => ({ itens, total: 10, tipo: "balcao", pagamento: "pix", observacoes: MARCA, ...extra });
const item = (itemId, qtd, extra = {}) => ({ itemId, nome: itemId, qtd, ...extra });
const faz = (body, cookie) => req("POST", "/api/pedidos", body, cookie);

before(async () => {
  app = await buildApp();
  await app.ready();
  await garantirFuncoesPadrao(app.prisma);
  await app.prisma.funcionario.create({
    data: { nome: "Teste Admin", usuario: ADMIN, senhaHash: await hashSenha("Senha1234"), funcao: "admin" },
  });
  cookieAdmin = cookieDe(await req("POST", "/api/admin/login", { usuario: ADMIN, senha: "Senha1234" }));

  const linhas = await app.prisma.catalogoConfig.findMany();
  configOriginal = Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
  const extrasAtuais = configOriginal.menu_extra || [];
  const r = await req("PUT", "/api/catalogo/config/menu_extra", {
    valor: [
      ...extrasAtuais,
      { id: PRATO, cat: "bebidas", name: `Prato ${MARCA}`, price: 10, desc: "teste" },
      { id: PRATO_LIVRE, cat: "bebidas", name: `Livre ${MARCA}`, price: 7.5, desc: "teste" },
    ],
  }, cookieAdmin);
  assert.equal(r.statusCode, 200);

  insumo = await app.prisma.insumo.create({ data: { nome: `Pão ${MARCA}`, unidade: "un", estoqueAtual: 3 } });
  await app.prisma.recipeItem.create({ data: { itemId: PRATO, insumoId: insumo.seq, quantidade: 1 } });
});
after(async () => {
  await app.prisma.order.deleteMany({ where: { observacoes: MARCA } });
  await app.prisma.movimentoEstoque.deleteMany({ where: { insumoId: insumo.seq } });
  await app.prisma.recipeItem.deleteMany({ where: { itemId: PRATO, insumoId: insumo.seq } });
  await app.prisma.insumo.delete({ where: { seq: insumo.seq } });
  await app.prisma.estoquePrato.deleteMany({ where: { itemId: { in: [PRATO, PRATO_LIVRE] } } });
  // devolve o catálogo ao que era: chaves que existiam voltam ao valor antigo, as criadas pelo teste somem
  for (const chave of CHAVES_CONFIG) {
    if (chave in configOriginal) {
      await app.prisma.catalogoConfig.update({ where: { chave }, data: { valor: configOriginal[chave] } });
    } else {
      await app.prisma.catalogoConfig.deleteMany({ where: { chave } });
    }
  }
  await app.prisma.avaliacao.deleteMany({ where: { itemId: { startsWith: `teste-av-${sufixo}` } } });
  await app.prisma.funcionario.deleteMany({ where: { usuario: ADMIN } });
  await app.close();
});

/* ---------------- ingredientes cadastrados (ficha técnica) ---------------- */

test("pedido acima do estoque dos ingredientes cadastrados é recusado com 409 e mensagem clara", async () => {
  const r = await faz(pedido([item(PRATO, 4)], { total: 40 }));
  assert.equal(r.statusCode, 409);
  assert.match(r.json().erro, new RegExp(`Prato ${MARCA}`));
  assert.match(r.json().erro, new RegExp(`Pão ${MARCA}`));
  assert.match(r.json().erro, /disponível 3 un/);
  assert.equal(await app.prisma.order.count({ where: { observacoes: MARCA } }), 0, "nada é gravado");
});

test("o limite soma o mesmo ingrediente entre linhas do pedido", async () => {
  const r = await faz(pedido([item(PRATO, 2), item(PRATO, 2)], { total: 40 }));
  assert.equal(r.statusCode, 409);
});

test("/disponibilidade confere sem gravar nada", async () => {
  const ruim = await req("POST", "/api/pedidos/disponibilidade", { itens: [item(PRATO, 9)] });
  assert.equal(ruim.statusCode, 409);
  const bom = await req("POST", "/api/pedidos/disponibilidade", { itens: [item(PRATO, 3)] });
  assert.deepEqual(bom.json(), { ok: true });
  assert.equal((await req("POST", "/api/pedidos/disponibilidade", { itens: [] })).statusCode, 400);
  assert.equal(await app.prisma.order.count({ where: { observacoes: MARCA } }), 0);
});

test("pedido dentro do limite passa e baixa o estoque do ingrediente; o seguinte já não cabe", async () => {
  const ok = await faz(pedido([item(PRATO, 3)], { total: 30 }));
  assert.equal(ok.statusCode, 201);
  assert.equal(Number((await app.prisma.insumo.findUnique({ where: { seq: insumo.seq } })).estoqueAtual), 0);
  const mais = await faz(pedido([item(PRATO, 1)], { total: 10 }));
  assert.equal(mais.statusCode, 409);
  assert.match(mais.json().erro, /disponível 0 un/);
});

test("prato sem ficha técnica não tem o que limitar", async () => {
  assert.equal((await faz(pedido([item(PRATO_LIVRE, 5)], { total: 37.5 }))).statusCode, 201);
});

test("insumo inativo não limita o pedido", async () => {
  await app.prisma.insumo.update({ where: { seq: insumo.seq }, data: { ativo: false } });
  assert.equal((await faz(pedido([item(PRATO, 2)], { total: 20 }))).statusCode, 201);
});

/* ---------------- preço recalculado no servidor ---------------- */

test("total adulterado é recusado; o total certo passa", async () => {
  const barato = await faz(pedido([item("bb03", 1)], { total: 0.01 }));
  assert.equal(barato.statusCode, 400);
  assert.match(barato.json().erro, /não confere/);
  assert.equal((await faz(pedido([item("bb03", 2)], { total: 10 }))).statusCode, 201); // bb03 = R$ 5,00
});

test("o servidor grava os preços DELE, não o subtotal que o cliente mandou", async () => {
  const r = await faz(pedido([{ ...item("bb03", 2), subtotal: 0.01 }], { total: 10 }));
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().itens[0].subtotal, 10);
  assert.equal(r.json().itens[0].nome, "Água com Gás");
});

test("promoção vale (pt01: de 30 por 24) e pagar acima do preço também é recusado", async () => {
  assert.equal((await faz(pedido([item("pt01", 1)], { total: 24 }))).statusCode, 201);
  assert.equal((await faz(pedido([item("pt01", 1)], { total: 30 }))).statusCode, 400);
});

test("adicionais: preço vem do catálogo do servidor; adicional desconhecido é recusado", async () => {
  const bacon = { nome: "Bacon", qtd: 1, preco: 0 }; // cliente "informa" preço 0
  assert.equal((await faz(pedido([item("tr01", 1, { addons: [bacon] })], { total: 22 }))).statusCode, 400);
  assert.equal((await faz(pedido([item("tr01", 1, { addons: [bacon] })], { total: 30 }))).statusCode, 201); // 22 + 8
  const ouro = await faz(pedido([item("tr01", 1, { addons: [{ nome: "Ouro", qtd: 1, preco: 0 }] })], { total: 22 }));
  assert.equal(ouro.statusCode, 400);
  const negativo = await faz(pedido([item("tr01", 1, { addons: [{ nome: "Bacon", qtd: -3, preco: 8 }] })], { total: 0 }));
  assert.equal(negativo.statusCode, 400);
});

test("cupom: conferido no servidor (TCC10 = 10%); cupom falso e desconto maior que o do cupom são recusados", async () => {
  assert.equal((await faz(pedido([item("bb03", 2)], { total: 9, cupom: "TCC10" }))).statusCode, 201);
  assert.equal((await faz(pedido([item("bb03", 2)], { total: 8, cupom: "TCC10" }))).statusCode, 400);
  const falso = await faz(pedido([item("bb03", 2)], { total: 1, cupom: "FALSO99" }));
  assert.equal(falso.statusCode, 400);
  assert.match(falso.json().erro, /Cupom inválido/);
  assert.equal((await faz(pedido([item("bb03", 2)], { total: 1, cupom: "TCC10" }))).statusCode, 400);
});

test("cashback sem conta logada é recusado", async () => {
  const r = await faz(pedido([item("bb03", 2)], { total: 0, cashbackUsado: 10 }));
  assert.equal(r.statusCode, 400);
});

test("item que não está no cardápio (ou foi removido) é recusado com 409", async () => {
  const r = await faz(pedido([item("fantasma", 1)], { total: 5 }));
  assert.equal(r.statusCode, 409);
  assert.match(r.json().erro, /não está mais disponível/);
});

/* ---------------- edições do admin no banco ---------------- */

test("rotas de escrita do catálogo exigem sessão de funcionário", async () => {
  assert.equal((await req("PUT", "/api/catalogo/config/menu_extra", { valor: [] })).statusCode, 401);
  assert.equal((await req("PUT", "/api/catalogo/estoque/bb01", { quantidade: 1 })).statusCode, 401);
  assert.equal((await req("GET", "/api/catalogo/config")).statusCode, 401);
});

test("configuração inválida é recusada sem gravar", async () => {
  for (const [chave, valor] of [
    ["menu_extra", [{ id: "x", cat: "bebidas", name: "Ruim", price: -5 }]],
    ["menu_extra", "texto"],
    ["menu_overrides", { bb03: { price: "grátis" } }],
    ["categorias", { extras: [{ id: 1 }] }],
    ["addon_groups", { extras: [{ id: "g", nome: "G", min: 0, max: 1, itens: [{ id: "a", nome: "A", preco: -1 }] }] }],
  ]) {
    assert.equal((await req("PUT", `/api/catalogo/config/${chave}`, { valor }, cookieAdmin)).statusCode, 400, chave);
  }
  assert.equal((await req("PUT", "/api/catalogo/config/outra_coisa", { valor: {} }, cookieAdmin)).statusCode, 404);
});

test("prato criado no admin aparece no cardápio de qualquer dispositivo com o preço certo", async () => {
  const menu = (await req("GET", "/api/catalogo")).json().menu;
  const p = menu.find((m) => m.id === PRATO_LIVRE);
  assert.equal(p.preco, 7.5);
  assert.equal(p.nome, `Livre ${MARCA}`);
});

test("preço editado no admin vale no pedido e descarta a promoção do prato base", async () => {
  const antes = (await req("GET", "/api/catalogo/config", undefined, cookieAdmin)).json().menu_overrides;
  await req("PUT", "/api/catalogo/config/menu_overrides", { valor: { ...antes, pt01: { price: 20 } } }, cookieAdmin);
  assert.equal((await faz(pedido([item("pt01", 1)], { total: 24 }))).statusCode, 400);
  assert.equal((await faz(pedido([item("pt01", 1)], { total: 20 }))).statusCode, 201);
});

test("estoque por prato: 'só restam N', baixa atômica no pedido e some do cardápio ao zerar", async () => {
  const put = await req("PUT", `/api/catalogo/estoque/${PRATO_LIVRE}`, { quantidade: 2 }, cookieAdmin);
  assert.equal(put.statusCode, 200);
  const muito = await faz(pedido([item(PRATO_LIVRE, 3)], { total: 22.5 }));
  assert.equal(muito.statusCode, 409);
  assert.match(muito.json().erro, /Só restam 2/);
  assert.equal((await faz(pedido([item(PRATO_LIVRE, 2)], { total: 15 }))).statusCode, 201);
  assert.equal((await app.prisma.estoquePrato.findUnique({ where: { itemId: PRATO_LIVRE } })).quantidade, 0);
  assert.equal((await req("GET", "/api/catalogo")).json().menu.some((m) => m.id === PRATO_LIVRE), false);
  assert.equal((await faz(pedido([item(PRATO_LIVRE, 1)], { total: 7.5 }))).statusCode, 409);
  // sem controle (null) o prato volta
  await req("PUT", `/api/catalogo/estoque/${PRATO_LIVRE}`, { quantidade: null }, cookieAdmin);
  assert.equal((await faz(pedido([item(PRATO_LIVRE, 1)], { total: 7.5 }))).statusCode, 201);
});

test("2 pedidos ao mesmo tempo no último item: só 1 passa", async () => {
  await req("PUT", `/api/catalogo/estoque/${PRATO_LIVRE}`, { quantidade: 1 }, cookieAdmin);
  const [a, b] = await Promise.all([
    faz(pedido([item(PRATO_LIVRE, 1)], { total: 7.5 })),
    faz(pedido([item(PRATO_LIVRE, 1)], { total: 7.5 })),
  ]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [201, 409]);
});

test("PDV: preços conferidos também, com taxa de entrega somada", async () => {
  const pdv = (body) => req("POST", "/api/pedidos/pdv", pedido([item("bb03", 1)], body), cookieAdmin);
  assert.equal((await pdv({ total: 5 })).statusCode, 201);
  assert.equal((await pdv({ total: 11, tipo: "entrega", taxaEntrega: 6 })).statusCode, 201);
  assert.equal((await pdv({ total: 5, tipo: "entrega", taxaEntrega: 6 })).statusCode, 400); // sumiu a taxa
  assert.equal((await pdv({ total: 0.5 })).statusCode, 400);
  assert.equal((await req("POST", "/api/pedidos/pdv", pedido([item("bb03", 1)]))).statusCode, 401);
});

/* ---------------- avaliações ---------------- */

test("avaliação: validações de entrada", async () => {
  const item1 = `teste-av-${sufixo}-v`;
  for (const ruim of [
    { itemId: item1, estrelas: 0, comentario: "x" },
    { itemId: item1, estrelas: 6, comentario: "x" },
    { itemId: item1, estrelas: 5, comentario: "   " },
    { itemId: item1, estrelas: 5, comentario: "x".repeat(501) },
    { itemId: item1, estrelas: 5, comentario: "ok", foto: "http://evil/x.png" },
    { itemId: "", estrelas: 5, comentario: "ok" },
  ]) {
    assert.equal((await req("POST", "/api/avaliacoes", ruim)).statusCode, 400, JSON.stringify(ruim).slice(0, 60));
  }
});

test("avaliação gravada no banco aparece pra outra sessão e marca o pedido como avaliado", async () => {
  const alvo = `teste-av-${sufixo}-ok`;
  const feito = await faz(pedido([item("bb03", 1)], { total: 5 }));
  const cookie = cookieDe(feito);
  const idPedido = feito.json().id;

  const r = await req("POST", "/api/avaliacoes", { itemId: alvo, estrelas: 4, comentario: "Muito bom", pedidoId: idPedido }, cookie);
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().avaliacao.autor, "Visitante");
  assert.equal(r.json().pedidoMarcado, idPedido);

  const lista = (await req("GET", "/api/avaliacoes")).json();
  assert.equal(lista[alvo][0].comentario, "Muito bom");
  assert.equal(lista[alvo][0].estrelas, 4);

  const meus = (await req("GET", "/api/pedidos/meus", undefined, cookie)).json();
  assert.equal(meus.find((p) => p.id === idPedido).avaliado, true);
});

test("avaliar com pedidoId de OUTRA sessão não marca o pedido", async () => {
  const feito = await faz(pedido([item("bb03", 1)], { total: 5 }));
  const r = await req("POST", "/api/avaliacoes", { itemId: `teste-av-${sufixo}-x`, estrelas: 5, comentario: "oi", pedidoId: feito.json().id });
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().pedidoMarcado, null);
});
