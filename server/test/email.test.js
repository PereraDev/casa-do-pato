// Verificação de e-mail no cadastro e recuperação de senha por e-mail. O Resend é
// simulado (fetch trocado): nenhum e-mail sai de verdade. Cria usuários
// "teste-...@teste.local" e apaga no fim.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { buildApp } from "../src/app.js";

const sufixo = crypto.randomBytes(3).toString("hex");
const email = `teste-email-${sufixo}@teste.local`;
const emailB = `teste-email-b-${sufixo}@teste.local`;
const SENHA = "Senha1234";
const NOVA_SENHA = "OutraSenha99";

let app;
const enviados = []; // e-mails que o servidor tentou mandar pelo Resend
let provedorRecusa = false; // simula o Resend recusando o envio (ex.: destinatário fora do sandbox)
const fetchOriginal = globalThis.fetch;
const env = { ...process.env };

const req = (method, url, payload, cookie) => app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });
const codigoDoUltimoEmail = () => /\b(\d{6})\b/.exec(enviados.at(-1).text)[1];
const cookieDe = (res) => [res.headers["set-cookie"]].flat()[0].split(";")[0];

before(async () => {
  process.env.RESEND_API_KEY = "re_teste";
  process.env.EMAIL_FROM = "Casa do Pato <teste@exemplo.com>";
  process.env.EMAIL_VERIFICAR_DNS = "0";
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(opts.headers.Authorization, "Bearer re_teste");
    if (provedorRecusa) return new Response('{"message":"You can only send testing emails to your own email address"}', { status: 403 });
    enviados.push(JSON.parse(opts.body));
    return new Response("{}", { status: 200 });
  };
  app = await buildApp();
  await app.ready();
});
after(async () => {
  globalThis.fetch = fetchOriginal;
  process.env.RESEND_API_KEY = env.RESEND_API_KEY;
  process.env.EMAIL_FROM = env.EMAIL_FROM;
  process.env.EMAIL_VERIFICAR_DNS = env.EMAIL_VERIFICAR_DNS;
  await app.prisma.user.deleteMany({ where: { email: { endsWith: `-${sufixo}@teste.local` } } });
  await app.close();
});

test("cadastro recusa e-mail com formato inválido", async () => {
  for (const ruim of ["sem-arroba", "a@b", "a b@c.com", "11999998888"]) {
    const r = await req("POST", "/api/auth/cadastro", { nome: "X", email: ruim, senha: SENHA });
    assert.equal(r.statusCode, 400, ruim);
  }
  assert.equal(enviados.length, 0);
});

test("cadastro avisa quando o provedor recusa o envio (não finge que mandou)", async () => {
  const emailC = `teste-email-c-${sufixo}@teste.local`;
  provedorRecusa = true;
  const r = await req("POST", "/api/auth/cadastro", { nome: "Sem Entrega", email: emailC, senha: SENHA });
  provedorRecusa = false;
  assert.equal(r.statusCode, 201);
  assert.deepEqual(r.json(), { precisaVerificar: true, email: emailC, emailEnviado: false });
  assert.equal(enviados.length, 0);
});

test("cadastro manda código ao e-mail do cliente e NÃO loga até confirmar", async () => {
  const r = await req("POST", "/api/auth/cadastro", { nome: "Cliente Teste", email, senha: SENHA });
  assert.equal(r.statusCode, 201);
  assert.deepEqual(r.json(), { precisaVerificar: true, email, emailEnviado: true });
  assert.equal(enviados.length, 1);
  assert.deepEqual(enviados[0].to, [email]);
  assert.match(enviados[0].text, /\b\d{6}\b/);

  const me = await req("GET", "/api/auth/me", undefined, cookieDe(r));
  assert.equal(me.json().tipo, "visitante");
});

test("login antes de confirmar o e-mail dá 403; código errado é recusado", async () => {
  const login = await req("POST", "/api/auth/login", { email, senha: SENHA });
  assert.equal(login.statusCode, 403);
  assert.equal(login.json().precisaVerificar, true);
  const errado = await req("POST", "/api/auth/verificar-email", { email, codigo: "000000" });
  assert.equal(errado.statusCode, 400);
});

test("código certo confirma o e-mail e já loga; depois o login normal funciona", async () => {
  const ok = await req("POST", "/api/auth/verificar-email", { email, codigo: codigoDoUltimoEmail() });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().email, email);
  const me = await req("GET", "/api/auth/me", undefined, cookieDe(ok));
  assert.equal(me.json().tipo, "usuario");
  assert.equal((await req("POST", "/api/auth/login", { email, senha: SENHA })).statusCode, 200);
  // o mesmo código não vale duas vezes
  assert.equal((await req("POST", "/api/auth/verificar-email", { email, codigo: codigoDoUltimoEmail() })).statusCode, 400);
});

test("e-mail já confirmado não pode ser cadastrado de novo", async () => {
  const r = await req("POST", "/api/auth/cadastro", { nome: "Outro", email, senha: SENHA });
  assert.equal(r.statusCode, 409);
});

test("e-mail ainda não confirmado pode ser recadastrado (ninguém 'reserva' o e-mail dos outros)", async () => {
  await req("POST", "/api/auth/cadastro", { nome: "Primeiro", email: emailB, senha: SENHA });
  const segundo = await req("POST", "/api/auth/cadastro", { nome: "Dono Verdadeiro", email: emailB, senha: NOVA_SENHA });
  assert.equal(segundo.statusCode, 201);
  const user = await app.prisma.user.findUnique({ where: { email: emailB } });
  assert.equal(user.nome, "Dono Verdadeiro");
});

test("recuperação: o código chega no e-mail da conta, nada sai pra conta inexistente, 1 envio por minuto", async () => {
  const antes = enviados.length;
  const fantasma = await req("POST", "/api/auth/recuperar", { email: `ninguem-${sufixo}@teste.local` });
  assert.deepEqual(fantasma.json(), { ok: true, via: "email" });
  assert.equal(enviados.length, antes, "não manda e-mail pra quem não tem conta");

  const r = await req("POST", "/api/auth/recuperar", { email });
  assert.deepEqual(r.json(), { ok: true, via: "email" });
  assert.equal(enviados.length, antes + 1);
  assert.deepEqual(enviados.at(-1).to, [email]);

  await req("POST", "/api/auth/recuperar", { email });
  assert.equal(enviados.length, antes + 1, "segundo pedido em menos de 1 min não manda outro e-mail");
});

test("redefinir: senha fraca não gasta o código; código certo troca a senha", async () => {
  const codigo = codigoDoUltimoEmail();
  const fraca = await req("POST", "/api/auth/redefinir", { email, codigo, novaSenha: "123" });
  assert.equal(fraca.statusCode, 400);
  const ok = await req("POST", "/api/auth/redefinir", { email, codigo, novaSenha: NOVA_SENHA });
  assert.equal(ok.statusCode, 200);
  assert.equal((await req("POST", "/api/auth/login", { email, senha: SENHA })).statusCode, 401);
  assert.equal((await req("POST", "/api/auth/login", { email, senha: NOVA_SENHA })).statusCode, 200);
});
