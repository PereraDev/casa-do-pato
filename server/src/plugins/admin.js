import crypto from "node:crypto";
import fp from "fastify-plugin";

const VALIDADE_MS = 12 * 60 * 60 * 1000;

// Acesso ao painel admin: chave única do servidor (ADMIN_TOKEN no .env) trocada
// por uma flag na sessão cifrada (`adminAte`, expira em 12h). É o piso que fecha
// as rotas do admin pra quem está fora do painel — não substitui contas de
// funcionário no banco (hoje ainda só localStorage do admin, ver CLAUDE.md).
// ponytail: chave compartilhada; upgrade = tabela Employee com bcrypt + papel por rota.
export default fp(async function adminPlugin(fastify) {
  const token = process.env.ADMIN_TOKEN || "";
  if (token.length < 16) {
    throw new Error("ADMIN_TOKEN precisa ter pelo menos 16 caracteres — ver server/.env.example");
  }
  const esperado = crypto.createHash("sha256").update(token).digest();

  function sessaoAdminValida(session) {
    return Number(session?.get("adminAte")) > Date.now();
  }
  fastify.decorate("sessaoAdminValida", sessaoAdminValida);

  // onRequest/preHandler das rotas restritas: `{ onRequest: fastify.exigirAdmin }`
  // numa rota, ou `fastify.addHook("onRequest", fastify.exigirAdmin)` num plugin inteiro.
  fastify.decorate("exigirAdmin", async (request, reply) => {
    if (!sessaoAdminValida(request.session)) {
      return reply.code(401).send({ erro: "Acesso restrito ao painel administrativo" });
    }
  });

  fastify.post(
    "/api/admin/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const enviado = crypto.createHash("sha256").update(String(request.body?.token ?? "")).digest();
      if (!crypto.timingSafeEqual(enviado, esperado)) {
        return reply.code(401).send({ erro: "Chave do servidor inválida" });
      }
      request.session.set("adminAte", Date.now() + VALIDADE_MS);
      return { ok: true };
    },
  );

  fastify.post("/api/admin/logout", async (request) => {
    request.session.set("adminAte", null);
    return { ok: true };
  });
});
