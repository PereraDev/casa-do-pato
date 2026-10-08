// Rodar: cd server && npm test (usa o .env). Cria funcionários temporários
// (usuario "teste-...@teste.local") e apaga todos no fim — não mexe em mais nada
// do banco. Valida: rotas do admin fechadas, login por conta, permissões da
// equipe, validações de entrada e rate limit.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { buildApp } from "../src/app.js";
import { garantirFuncoesPadrao } from "../src/lib/funcoes.js";
import { hashSenha } from "../src/lib/senha.js";

const SENHA = "Senha1234";
const sufixo = crypto.randomBytes(3).toString("hex");
const usuarios = {
  admin: `teste-admin-${sufixo}@teste.local`,
  garcom: `teste-garcom-${sufixo}@teste.local`,
  novo: `teste-novo-${sufixo}@teste.local`,
  temp: `teste-temp-${sufixo}@teste.local`,
};
let app;
let cookieAdmin;
let cookieGarcom;

const req = (method, url, payload, cookie) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });
// valor cru do Set-Cookie (já URL-encoded) — o inject decodifica `cookies[]`
const cookieDe = (res) => [res.headers["set-cookie"]].flat()[0].split(";")[0];
const login = (usuario, senha = SENHA) => req("POST", "/api/admin/login", { usuario, senha });

before(async () => {
  app = await buildApp();
  await app.ready();
  await garantirFuncoesPadrao(app.prisma);
  const senhaHash = await hashSenha(SENHA);
  await app.prisma.funcionario.createMany({
    data: [
      { nome: "Teste Admin", usuario: usuarios.admin, senhaHash, funcao: "admin" },
      { nome: "Teste Garçom", usuario: usuarios.garcom, senhaHash, funcao: "garcom" },
    ],
  });
  cookieAdmin = cookieDe(await login(usuarios.admin));
  cookieGarcom = cookieDe(await login(usuarios.garcom));
});
after(async () => {
  await app.prisma.funcionario.deleteMany({ where: { usuario: { endsWith: `-${sufixo}@teste.local` } } });
  await app.prisma.funcao.deleteMany({ where: { id: { startsWith: "fn-funcao-de-teste-" } } });
  await app.close();
});

test("rotas do admin respondem 401 sem sessão", async () => {
  for (const [m, u] of [
    ["GET", "/api/pedidos/todos"],
    ["GET", "/api/auth/usuarios"],
    ["GET", "/api/estoque/insumos"],
    ["GET", "/api/fornecedores"],
    ["GET", "/api/financeiro/contas-pagar"],
    ["GET", "/api/admin/funcionarios"],
    ["GET", "/api/admin/funcoes"],
    ["PATCH", "/api/pedidos/PD-1/cancelar"],
    ["PATCH", "/api/garcom/chamadas/CG-1/atender"],
  ]) {
    assert.equal((await req(m, u, m === "GET" ? undefined : {})).statusCode, 401, `${m} ${u}`);
  }
});

test("login: senha errada e usuário inexistente dão a mesma resposta; certo libera as rotas", async () => {
  const errada = await login(usuarios.admin, "SenhaErrada1");
  const inexistente = await login(`ninguem-${sufixo}@teste.local`);
  assert.equal(errada.statusCode, 401);
  assert.equal(inexistente.statusCode, 401);
  assert.deepEqual(errada.json(), inexistente.json());
  assert.notEqual((await req("GET", "/api/estoque/insumos", undefined, cookieAdmin)).statusCode, 401);
});

test("funcionário comum lê funções, mas não gere equipe (403)", async () => {
  assert.equal((await req("GET", "/api/admin/funcoes", undefined, cookieGarcom)).statusCode, 200);
  assert.equal((await req("GET", "/api/admin/funcionarios", undefined, cookieGarcom)).statusCode, 403);
  const criar = await req("POST", "/api/admin/funcionarios", { nome: "X", usuario: usuarios.novo, senha: SENHA, funcao: "pdv" }, cookieGarcom);
  assert.equal(criar.statusCode, 403);
});

test("admin gere funcionários: lista sem senhaHash, valida, bloqueia duplicado e senha fraca", async () => {
  const lista = await req("GET", "/api/admin/funcionarios", undefined, cookieAdmin);
  assert.equal(lista.statusCode, 200);
  assert.ok(lista.json().some((f) => f.usuario === usuarios.admin));
  assert.ok(lista.json().every((f) => !("senhaHash" in f) && !("senha" in f)));

  const base = { nome: "Novo", usuario: usuarios.novo, senha: SENHA, funcao: "pdv", secoesPermitidas: ["pdv"] };
  assert.equal((await req("POST", "/api/admin/funcionarios", { ...base, senha: "123" }, cookieAdmin)).statusCode, 400);
  assert.equal((await req("POST", "/api/admin/funcionarios", { ...base, funcao: "inexistente" }, cookieAdmin)).statusCode, 400);
  const ok = await req("POST", "/api/admin/funcionarios", base, cookieAdmin);
  assert.equal(ok.statusCode, 201);
  assert.equal((await req("POST", "/api/admin/funcionarios", base, cookieAdmin)).statusCode, 409);

  const id = ok.json().id;
  const edit = await req("PATCH", `/api/admin/funcionarios/${id}`, { ...base, funcao: "garcom", secoesPermitidas: null }, cookieAdmin);
  assert.equal(edit.statusCode, 200);
  assert.equal(edit.json().funcao, "garcom");
  assert.equal(edit.json().secoesPermitidas, null);
  assert.equal((await req("DELETE", `/api/admin/funcionarios/${id}`, undefined, cookieAdmin)).statusCode, 200);
});

test("funções: criar, não apagar em uso nem a Administrador", async () => {
  assert.equal((await req("DELETE", "/api/admin/funcoes/admin", undefined, cookieAdmin)).statusCode, 409);
  const fn = await req("POST", "/api/admin/funcoes", { label: `Função de teste ${sufixo}` }, cookieAdmin);
  assert.equal(fn.statusCode, 201);
  const funcaoId = fn.json().id;
  const func = await req("POST", "/api/admin/funcionarios", { nome: "Em uso", usuario: usuarios.novo, senha: SENHA, funcao: funcaoId }, cookieAdmin);
  assert.equal((await req("DELETE", `/api/admin/funcoes/${funcaoId}`, undefined, cookieAdmin)).statusCode, 409);
  await req("DELETE", `/api/admin/funcionarios/${func.json().id}`, undefined, cookieAdmin);
  assert.equal((await req("DELETE", `/api/admin/funcoes/${funcaoId}`, undefined, cookieAdmin)).statusCode, 200);
});

test("apagar a conta derruba o acesso na hora", async () => {
  const criado = await req("POST", "/api/admin/funcionarios", { nome: "Temp", usuario: usuarios.temp, senha: SENHA, funcao: "pdv" }, cookieAdmin);
  const cookieTemp = cookieDe(await login(usuarios.temp));
  assert.notEqual((await req("GET", "/api/estoque/insumos", undefined, cookieTemp)).statusCode, 401);
  await req("DELETE", `/api/admin/funcionarios/${criado.json().id}`, undefined, cookieAdmin);
  assert.equal((await req("GET", "/api/estoque/insumos", undefined, cookieTemp)).statusCode, 401);
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
  for (let i = 0; i < 8; i++) ultimo = await login(usuarios.admin, "SenhaErrada1");
  assert.equal(ultimo.statusCode, 429);
});
