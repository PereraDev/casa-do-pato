import fp from "fastify-plugin";
import { serializarFuncionario } from "../lib/funcoes.js";
import { conferirSenha, hashSenha } from "../lib/senha.js";

const VALIDADE_MS = 12 * 60 * 60 * 1000;

// Acesso ao painel admin: conta de funcionário no Postgres (usuário + senha com
// bcrypt, ver prisma Funcionario). O login grava `adminAte` (12h) e
// `funcionarioId` na sessão cifrada; toda rota restrita confere as duas coisas
// e que o funcionário ainda existe (apagar a conta derruba o acesso na hora).
// ponytail: permissão por SEÇÃO ainda é só do painel (client-side); no servidor só
// existem 2 níveis — qualquer funcionário logado e "admin" (gestão de equipe).
export default fp(async function adminPlugin(fastify) {
  const { prisma } = fastify;
  let hashFalso;

  function sessaoAdminValida(session) {
    return Number(session?.get("adminAte")) > Date.now();
  }
  fastify.decorate("sessaoAdminValida", sessaoAdminValida);

  async function funcionarioDaSessao(session) {
    if (!sessaoAdminValida(session)) return null;
    const id = session.get("funcionarioId");
    return id ? prisma.funcionario.findUnique({ where: { id } }) : null;
  }
  fastify.decorate("funcionarioDaSessao", funcionarioDaSessao);

  // `{ onRequest: fastify.exigirAdmin }` numa rota, ou `addHook("onRequest", ...)` num plugin inteiro.
  fastify.decorate("exigirAdmin", async (request, reply) => {
    if (!(await funcionarioDaSessao(request.session))) {
      return reply.code(401).send({ erro: "Acesso restrito ao painel administrativo" });
    }
  });
  // Gestão de equipe: só função "admin".
  fastify.decorate("exigirAdministrador", async (request, reply) => {
    const f = await funcionarioDaSessao(request.session);
    if (!f) return reply.code(401).send({ erro: "Acesso restrito ao painel administrativo" });
    if (f.funcao !== "admin") return reply.code(403).send({ erro: "Só administradores podem fazer isso" });
  });

  fastify.post(
    "/api/admin/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const usuario = String(request.body?.usuario ?? "").trim().toLowerCase();
      const senha = String(request.body?.senha ?? "");
      const f = usuario ? await prisma.funcionario.findUnique({ where: { usuario } }) : null;
      // Gasta o bcrypt mesmo sem conta, pra o tempo não revelar se o usuário existe.
      const hash = f ? f.senhaHash : await (hashFalso ??= hashSenha("senha-inexistente-1"));
      if (!(await conferirSenha(senha, hash)) || !f) {
        return reply.code(401).send({ erro: "Usuário ou senha inválidos" });
      }
      request.session.set("adminAte", Date.now() + VALIDADE_MS);
      request.session.set("funcionarioId", f.id);
      return serializarFuncionario(f);
    },
  );

  fastify.post("/api/admin/logout", async (request) => {
    request.session.set("adminAte", null);
    request.session.set("funcionarioId", null);
    return { ok: true };
  });
});
