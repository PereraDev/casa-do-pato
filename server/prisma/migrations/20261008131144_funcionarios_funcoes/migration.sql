-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "secoesPermitidas" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcao" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "secoesPadrao" JSONB,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_usuario_key" ON "Funcionario"("usuario");
