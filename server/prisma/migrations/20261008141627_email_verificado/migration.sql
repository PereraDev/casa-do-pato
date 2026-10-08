-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificadoEm" TIMESTAMP(3);

-- Contas criadas antes da verificação de e-mail continuam valendo: marca como confirmadas
-- (senão ninguém conseguiria entrar quando o envio de e-mail for ligado).
UPDATE "User" SET "emailVerificadoEm" = NOW();
