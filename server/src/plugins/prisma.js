import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

// Singleton do PrismaClient decorado em `fastify.prisma`, desconectado
// quando o servidor fecha (fastify.close(), Ctrl+C).
export default fp(async function prismaPlugin(fastify) {
  const prisma = new PrismaClient();
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
