import crypto from "node:crypto";
import { conferirSenha, hashSenha, motivoSenhaFraca } from "../lib/senha.js";

// Limite apertado pras rotas que gastam bcrypt ou aceitam tentativa de adivinhar.
const LIMITE_AUTH = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

// Código de recuperação de 6 dígitos, em memória, 15 min, 5 tentativas.
// ponytail: Map em processo único e "e-mail" é só log no console do servidor;
// upgrade = coluna no User + envio de e-mail de verdade.
const RECUPERACAO_MS = 15 * 60 * 1000;
const recuperacoes = new Map(); // email -> { codigo, expira, tentativas }

// A entrada padrão do app (QR Code) nunca é bloqueada por login — sem sessão
// salva, GET /me já devolve "visitante" (ver CLAUDE.md, "Conta/sessão").
// Recuperação de senha continua um fluxo simulado em 2 etapas, sem e-mail
// real, igual ao protótipo anterior.
export default async function authRoutes(fastify) {
  const { prisma } = fastify;

  let hashFalsoPromise;
  const hashFalso = () => (hashFalsoPromise ??= hashSenha("senha-inexistente-1"));

  function sessaoUsuario(user) {
    return { tipo: "usuario", nome: user.nome, email: user.email };
  }

  // `User.email` é uma coluna comum do Postgres (sem citext), então a
  // comparação é case-sensitive por padrão — "Alex@teste.com" e
  // "alex@teste.com" seriam contas diferentes/nunca dariam match no login.
  // O campo de login é `type="text"` (não `type="email"`, de propósito, pra
  // aceitar telefone também — ver AccountSheet.jsx), então o teclado do
  // celular pode maiusculizar a 1ª letra sozinho sem a pessoa perceber.
  // Normaliza pra minúsculo em todo lugar que compara/grava e-mail de conta,
  // servidor sendo sempre a fonte da verdade (front-end só evita o problema
  // na origem, ver AccountSheet.jsx).
  function normalizarEmail(email) {
    return (email || "").trim().toLowerCase();
  }

  // Quem é a sessão atual? Chamada 1x no mount do front (ver AppContext.jsx)
  // — sempre responde 200, nunca 401 (entrar como visitante é sempre válido).
  fastify.get("/api/auth/me", async (request) => {
    const userId = request.session.get("userId");
    if (!userId) return { tipo: "visitante" };
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      request.session.set("userId", null);
      return { tipo: "visitante" };
    }
    return sessaoUsuario(user);
  });

  // Cria a conta (senha validada como forte e hasheada com bcrypt, ver
  // lib/senha.js) e já loga em seguida (grava userId na sessão).
  fastify.post("/api/auth/cadastro", LIMITE_AUTH, async (request, reply) => {
    const { nome } = request.body || {};
    const email = normalizarEmail(request.body?.email);
    const { senha } = request.body || {};
    if (!nome || !email || !senha) {
      return reply.code(400).send({ erro: "Preencha nome, e-mail e senha." });
    }
    const motivoFraca = motivoSenhaFraca(senha);
    if (motivoFraca) {
      return reply.code(400).send({ erro: motivoFraca });
    }
    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) {
      return reply.code(409).send({ erro: "Já existe uma conta com esse e-mail. Faça login." });
    }
    const senhaHash = await hashSenha(senha);
    let user;
    try {
      user = await prisma.user.create({ data: { nome, email, senhaHash } });
    } catch (err) {
      // Duas requisições de cadastro pro mesmo e-mail quase ao mesmo tempo
      // passam pela checagem acima antes de qualquer uma criar a conta — a
      // constraint única do banco é a garantia de verdade contra isso.
      if (err.code === "P2002") {
        return reply.code(409).send({ erro: "Já existe uma conta com esse e-mail. Faça login." });
      }
      throw err;
    }
    request.session.set("userId", user.id);
    reply.code(201);
    return sessaoUsuario(user);
  });

  // Mesma mensagem de erro tanto pra e-mail inexistente quanto pra senha
  // errada ("E-mail ou senha inválidos") — não vaza qual dos dois errou.
  fastify.post("/api/auth/login", LIMITE_AUTH, async (request, reply) => {
    const { senha } = request.body || {};
    const email = normalizarEmail(request.body?.email);
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    const hash = user ? user.senhaHash : await hashFalso();
    if (!(await conferirSenha(String(senha || ""), hash)) || !user) {
      return reply.code(401).send({ erro: "E-mail ou senha inválidos" });
    }
    request.session.set("userId", user.id);
    return sessaoUsuario(user);
  });

  fastify.post("/api/auth/logout", async (request) => {
    // Só limpa userId — guestId continua o mesmo, pra não perder o histórico
    // de pedidos de visitante que essa aba já tinha.
    request.session.set("userId", null);
    return { ok: true };
  });

  // Etapa 1: gera o código de recuperação. Responde sempre {ok:true}, exista
  // a conta ou não (não deixa enumerar e-mails). O "envio" é um log no
  // console do servidor — protótipo sem e-mail real (ver CLAUDE.md).
  fastify.post("/api/auth/recuperar", LIMITE_AUTH, async (request) => {
    const email = normalizarEmail(request.body?.email);
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (user) {
      const codigo = String(crypto.randomInt(100000, 1000000));
      recuperacoes.set(email, { codigo, expira: Date.now() + RECUPERACAO_MS, tentativas: 0 });
      request.log.warn(`[recuperar senha - e-mail simulado] ${email} → código ${codigo}`);
    }
    return { ok: true };
  });

  // Etapa 2: confere o código e define a nova senha (mesma validação de
  // força do cadastro). Uso único; 5 erros invalidam o código.
  fastify.post("/api/auth/redefinir", LIMITE_AUTH, async (request, reply) => {
    const { novaSenha, codigo } = request.body || {};
    const email = normalizarEmail(request.body?.email);
    const rec = recuperacoes.get(email);
    const invalido = () => reply.code(400).send({ erro: "Código inválido ou expirado" });
    if (!rec || rec.expira < Date.now() || rec.tentativas >= 5) return invalido();
    rec.tentativas++;
    const a = Buffer.from(String(codigo ?? "").padEnd(6).slice(0, 6));
    const b = Buffer.from(rec.codigo);
    if (!crypto.timingSafeEqual(a, b) || String(codigo).length !== 6) return invalido();
    const motivoFraca = motivoSenhaFraca(String(novaSenha || ""));
    if (motivoFraca) return reply.code(400).send({ erro: motivoFraca });
    recuperacoes.delete(email);
    const senhaHash = await hashSenha(novaSenha);
    await prisma.user.update({ where: { email }, data: { senhaHash } });
    return { ok: true };
  });

  // Lista de contas — usada pelo admin.html (aba Clientes e "Membros" da
  // aba Fidelidade). Nunca inclui a senha/hash. Só admin (sessão de
  // admin, ver plugins/admin.js).
  fastify.get("/api/auth/usuarios", { onRequest: fastify.exigirAdmin }, async () => {
    const usuarios = await prisma.user.findMany({ select: { nome: true, email: true } });
    return usuarios;
  });
}
