// Seed opcional: 1 conta de demonstração, no mesmo espírito do seed do
// painel admin (admin@casadopato.com/senha123 em tnm_admin_funcionarios).
import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../src/lib/senha.js";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@casadopato.com";
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.log("Conta demo já existe:", email);
    return;
  }
  const senhaHash = await hashSenha("senha123");
  await prisma.user.create({ data: { nome: "Cliente Demo", email, senhaHash } });
  console.log("Conta demo criada:", email, "/ senha123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
