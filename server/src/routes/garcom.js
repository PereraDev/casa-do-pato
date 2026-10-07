import { seqDoId } from "../lib/ids.js";
import { serializarChamada } from "../lib/serializers.js";

// Chamado de garçom — sem identidade de cliente (o app já não tinha sessão
// de garçom nem exigia login pra chamar, ver CLAUDE.md, "Chamar garçom").
export default async function garcomRoutes(fastify) {
  const { prisma, io } = fastify;

  // Registra um novo chamado e avisa o admin em tempo real (room "admin").
  fastify.post("/api/garcom/chamadas", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { mesa, motivo } = request.body || {};
    if (!mesa || typeof mesa !== "string" || mesa.length > 20) {
      return reply.code(400).send({ erro: "Informe o número da mesa" });
    }
    const call = await prisma.waiterCall.create({
      data: { mesa, motivo: typeof motivo === "string" && motivo ? motivo.slice(0, 30) : "presenca" },
    });
    const chamada = serializarChamada(call);
    io.to("admin").emit("garcom:nova", chamada);
    reply.code(201);
    return chamada;
  });

  fastify.get("/api/garcom/chamadas/pendentes", { onRequest: fastify.exigirAdmin }, async () => {
    const calls = await prisma.waiterCall.findMany({
      where: { atendidoEm: null },
      orderBy: { criadoEm: "asc" },
    });
    return calls.map(serializarChamada);
  });

  fastify.get("/api/garcom/chamadas", { onRequest: fastify.exigirAdmin }, async () => {
    const calls = await prisma.waiterCall.findMany({ orderBy: { criadoEm: "desc" } });
    return calls.map(serializarChamada);
  });

  // Catch-up pro cliente que perdeu o evento de socket com a aba fechada —
  // ver AppContext.jsx#chamadaPendenteAvaliacao no app cliente.
  fastify.get("/api/garcom/chamadas/minhas", async (request) => {
    const idsParam = request.query?.ids;
    if (!idsParam) return [];
    const seqs = String(idsParam)
      .split(",")
      .map(seqDoId)
      .filter((n) => n != null);
    if (!seqs.length) return [];
    const calls = await prisma.waiterCall.findMany({ where: { seq: { in: seqs } } });
    return calls.map(serializarChamada);
  });

  // Marca como atendido (funcionário vem do admin.html, já logado ali — sem
  // formulário/seletor extra, ver CLAUDE.md "Mesas") e avisa tanto o admin
  // quanto o cliente que fez esse chamado específico (room "chamada:<id>"),
  // que então dispara o prompt de avaliação (ver App.jsx#AvaliarGarcomPrompt).
  fastify.patch("/api/garcom/chamadas/:id/atender", { onRequest: fastify.exigirAdmin }, async (request, reply) => {
    const seq = seqDoId(request.params.id);
    if (seq == null) return reply.code(400).send({ erro: "Chamado inválido" });
    const { funcionario } = request.body || {};
    const call = await prisma.waiterCall.update({
      where: { seq },
      data: { atendidoEm: new Date(), atendidoPor: funcionario || null },
    });
    const chamada = serializarChamada(call);
    io.to("chamada:" + chamada.id).to("admin").emit("garcom:atendida", chamada);
    return chamada;
  });

  fastify.patch("/api/garcom/chamadas/:id/avaliar", async (request, reply) => {
    const seq = seqDoId(request.params.id);
    const { nota } = request.body || {};
    if (seq == null || !(Number.isInteger(nota) && nota >= 1 && nota <= 5)) {
      return reply.code(400).send({ erro: "Avaliação inválida" });
    }
    // Só avalia chamado já atendido e ainda sem nota — impede reescrever o placar.
    const { count } = await prisma.waiterCall.updateMany({
      where: { seq, atendidoEm: { not: null }, notaCliente: null },
      data: { notaCliente: nota },
    });
    if (!count) return reply.code(409).send({ erro: "Chamado não pode ser avaliado" });
    const call = await prisma.waiterCall.findUnique({ where: { seq } });
    const chamada = serializarChamada(call);
    io.to("admin").emit("garcom:avaliada", chamada);
    return chamada;
  });
}
