-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "estrelas" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "foto" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Avaliacao_itemId_criadoEm_idx" ON "Avaliacao"("itemId", "criadoEm");
