import crypto from "node:crypto";
import secureSession from "@fastify/secure-session";
import fp from "fastify-plugin";

// Sessão via cookie assinado/cifrado (sem tabela de sessão no banco) — guarda
// `userId` (conta logada) e `guestId` (identidade de visitante, gerada na 1ª
// request de qualquer cliente). O app cliente NUNCA bloqueia quem não está
// logado (ver CLAUDE.md, "Conta/sessão") — `guestId` é o que permite
// GET /api/pedidos/meus devolver o histórico de um visitante mesmo sem conta.
export default fp(async function sessionPlugin(fastify) {
  const key = Buffer.from(process.env.SESSION_SECRET, "hex");
  if (key.length !== 32) {
    throw new Error(
      "SESSION_SECRET precisa ser uma chave de 32 bytes em hex (64 caracteres) — ver server/.env.example",
    );
  }

  await fastify.register(secureSession, {
    key,
    cookieName: "tnm_sessao",
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    },
  });

  fastify.addHook("onRequest", async (request) => {
    if (!request.session.get("guestId")) {
      request.session.set("guestId", crypto.randomUUID());
    }
  });
});
