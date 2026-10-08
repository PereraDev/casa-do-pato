import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { FUNCOES_PADRAO, garantirFuncoesPadrao, serializarFuncionario } from "../lib/funcoes.js";
import { hashSenha, motivoSenhaFraca } from "../lib/senha.js";

const ORDEM_PADRAO = FUNCOES_PADRAO.map((f) => f.id);
const texto = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

// Equipe do painel: funcionários e funções. Leitura de funções vale pra qualquer
// funcionário logado (o painel precisa do rótulo e do padrão de seções da própria
// função); todo o resto exige função "admin".
export default async function equipeRoutes(fastify) {
  const { prisma } = fastify;
  const soAdmin = { onRequest: fastify.exigirAdministrador };

  async function totalAdmins() {
    return prisma.funcionario.count({ where: { funcao: "admin" } });
  }

  /* ---------------- Funções ---------------- */
  fastify.get("/api/admin/funcoes", { onRequest: fastify.exigirAdmin }, async () => {
    await garantirFuncoesPadrao(prisma);
    const lista = await prisma.funcao.findMany();
    const pos = (id) => (ORDEM_PADRAO.includes(id) ? ORDEM_PADRAO.indexOf(id) : ORDEM_PADRAO.length);
    return lista.sort((a, b) => pos(a.id) - pos(b.id) || a.label.localeCompare(b.label));
  });

  fastify.post("/api/admin/funcoes", soAdmin, async (request, reply) => {
    const label = request.body?.label;
    if (!texto(label, 1, 40)) return reply.code(400).send({ erro: "Informe o nome da função (até 40 caracteres)" });
    const nome = label.trim();
    const existentes = await prisma.funcao.findMany({ select: { label: true } });
    if (existentes.some((f) => f.label.toLowerCase() === nome.toLowerCase())) {
      return reply.code(409).send({ erro: "Já existe uma função com esse nome." });
    }
    const slug = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const id = `fn-${slug || "funcao"}-${crypto.randomBytes(3).toString("hex")}`;
    reply.code(201);
    // Nasce sem acesso nenhum até alguém marcar as seções ao cadastrar o funcionário.
    return prisma.funcao.create({ data: { id, label: nome, secoesPadrao: [] } });
  });

  fastify.delete("/api/admin/funcoes/:id", soAdmin, async (request, reply) => {
    const { id } = request.params;
    if (id === "admin") return reply.code(409).send({ erro: "A função Administrador não pode ser removida." });
    if (await prisma.funcionario.count({ where: { funcao: id } })) {
      return reply.code(409).send({ erro: "Função em uso — reatribua os funcionários antes de remover." });
    }
    await prisma.funcao.deleteMany({ where: { id } });
    return { ok: true };
  });

  /* ---------------- Funcionários ---------------- */
  fastify.get("/api/admin/funcionarios", soAdmin, async () => {
    const lista = await prisma.funcionario.findMany({ orderBy: { criadoEm: "asc" } });
    return lista.map(serializarFuncionario);
  });

  // Valida o corpo de criar/editar. Devolve { erro } ou { dados } já normalizado.
  async function validar(body, criando) {
    const { nome, usuario, senha, funcao, secoesPermitidas } = body || {};
    if (!texto(nome, 1, 80)) return { erro: "Informe o nome (até 80 caracteres)." };
    if (!texto(usuario, 3, 120)) return { erro: "Informe o usuário de login (3 a 120 caracteres)." };
    if (criando || senha) {
      const motivo = motivoSenhaFraca(String(senha ?? ""));
      if (motivo) return { erro: motivo };
    }
    if (typeof funcao !== "string" || !(await prisma.funcao.findUnique({ where: { id: funcao } }))) {
      return { erro: "Função inválida." };
    }
    let secoes = null;
    if (funcao !== "admin" && secoesPermitidas != null) {
      if (!Array.isArray(secoesPermitidas) || secoesPermitidas.length > 60 || !secoesPermitidas.every((s) => texto(s, 1, 40))) {
        return { erro: "Seções inválidas." };
      }
      secoes = secoesPermitidas;
    }
    const dados = { nome: nome.trim(), usuario: usuario.trim().toLowerCase(), funcao, secoesPermitidas: secoes };
    if (senha) dados.senhaHash = await hashSenha(senha);
    return { dados };
  }

  const jaExiste = (err, reply) => {
    if (err.code !== "P2002") throw err;
    return reply.code(409).send({ erro: "Já existe um funcionário com esse usuário." });
  };
  // Coluna Json: pra gravar NULL o Prisma exige Prisma.DbNull (null puro é rejeitado).
  const comJson = (d) => ({ ...d, secoesPermitidas: d.secoesPermitidas ?? Prisma.DbNull });

  fastify.post("/api/admin/funcionarios", soAdmin, async (request, reply) => {
    const { erro, dados } = await validar(request.body, true);
    if (erro) return reply.code(400).send({ erro });
    try {
      const f = await prisma.funcionario.create({ data: comJson(dados) });
      reply.code(201);
      return serializarFuncionario(f);
    } catch (err) {
      return jaExiste(err, reply);
    }
  });

  fastify.patch("/api/admin/funcionarios/:id", soAdmin, async (request, reply) => {
    const atual = await prisma.funcionario.findUnique({ where: { id: request.params.id } });
    if (!atual) return reply.code(404).send({ erro: "Funcionário não encontrado." });
    const { erro, dados } = await validar(request.body, false);
    if (erro) return reply.code(400).send({ erro });
    if (atual.funcao === "admin" && dados.funcao !== "admin" && (await totalAdmins()) <= 1) {
      return reply.code(409).send({ erro: "Não é possível rebaixar o último administrador do painel." });
    }
    try {
      const f = await prisma.funcionario.update({
        where: { id: atual.id },
        // secoesPermitidas null limpa as seções próprias (volta pro padrão da função)
        data: comJson(dados),
      });
      return serializarFuncionario(f);
    } catch (err) {
      return jaExiste(err, reply);
    }
  });

  fastify.delete("/api/admin/funcionarios/:id", soAdmin, async (request, reply) => {
    const alvo = await prisma.funcionario.findUnique({ where: { id: request.params.id } });
    if (!alvo) return reply.code(404).send({ erro: "Funcionário não encontrado." });
    if (alvo.funcao === "admin" && (await totalAdmins()) <= 1) {
      return reply.code(409).send({ erro: "Não é possível remover o último administrador do painel." });
    }
    await prisma.funcionario.delete({ where: { id: alvo.id } });
    return { ok: true };
  });
}
