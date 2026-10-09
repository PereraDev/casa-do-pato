// Catálogo servido pelo back-end. Leitura pública do cardápio já aplicado (edições do admin +
// estoque); escrita só pelo painel (sessão de funcionário). Edições vão pro Postgres, então
// valem pra TODOS os dispositivos — antes ficavam no localStorage de quem editou.
import { CHAVES_CONFIG, carregarConfig, catalogoEfetivo, validarConfig } from "../lib/catalogo.js";

export default async function catalogoRoutes(fastify) {
  const { prisma, io } = fastify;
  const avisar = () => io.emit("catalogo:atualizado"); // clientes e admins recarregam

  fastify.get("/api/catalogo", async () => catalogoEfetivo(await carregarConfig(prisma)));

  // Bruto (overrides/extras/estoque), pro painel montar as telas de edição.
  fastify.get("/api/catalogo/config", { onRequest: fastify.exigirAdmin }, async () => carregarConfig(prisma));

  // Foto em dataURL pode passar de 1 MB no JSON inteiro (várias fotos numa linha só).
  fastify.put("/api/catalogo/config/:chave", { onRequest: fastify.exigirAdmin, bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const { chave } = request.params;
    const { valor } = request.body || {};
    if (!CHAVES_CONFIG.includes(chave)) return reply.code(404).send({ erro: "Configuração desconhecida" });
    const erro = validarConfig(chave, valor);
    if (erro) return reply.code(400).send({ erro });
    await prisma.catalogoConfig.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
    avisar();
    return { ok: true };
  });

  // quantidade: inteiro >= 0, ou null pra tirar o controle de estoque do prato.
  fastify.put("/api/catalogo/estoque/:itemId", { onRequest: fastify.exigirAdmin }, async (request, reply) => {
    const { itemId } = request.params;
    const { quantidade } = request.body || {};
    if (itemId.length > 40 || !(quantidade === null || (Number.isInteger(quantidade) && quantidade >= 0 && quantidade <= 100000))) {
      return reply.code(400).send({ erro: "Estoque inválido" });
    }
    if (quantidade === null) await prisma.estoquePrato.deleteMany({ where: { itemId } });
    else await prisma.estoquePrato.upsert({ where: { itemId }, create: { itemId, quantidade }, update: { quantidade } });
    avisar();
    return { ok: true };
  });
}
