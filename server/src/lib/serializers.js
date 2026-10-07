// Converte linhas do Prisma pro shape JSON exato que o front-end (React) e o
// admin.html já esperam hoje (mesmos nomes de campo que tinham em
// localStorage) — ver CLAUDE.md, "Estado global — AppContext.jsx" e
// "Integração com o painel administrativo".
import {
  formatarIdChamada,
  formatarIdCompra,
  formatarIdContaPagar,
  formatarIdContaReceber,
  formatarIdInsumo,
  formatarIdMovimento,
  formatarIdPedido,
} from "./ids.js";

// Prisma devolve campos Decimal como objetos (Decimal.js), não number puro —
// converte pra Number antes de mandar pro front (senão vira string estranha
// no JSON, ex. "42.5" em vez de 42.5). null/undefined passam direto.
function numero(decimal) {
  return decimal == null ? decimal : Number(decimal);
}

export function serializarPedido(order) {
  return {
    id: formatarIdPedido(order.seq),
    criadoEm: order.criadoEm.getTime(),
    itens: order.itens,
    total: numero(order.total),
    cupom: order.cupom,
    cashbackUsado: numero(order.cashbackUsado),
    clienteEmail: order.clienteEmail,
    tipo: order.tipo,
    mesa: order.mesa,
    endereco: order.endereco,
    agendamento: order.agendamento,
    pagamento: order.pagamento,
    divisao: order.divisao,
    observacoes: order.observacoes,
    avaliado: order.avaliado,
    grupo: order.grupoSnapshot,
    statusManual: order.statusManual,
    _canceladoAdmin: order.canceladoAdmin,
    origem: order.origem,
    taxaEntrega: numero(order.taxaEntrega),
    caixaId: order.caixaId,
  };
}

// Versão enxuta pra fila pública (GET /api/pedidos/fila) — não expõe itens/
// endereço/observações de outros clientes, só o suficiente pra
// utils/pedidos.js#estimarTempoFila calcular quantos pedidos estão "na
// frente".
export function serializarPedidoFila(order) {
  return {
    id: formatarIdPedido(order.seq),
    criadoEm: order.criadoEm.getTime(),
    tipo: order.tipo,
    statusManual: order.statusManual,
    _canceladoAdmin: order.canceladoAdmin,
  };
}

export function serializarChamada(call) {
  return {
    id: formatarIdChamada(call.seq),
    mesa: call.mesa,
    motivo: call.motivo,
    criadoEm: call.criadoEm.getTime(),
    atendidoEm: call.atendidoEm ? call.atendidoEm.getTime() : null,
    atendidoPor: call.atendidoPor,
    notaCliente: call.notaCliente,
  };
}

export function serializarItemGrupo(it) {
  return {
    id: it.id,
    itemId: it.itemId,
    qtd: it.qtd,
    addons: it.addons,
    ingredientesRemovidos: it.ingredientesRemovidos,
    precoUnitario: numero(it.precoUnitario),
    participanteId: it.participanteId,
    participanteNome: it.participanteNome,
  };
}

export function serializarGrupo(group) {
  return {
    codigo: group.codigo,
    criadoEm: group.criadoEm.getTime(),
    participantes: group.participantes.map((p) => ({ id: p.id, nome: p.nome })),
    itens: group.itens.map(serializarItemGrupo),
  };
}

// ===== ERP =====

export function serializarInsumo(insumo) {
  return {
    id: formatarIdInsumo(insumo.seq),
    nome: insumo.nome,
    unidade: insumo.unidade,
    estoqueAtual: numero(insumo.estoqueAtual),
    estoqueMinimo: numero(insumo.estoqueMinimo),
    custoUnitario: numero(insumo.custoUnitario),
    ativo: insumo.ativo,
    criadoEm: insumo.criadoEm.getTime(),
    fornecedorPadraoId: insumo.fornecedorPadraoId,
  };
}

export function serializarMovimento(mov) {
  return {
    id: formatarIdMovimento(mov.seq),
    insumoId: formatarIdInsumo(mov.insumoId),
    tipo: mov.tipo,
    quantidade: numero(mov.quantidade),
    motivo: mov.motivo,
    criadoEm: mov.criadoEm.getTime(),
  };
}

export function serializarFornecedor(f) {
  return {
    id: f.id,
    nome: f.nome,
    documento: f.documento,
    telefone: f.telefone,
    email: f.email,
    endereco: f.endereco,
    ativo: f.ativo,
    criadoEm: f.criadoEm.getTime(),
  };
}

export function serializarItemCompra(it) {
  return {
    id: it.id,
    insumoId: formatarIdInsumo(it.insumoId),
    quantidade: numero(it.quantidade),
    precoUnitario: numero(it.precoUnitario),
  };
}

export function serializarCompra(compra) {
  return {
    id: formatarIdCompra(compra.seq),
    fornecedorId: compra.fornecedorId,
    status: compra.status,
    total: numero(compra.total),
    observacoes: compra.observacoes,
    criadoEm: compra.criadoEm.getTime(),
    recebidoEm: compra.recebidoEm ? compra.recebidoEm.getTime() : null,
    itens: (compra.itens || []).map(serializarItemCompra),
  };
}

export function serializarContaPagar(conta) {
  return {
    id: formatarIdContaPagar(conta.seq),
    descricao: conta.descricao,
    categoria: conta.categoria,
    fornecedorId: conta.fornecedorId,
    compraId: conta.compraId != null ? formatarIdCompra(conta.compraId) : null,
    valor: numero(conta.valor),
    vencimento: conta.vencimento.getTime(),
    pagoEm: conta.pagoEm ? conta.pagoEm.getTime() : null,
    status: conta.status,
    criadoEm: conta.criadoEm.getTime(),
  };
}

export function serializarContaReceber(conta) {
  return {
    id: formatarIdContaReceber(conta.seq),
    descricao: conta.descricao,
    clienteNome: conta.clienteNome,
    valor: numero(conta.valor),
    vencimento: conta.vencimento.getTime(),
    recebidoEm: conta.recebidoEm ? conta.recebidoEm.getTime() : null,
    status: conta.status,
    criadoEm: conta.criadoEm.getTime(),
  };
}
