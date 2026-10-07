-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "seq" SERIAL NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusManual" TEXT,
    "canceladoAdmin" BOOLEAN NOT NULL DEFAULT false,
    "clienteEmail" TEXT,
    "userId" TEXT,
    "guestId" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "tipo" TEXT NOT NULL,
    "mesa" TEXT,
    "endereco" TEXT,
    "origem" TEXT,
    "taxaEntrega" DECIMAL(10,2),
    "caixaId" TEXT,
    "pagamento" TEXT NOT NULL,
    "cupom" TEXT,
    "cashbackUsado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "avaliado" BOOLEAN NOT NULL DEFAULT false,
    "itens" JSONB NOT NULL,
    "divisao" JSONB,
    "agendamento" JSONB,
    "grupoSnapshot" JSONB,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "WaiterCall" (
    "seq" SERIAL NOT NULL,
    "mesa" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidoEm" TIMESTAMP(3),
    "atendidoPor" JSONB,
    "notaCliente" INTEGER,

    CONSTRAINT "WaiterCall_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "GroupOrder" (
    "codigo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupOrder_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "GroupParticipant" (
    "id" TEXT NOT NULL,
    "grupoCodigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupItem" (
    "id" TEXT NOT NULL,
    "grupoCodigo" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtd" INTEGER NOT NULL,
    "addons" JSONB NOT NULL,
    "ingredientesRemovidos" JSONB NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "participanteId" TEXT,
    "participanteNome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_guestId_idx" ON "Order"("guestId");

-- CreateIndex
CREATE INDEX "Order_criadoEm_idx" ON "Order"("criadoEm");

-- CreateIndex
CREATE INDEX "GroupParticipant_grupoCodigo_idx" ON "GroupParticipant"("grupoCodigo");

-- CreateIndex
CREATE INDEX "GroupItem_grupoCodigo_idx" ON "GroupItem"("grupoCodigo");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupParticipant" ADD CONSTRAINT "GroupParticipant_grupoCodigo_fkey" FOREIGN KEY ("grupoCodigo") REFERENCES "GroupOrder"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupItem" ADD CONSTRAINT "GroupItem_grupoCodigo_fkey" FOREIGN KEY ("grupoCodigo") REFERENCES "GroupOrder"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
