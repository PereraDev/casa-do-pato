import { conferirCodigo, emitirCodigo } from "../lib/codigos.js";
import { dominioRecebeEmail, emailAtivo, emailComCodigo, emailComFormatoValido, enviarEmail } from "../lib/email.js";
import { conferirSenha, hashSenha, motivoSenhaFraca } from "../lib/senha.js";

// Limite apertado pras rotas que gastam bcrypt ou aceitam tentativa de adivinhar.
const LIMITE_AUTH = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

// A entrada padrão do app (QR Code) nunca é bloqueada por login — sem sessão
// salva, GET /me já devolve "visitante" (ver CLAUDE.md, "Conta/sessão").
//
// E-mail (lib/email.js): com RESEND_API_KEY configurada, o cadastro só vira login
// depois de confirmar um código enviado ao e-mail da pessoa (prova que o endereço
// existe e é dela), e a recuperação de senha também chega por e-mail. Sem a chave
// (desenvolvimento), cadastro entra direto e o código de recuperação sai no log.
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
  // O campo de login é `type="text"` (não `type="email"`, de propósito: o teclado
  // do celular pode maiusculizar a 1ª letra sozinho sem a pessoa perceber).
  // Normaliza pra minúsculo em todo lugar que compara/grava e-mail de conta,
  // servidor sendo sempre a fonte da verdade (front-end só evita o problema
  // na origem, ver AccountSheet.jsx).
  function normalizarEmail(email) {
    return (email || "").trim().toLowerCase();
  }

  // Manda o código por e-mail (com o log de desenvolvimento quando o envio está
  // desligado). Nunca lança: falha de provedor vira log, e a resposta da rota não
  // muda (não revela se a conta existe, nem trava o cadastro).
  async function enviarCodigo(request, { chave, user, motivo }) {
    const codigo = emitirCodigo(chave);
    if (!codigo) return false; // pediu outro código há menos de 1 min
    if (!emailAtivo()) {
      request.log.warn(`[código ${chave} - envio de e-mail desligado] ${user.email} → ${codigo}`);
      return true;
    }
    try {
      await enviarEmail({ para: user.email, ...emailComCodigo({ nome: user.nome.split(" ")[0], codigo, motivo }) });
      return true;
    } catch (err) {
      request.log.error(err, `Falha ao enviar e-mail (${chave})`);
      return false;
    }
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

  // Cria a conta (senha validada como forte e hasheada com bcrypt, ver lib/senha.js).
  // Com envio de e-mail ligado: valida o formato e o domínio do e-mail, manda o
  // código e NÃO loga (a conta só vale depois de /verificar-email). Cadastrar de novo
  // um e-mail ainda NÃO confirmado sobrescreve nome/senha e reenvia o código — senão
  // alguém poderia "reservar" o e-mail de outra pessoa digitando-o antes dela.
  fastify.post("/api/auth/cadastro", LIMITE_AUTH, async (request, reply) => {
    const { nome } = request.body || {};
    const email = normalizarEmail(request.body?.email);
    const { senha } = request.body || {};
    if (!nome || !email || !senha) {
      return reply.code(400).send({ erro: "Preencha nome, e-mail e senha." });
    }
    if (typeof nome !== "string" || nome.length > 80) {
      return reply.code(400).send({ erro: "Nome inválido (até 80 caracteres)." });
    }
    if (!emailComFormatoValido(email)) {
      return reply.code(400).send({ erro: "Informe um e-mail válido (ex.: voce@email.com)." });
    }
    const motivoFraca = motivoSenhaFraca(senha);
    if (motivoFraca) {
      return reply.code(400).send({ erro: motivoFraca });
    }
    const existente = await prisma.user.findUnique({ where: { email } });
    const jaConfirmada = existente && (existente.emailVerificadoEm || !emailAtivo());
    if (jaConfirmada) {
      return reply.code(409).send({ erro: "Já existe uma conta com esse e-mail. Faça login." });
    }
    if (!(await dominioRecebeEmail(email))) {
      return reply.code(400).send({ erro: "Esse e-mail não parece existir (domínio inválido). Confira o endereço." });
    }
    const senhaHash = await hashSenha(senha);
    let user;
    try {
      user = existente
        ? await prisma.user.update({ where: { email }, data: { nome, senhaHash } })
        : await prisma.user.create({ data: { nome, email, senhaHash } });
    } catch (err) {
      // Duas requisições de cadastro pro mesmo e-mail quase ao mesmo tempo
      // passam pela checagem acima antes de qualquer uma criar a conta — a
      // constraint única do banco é a garantia de verdade contra isso.
      if (err.code === "P2002") {
        return reply.code(409).send({ erro: "Já existe uma conta com esse e-mail. Faça login." });
      }
      throw err;
    }
    reply.code(201);
    if (emailAtivo()) {
      await enviarCodigo(request, {
        chave: `ver:${email}`,
        user,
        motivo: "Use o código abaixo para confirmar o seu e-mail e ativar a sua conta.",
      });
      return { precisaVerificar: true, email };
    }
    request.session.set("userId", user.id);
    return sessaoUsuario(user);
  });

  // Confere o código recebido por e-mail, marca o endereço como confirmado e já loga.
  fastify.post("/api/auth/verificar-email", LIMITE_AUTH, async (request, reply) => {
    const email = normalizarEmail(request.body?.email);
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (!user || !conferirCodigo(`ver:${email}`, request.body?.codigo)) {
      return reply.code(400).send({ erro: "Código inválido ou expirado" });
    }
    const confirmado = await prisma.user.update({ where: { id: user.id }, data: { emailVerificadoEm: new Date() } });
    request.session.set("userId", confirmado.id);
    return sessaoUsuario(confirmado);
  });

  // Reenvia o código de confirmação. Sempre {ok:true} (não revela quais e-mails têm
  // conta); o intervalo mínimo de 1 min entre envios fica em lib/codigos.js.
  fastify.post("/api/auth/reenviar-codigo", LIMITE_AUTH, async (request) => {
    const email = normalizarEmail(request.body?.email);
    const user = email && emailAtivo() ? await prisma.user.findUnique({ where: { email } }) : null;
    if (user && !user.emailVerificadoEm) {
      await enviarCodigo(request, {
        chave: `ver:${email}`,
        user,
        motivo: "Use o código abaixo para confirmar o seu e-mail e ativar a sua conta.",
      });
    }
    return { ok: true };
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
    // Senha certa, mas e-mail ainda não confirmado: só quem sabe a senha chega aqui.
    if (emailAtivo() && !user.emailVerificadoEm) {
      return reply.code(403).send({ erro: "Confirme o seu e-mail para entrar.", precisaVerificar: true, email });
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

  // Etapa 1 da recuperação: manda o código por e-mail. Responde sempre {ok:true},
  // exista a conta ou não (não deixa enumerar e-mails); `via` só diz à tela qual
  // texto mostrar ("email" = foi pra caixa de entrada; "log" = modo desenvolvimento).
  fastify.post("/api/auth/recuperar", LIMITE_AUTH, async (request) => {
    const email = normalizarEmail(request.body?.email);
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (user) {
      await enviarCodigo(request, {
        chave: `rec:${email}`,
        user,
        motivo: "Use o código abaixo para redefinir a sua senha.",
      });
    }
    return { ok: true, via: emailAtivo() ? "email" : "log" };
  });

  // Etapa 2: confere o código e define a nova senha (mesma validação de força do
  // cadastro). Uso único; 5 erros invalidam o código. Receber o código no e-mail já
  // prova que o endereço é da pessoa, então isso também confirma a conta.
  fastify.post("/api/auth/redefinir", LIMITE_AUTH, async (request, reply) => {
    const { novaSenha, codigo } = request.body || {};
    const email = normalizarEmail(request.body?.email);
    // Senha fraca é recusada ANTES de gastar o código (que é de uso único).
    const motivoFraca = motivoSenhaFraca(String(novaSenha || ""));
    if (motivoFraca) return reply.code(400).send({ erro: motivoFraca });
    if (!conferirCodigo(`rec:${email}`, codigo)) {
      return reply.code(400).send({ erro: "Código inválido ou expirado" });
    }
    const senhaHash = await hashSenha(novaSenha);
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.user.update({
      where: { email },
      data: { senhaHash, emailVerificadoEm: user?.emailVerificadoEm ?? new Date() },
    });
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
