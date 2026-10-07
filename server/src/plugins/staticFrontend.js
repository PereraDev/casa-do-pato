import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/plugins -> raiz do projeto -> dist/ (gerado por `npm run
// build` na raiz; já inclui public/admin.html, copiado pelo Vite).
const distDir = path.join(__dirname, "../../../dist");

// Só registrado em produção (ver app.js) — em dev o Vite serve o front e
// faz proxy de /api e /socket.io pra este servidor (ver vite.config.js).
export default fp(async function staticFrontendPlugin(fastify) {
  await fastify.register(fastifyStatic, { root: distDir });

  // Fallback de SPA: qualquer GET que não bateu em nenhum arquivo estático
  // nem em /api cai no index.html (o React Router não existe aqui, mas o
  // próprio index.html decide tudo client-side) — só /api mesmo retorna 404
  // JSON de verdade.
  fastify.setNotFoundHandler((request, reply) => {
    if (request.raw.method !== "GET" || request.url.startsWith("/api/")) {
      reply.code(404).send({ erro: "Não encontrado" });
      return;
    }
    reply.sendFile("index.html");
  });
});
