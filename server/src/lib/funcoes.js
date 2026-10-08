import { Prisma } from "@prisma/client";

// Funções padrão do painel admin (a "admin" é a única com acesso total e não
// pode ser editada nem apagada) e o formato público de um funcionário — nunca
// devolve `senhaHash`.
export const FUNCOES_PADRAO = [
  { id: "admin", label: "Administrador", secoesPadrao: null },
  { id: "cozinha", label: "Cozinha", secoesPadrao: ["cozinha"] },
  { id: "pdv", label: "PDV", secoesPadrao: ["pdv"] },
  { id: "garcom", label: "Garçom", secoesPadrao: ["mesas"] },
];

// Idempotente: só cria as que faltam (skipDuplicates), não sobrescreve edição.
export async function garantirFuncoesPadrao(prisma) {
  await prisma.funcao.createMany({
    data: FUNCOES_PADRAO.map((f) => ({ ...f, secoesPadrao: f.secoesPadrao ?? Prisma.DbNull })),
    skipDuplicates: true,
  });
}

export function serializarFuncionario(f) {
  return {
    id: f.id,
    nome: f.nome,
    usuario: f.usuario,
    funcao: f.funcao,
    secoesPermitidas: f.secoesPermitidas ?? null,
  };
}
