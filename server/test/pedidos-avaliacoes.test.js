// Limite de pedido pelo cadastro (ingredientes) e avaliações no banco. Cria um insumo, uma
// ficha técnica, pedidos e avaliações marcados com o sufixo do teste e apaga tudo no fim.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { buildApp } from "../src/app.js";

const sufixo = crypto.randomBytes(3).toString("hex");
const PRATO = `teste-prato-${sufixo}`;
const PRATO_LIVRE = `teste-livre-${sufixo}`; // sem ficha técnica
const MARCA = `teste-${sufixo}`;
let app;
let insumo;

const req = (method, url, payload, cookie) => app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });
const cookieDe = (res) => [res.headers["set-cookie"]].flat()[0].split(";")[0];
const pedido = (itens, extra = {}) => ({ itens, total: 10, tipo: "balcao", pagamento: "pix", observacoes: MARCA, ...extra });

before(async () => {
  app = await buildApp();
  await app.ready();
  insumo = await app.prisma.insumo.create({ data: { nome: `Pão ${MARCA}`, unidade: "un", estoqueAtual: 3 } });
  await app.prisma.recipeItem.create({ data: { itemId: PRATO, insumoId: insumo.seq, quantidade: 1 } });
});
after(async () => {
  await app.prisma.order.deleteMany({ where: { observacoes: MARCA } });
  await app.prisma.movimentoEstoque.deleteMany({ where: { insumoId: insumo.seq } });
  await app.prisma.recipeItem.deleteMany({ where: { itemId: PRATO } });
  await app.prisma.insumo.delete({ where: { seq: insumo.seq } });
  await app.prisma.avaliacao.deleteMany({ where: { itemId: { startsWith: `teste-av-${sufixo}` } } });
  await app.close();
});

test("pedido acima do estoque dos ingredientes cadastrados é recusado com 409 e mensagem clara", async () => {
  const r = await req("POST", "/api/pedidos", pedido([{ itemId: PRATO, nome: "Burger Teste", qtd: 4 }]));
  assert.equal(r.statusCode, 409);
  assert.match(r.json().erro, /Burger Teste/);
  assert.match(r.json().erro, new RegExp(`Pão ${MARCA}`));
  assert.match(r.json().erro, /disponível 3 un/);
  const salvos = await app.prisma.order.count({ where: { observacoes: MARCA } });
  assert.equal(salvos, 0, "nada é gravado quando o limite estoura");
});

test("o limite soma o mesmo ingrediente entre linhas do pedido", async () => {
  const r = await req("POST", "/api/pedidos", pedido([
    { itemId: PRATO, nome: "Burger Teste", qtd: 2 },
    { itemId: PRATO, nome: "Burger Teste", qtd: 2 },
  ]));
  assert.equal(r.statusCode, 409);
});

test("/disponibilidade confere sem gravar nada", async () => {
  const ruim = await req("POST", "/api/pedidos/disponibilidade", { itens: [{ itemId: PRATO, nome: "X", qtd: 9 }] });
  assert.equal(ruim.statusCode, 409);
  const bom = await req("POST", "/api/pedidos/disponibilidade", { itens: [{ itemId: PRATO, nome: "X", qtd: 3 }] });
  assert.deepEqual(bom.json(), { ok: true });
  const semItens = await req("POST", "/api/pedidos/disponibilidade", { itens: [] });
  assert.equal(semItens.statusCode, 400);
  assert.equal(await app.prisma.order.count({ where: { observacoes: MARCA } }), 0);
});

test("pedido dentro do limite passa e baixa o estoque; o seguinte já não cabe", async () => {
  const ok = await req("POST", "/api/pedidos", pedido([{ itemId: PRATO, nome: "Burger Teste", qtd: 3 }]));
  assert.equal(ok.statusCode, 201);
  const depois = await app.prisma.insumo.findUnique({ where: { seq: insumo.seq } });
  assert.equal(Number(depois.estoqueAtual), 0);
  const mais = await req("POST", "/api/pedidos", pedido([{ itemId: PRATO, nome: "Burger Teste", qtd: 1 }]));
  assert.equal(mais.statusCode, 409);
  assert.match(mais.json().erro, /disponível 0 un/);
});

test("sem ficha técnica / sem ingrediente cadastrado não há o que limitar", async () => {
  const r = await req("POST", "/api/pedidos", pedido([{ itemId: PRATO_LIVRE, nome: "Livre", qtd: 5 }]));
  assert.equal(r.statusCode, 201);
});

test("insumo inativo não limita o pedido", async () => {
  await app.prisma.insumo.update({ where: { seq: insumo.seq }, data: { ativo: false } });
  const r = await req("POST", "/api/pedidos", pedido([{ itemId: PRATO, nome: "Burger Teste", qtd: 2 }]));
  assert.equal(r.statusCode, 201);
});

test("avaliação: validações de entrada", async () => {
  const item = `teste-av-${sufixo}-v`;
  for (const ruim of [
    { itemId: item, estrelas: 0, comentario: "x" },
    { itemId: item, estrelas: 6, comentario: "x" },
    { itemId: item, estrelas: 5, comentario: "   " },
    { itemId: item, estrelas: 5, comentario: "x".repeat(501) },
    { itemId: item, estrelas: 5, comentario: "ok", foto: "http://evil/x.png" },
    { itemId: "", estrelas: 5, comentario: "ok" },
  ]) {
    assert.equal((await req("POST", "/api/avaliacoes", ruim)).statusCode, 400, JSON.stringify(ruim).slice(0, 60));
  }
});

test("avaliação gravada no banco aparece pra outra sessão e marca o pedido como avaliado", async () => {
  const item = `teste-av-${sufixo}-ok`;
  const feito = await req("POST", "/api/pedidos", pedido([{ itemId: PRATO_LIVRE, nome: "Livre", qtd: 1 }]));
  const cookie = cookieDe(feito);
  const idPedido = feito.json().id;

  const r = await req("POST", "/api/avaliacoes", { itemId: item, estrelas: 4, comentario: "Muito bom", pedidoId: idPedido }, cookie);
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().avaliacao.autor, "Visitante");
  assert.equal(r.json().pedidoMarcado, idPedido);

  // outra sessão (sem cookie nenhum) enxerga a avaliação
  const lista = (await req("GET", "/api/avaliacoes")).json();
  assert.equal(lista[item][0].comentario, "Muito bom");
  assert.equal(lista[item][0].estrelas, 4);

  const meus = (await req("GET", "/api/pedidos/meus", undefined, cookie)).json();
  assert.equal(meus.find((p) => p.id === idPedido).avaliado, true);
});

test("avaliar com pedidoId de OUTRA sessão não marca o pedido", async () => {
  const feito = await req("POST", "/api/pedidos", pedido([{ itemId: PRATO_LIVRE, nome: "Livre", qtd: 1 }]));
  const r = await req("POST", "/api/avaliacoes", { itemId: `teste-av-${sufixo}-x`, estrelas: 5, comentario: "oi", pedidoId: feito.json().id });
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().pedidoMarcado, null);
});
