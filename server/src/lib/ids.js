// Formata os PKs numéricos do Prisma (`seq`) no mesmo formato de id que o
// front-end já espera ("PD-1234", "CG-1234") — ver utils/pedidos.js e
// AppContext.jsx#montarPedidoPendente no app cliente.
export function formatarIdPedido(seq) {
  return "PD-" + seq;
}

export function formatarIdChamada(seq) {
  return "CG-" + seq;
}

// ERP — mesmo padrão acima; Fornecedor/PurchaseItem/RecipeItem usam cuid()
// como id opaco direto (igual User/GroupParticipant), sem formatador.
export function formatarIdInsumo(seq) {
  return "IN-" + seq;
}

export function formatarIdMovimento(seq) {
  return "MV-" + seq;
}

export function formatarIdCompra(seq) {
  return "CP-" + seq;
}

export function formatarIdContaPagar(seq) {
  return "CT-" + seq;
}

export function formatarIdContaReceber(seq) {
  return "CR-" + seq;
}

// Extrai o número de um id formatado (ex.: "PD-1234" -> 1234), usado pelas
// rotas que recebem :id na URL.
export function seqDoId(id) {
  const n = Number(String(id).split("-")[1]);
  return Number.isInteger(n) ? n : null;
}
