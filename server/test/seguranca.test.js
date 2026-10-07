// Rodar: cd server && npm test (usa o .env). Só exercita validações que respondem
// ANTES de tocar no banco, mais o login de admin — não escreve nada no Postgres.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { buildApp } from "../src/app.js";

let app;
let cookieAdmin;
before(async () => {
  app = await buildApp();
  await app.ready();
});
after(() => app.close());

const req = (method, url, payload, cookie) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

test("rotas do admin respondem 401 sem sessão de admin", async () => {
  for (const [m, u] of [
    ["GET", "/api/pedidos/todos"],
    ["GET", "/api/auth/usuarios"],
    ["GET", "/api/estoque/insumos"],
    ["GET", "/api/fornecedores"],
    ["GET", "/api/financeiro/contas-pagar"],
    ["PATCH", "/api/pedidos/PD-1/cancelar"],
    ["PATCH", "/api/garcom/chamadas/CG-1/atender"],
  ]) {
    assert.equal((await req(m, u, m === "GET" ? undefined : {})).statusCode, 401, `${m} ${u}`);
  }
});

test("login de admin: chave errada 401, certa libera as rotas", async () => {
  assert.equal((await req("POST", "/api/admin/login", { token: "errada" })).statusCode, 401);
  const ok = await req("POST", "/api/admin/login", { token: process.env.ADMIN_TOKEN });
  assert.equal(ok.statusCode, 200);
  cookieAdmin = [ok.headers["set-cookie"]].flat()[0].split(";")[0]; // valor cru (já URL-encoded)
  assert.notEqual((await req("GET", "/api/estoque/insumos", undefined, cookieAdmin)).statusCode, 401);
});

test("statusManual fora da whitelist é rejeitado (XSS armazenado)", async () => {
  const r = await req("PATCH", "/api/pedidos/PD-1/status", { statusManual: "<img src=x onerror=alert(1)>" }, cookieAdmin);
  assert.equal(r.statusCode, 400);
});

test("redefinir senha sem código válido é recusado", async () => {
  const r = await req("POST", "/api/auth/redefinir", { email: "vitima@x.com", novaSenha: "Hack1234" });
  assert.equal(r.statusCode, 400);
  assert.match(r.json().erro, /Código inválido/);
});

test("pedido com quantidade absurda é recusado antes do banco", async () => {
  const base = { total: 10, tipo: "mesa", pagamento: "pix" };
  assert.equal((await req("POST", "/api/pedidos", { ...base, itens: [{ qtd: 9999 }] })).statusCode, 400);
  assert.equal((await req("POST", "/api/pedidos", { ...base, itens: [{ qtd: 1 }], tipo: "x" })).statusCode, 400);
});

test("rate limit no login do admin (por último: esgota a cota do IP de teste)", async () => {
  let ultimo;
  for (let i = 0; i < 8; i++) ultimo = await req("POST", "/api/admin/login", { token: "errada" });
  assert.equal(ultimo.statusCode, 429);
});
