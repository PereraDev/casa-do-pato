-- CreateTable
CREATE TABLE "CatalogoConfig" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoConfig_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "EstoquePrato" (
    "itemId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "EstoquePrato_pkey" PRIMARY KEY ("itemId")
);
