// Busca por IA sem chave configurada: tem que falhar de forma clara (503 + mensagem), nunca
// em silêncio. A chave é esvaziada ANTES de importar o app (ia.js lê o ambiente ao carregar).
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.GEMINI_API_KEY = "";
let app;
before(async () => {
  const { buildApp } = await import("../src/app.js");
  app = await buildApp();
  await app.ready();
});
after(() => app.close());

test("sem GEMINI_API_KEY a rota responde 503 com mensagem compreensível", async () => {
  const r = await app.inject({ method: "POST", url: "/api/ia/busca", payload: { pergunta: "algo leve", itens: [{ id: "a", nome: "A" }] } });
  assert.equal(r.statusCode, 503);
  assert.match(r.json().erro, /busca por IA está desligada/);
});
