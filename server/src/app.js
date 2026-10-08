import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import adminPlugin from "./plugins/admin.js";
import prismaPlugin from "./plugins/prisma.js";
import sessionPlugin from "./plugins/session.js";
import socketsPlugin from "./plugins/sockets.js";
import staticFrontendPlugin from "./plugins/staticFrontend.js";
import authRoutes from "./routes/auth.js";
import comprasRoutes from "./routes/compras.js";
import equipeRoutes from "./routes/equipe.js";
import estoqueRoutes from "./routes/estoque.js";
import financeiroRoutes from "./routes/financeiro.js";
import garcomRoutes from "./routes/garcom.js";
import grupoRoutes from "./routes/grupo.js";
import iaRoutes from "./routes/ia.js";
import pedidosRoutes from "./routes/pedidos.js";

// Fastify instance sozinha, sem `.listen()` — deixa server.js decidir a
// porta, e permite testar/inspecionar a instância sem abrir rede de verdade.
export async function buildApp() {
  // Em produção (Render) há 1 proxy na frente: sem isso request.ip seria o IP do
  // proxy pra todo mundo e o rate limit viraria um balde só. `1` confia só no
  // último salto (não dá pra forjar X-Forwarded-For). Fora de produção, não confia em nada.
  const fastify = Fastify({ logger: true, trustProxy: process.env.NODE_ENV === "production" ? 1 : false });

  // 5xx nunca vaza mensagem interna (Prisma/stack) pro cliente; 4xx (corpo
  // inválido, rate limit) devolve a mensagem no formato { erro } que o front lê.
  fastify.setErrorHandler((err, request, reply) => {
    const status = err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) request.log.error(err);
    reply.code(status).send({ erro: status === 500 ? "Erro interno do servidor" : err.erro || err.message });
  });

  // Teto global generoso (o app faz polling a cada 3s); rotas sensíveis
  // apertam via `config.rateLimit` na própria rota.
  await fastify.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    errorResponseBuilder: (request, ctx) => ({
      statusCode: 429,
      erro: `Muitas requisições. Tente de novo em ${Math.ceil(ctx.ttl / 1000)}s.`,
    }),
  });

  await fastify.register(prismaPlugin);
  await fastify.register(sessionPlugin);
  await fastify.register(adminPlugin);
  await fastify.register(socketsPlugin); // precisa vir antes das rotas (elas usam fastify.io)

  await fastify.register(authRoutes);
  await fastify.register(pedidosRoutes);
  await fastify.register(garcomRoutes);
  await fastify.register(grupoRoutes);
  await fastify.register(iaRoutes);
  await fastify.register(estoqueRoutes);
  await fastify.register(comprasRoutes);
  await fastify.register(financeiroRoutes);
  await fastify.register(equipeRoutes);

  // Em dev, o Vite serve o front (React + admin.html) e faz proxy de /api e
  // /socket.io pra este servidor — ver vite.config.js. Em produção não há
  // Vite rodando, então este mesmo processo assume servir o build também.
  if (process.env.NODE_ENV === "production") {
    await fastify.register(staticFrontendPlugin);
  }

  return fastify;
}
