// Avaliações de prato compartilhadas entre dispositivos (antes só localStorage).
// Leitura pública (o cardápio mostra pra todo mundo); escrita aberta a visitante também,
// com rate limit — mesmo critério do resto do app, que nunca exige conta pra pedir.
import { seqDoId } from "../lib/ids.js";

const MAX_FOTO = 400_000; // caracteres da dataURL (o cliente já reduz a imagem)
const MAX_POR_LEITURA = 1000;

const serializar = (a) => ({
  id: a.id,
  autor: a.autor,
  estrelas: a.estrelas,
  comentario: a.comentario,
  foto: a.foto || undefined,
  data: a.criadoEm.toISOString().slice(0, 10),
});

export default async function avaliacoesRoutes(fastify) {
  const { prisma, io } = fastify;

  // { [itemId]: [avaliação mais recente primeiro] } — mesmo shape que reviewsUser tinha.
  fastify.get("/api/avaliacoes", async () => {
    const lista = await prisma.avaliacao.findMany({ orderBy: { criadoEm: "desc" }, take: MAX_POR_LEITURA });
    const porItem = {};
    for (const a of lista) (porItem[a.itemId] ||= []).push(serializar(a));
    return porItem;
  });

  fastify.post("/api/avaliacoes", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { itemId, estrelas, comentario, foto, pedidoId } = request.body || {};
    const erro =
      typeof itemId !== "string" || !itemId || itemId.length > 40
        ? "Prato inválido"
        : !Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5
          ? "Escolha de 1 a 5 estrelas"
          : typeof comentario !== "string" || !comentario.trim() || comentario.length > 500
            ? "Escreva um comentário de até 500 caracteres"
            : foto != null && (typeof foto !== "string" || !foto.startsWith("data:image/") || foto.length > MAX_FOTO)
              ? "Foto inválida ou grande demais"
              : null;
    if (erro) return reply.code(400).send({ erro });

    // Autor sempre vem da sessão (conta logada) — nunca do corpo.
    const userId = request.session.get("userId");
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    const nova = await prisma.avaliacao.create({
      data: { itemId, autor: user?.nome || "Visitante", estrelas, comentario: comentario.trim(), foto: foto || null },
    });

    // "Avaliar pedido": só marca como avaliado se o pedido for DESTA sessão.
    let pedidoMarcado = null;
    const seq = typeof pedidoId === "string" ? seqDoId(pedidoId) : null;
    if (seq != null) {
      const guestId = userId ? null : request.session.get("guestId");
      const dono = userId ? { userId } : { guestId };
      const { count } = await prisma.order.updateMany({ where: { seq, ...dono }, data: { avaliado: true } });
      if (count) pedidoMarcado = pedidoId;
    }

    const avaliacao = serializar(nova);
    io.emit("avaliacao:nova", { itemId, avaliacao });
    reply.code(201);
    return { itemId, avaliacao, pedidoMarcado };
  });
}
