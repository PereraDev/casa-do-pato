-- CreateTable
CREATE TABLE "Insumo" (
    "seq" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "estoqueAtual" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "estoqueMinimo" DECIMAL(10,3),
    "custoUnitario" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fornecedorPadraoId" TEXT,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "seq" SERIAL NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "seq" SERIAL NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "total" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recebidoEm" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "compraId" INTEGER NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaPagar" (
    "seq" SERIAL NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "fornecedorId" TEXT,
    "compraId" INTEGER,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaPagar_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "ContaReceber" (
    "seq" SERIAL NOT NULL,
    "descricao" TEXT NOT NULL,
    "clienteNome" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "recebidoEm" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaReceber_pkey" PRIMARY KEY ("seq")
);

-- CreateIndex
CREATE INDEX "Insumo_fornecedorPadraoId_idx" ON "Insumo"("fornecedorPadraoId");

-- CreateIndex
CREATE INDEX "RecipeItem_itemId_idx" ON "RecipeItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_itemId_insumoId_key" ON "RecipeItem"("itemId", "insumoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_insumoId_idx" ON "MovimentoEstoque"("insumoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_criadoEm_idx" ON "MovimentoEstoque"("criadoEm");

-- CreateIndex
CREATE INDEX "PurchaseOrder_fornecedorId_idx" ON "PurchaseOrder"("fornecedorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_criadoEm_idx" ON "PurchaseOrder"("criadoEm");

-- CreateIndex
CREATE INDEX "PurchaseItem_compraId_idx" ON "PurchaseItem"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "ContaPagar_compraId_key" ON "ContaPagar"("compraId");

-- CreateIndex
CREATE INDEX "ContaPagar_vencimento_idx" ON "ContaPagar"("vencimento");

-- CreateIndex
CREATE INDEX "ContaPagar_fornecedorId_idx" ON "ContaPagar"("fornecedorId");

-- CreateIndex
CREATE INDEX "ContaReceber_vencimento_idx" ON "ContaReceber"("vencimento");

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_fornecedorPadraoId_fkey" FOREIGN KEY ("fornecedorPadraoId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("seq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("seq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "PurchaseOrder"("seq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("seq") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "PurchaseOrder"("seq") ON DELETE SET NULL ON UPDATE CASCADE;
