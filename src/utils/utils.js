import { useEffect, useState } from "react";
import { io } from "socket.io-client";

/* ==========================================================================
   Helpers de localStorage — compartilhados por fidelidade/engajamento/
   carteira/reservas (todos 100% client-side, sem back-end pra essas partes,
   ver CLAUDE.md). Antes cada módulo tinha sua própria cópia idêntica; agora
   que estão todos no mesmo arquivo, ficam só uma vez.
   ========================================================================== */
function ler(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function salvar(key, value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

/* ==========================================================================
   Cliente HTTP fino pro back-end (server/) — só usado pelas 4 fatias que
   migraram pra lá (auth, pedidos, garçom, grupo); o resto do app continua
   em localStorage (ver CLAUDE.md). `credentials: "include"` garante que o
   cookie de sessão (tnm_sessao) viaje em toda request.
   ========================================================================== */
export class ApiError extends Error {
  constructor(mensagem, status, dados = null) {
    super(mensagem);
    this.status = status;
    this.dados = dados; // corpo JSON da resposta de erro (ex.: { precisaVerificar: true })
  }
}

export async function apiFetch(path, { method = "GET", body } = {}) {
  const resp = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const texto = await resp.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    if (!resp.ok) throw new ApiError("Erro de comunicação com o servidor", resp.status);
    throw new ApiError("Resposta inválida do servidor", resp.status);
  }
  if (!resp.ok) {
    throw new ApiError(dados?.erro || "Erro de comunicação com o servidor", resp.status, dados);
  }
  return dados;
}

/* ==========================================================================
   Singleton do cliente Socket.IO — uma única conexão pra vida toda da aba,
   sobrevive a re-renders do AppProvider (mesmo padrão de pedidosRef/
   toastTimerRef em AppContext.jsx). Em dev, o Vite faz proxy de /socket.io
   pro back-end (ver vite.config.js); em produção é o mesmo processo.
   ========================================================================== */
export const socket = io({ path: "/socket.io" });

/* ==========================================================================
   useState que sincroniza automaticamente com uma chave do localStorage,
   lendo o valor salvo na primeira renderização e regravando a cada mudança.
   `serialize`/`deserialize` deixam de ser JSON puro quando o valor guardado
   é uma string crua (ex.: "tnm_tipo_pedido"), que não usa JSON.stringify.
   ========================================================================== */
export function useLocalStorageState(
  chave,
  valorInicial,
  { serialize = JSON.stringify, deserialize = JSON.parse } = {},
) {
  const [valor, setValor] = useState(() => {
    const salvo = localStorage.getItem(chave);
    if (salvo === null) return valorInicial;
    try {
      return deserialize(salvo);
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    localStorage.setItem(chave, serialize(valor));
  }, [chave, valor, serialize]);

  return [valor, setValor];
}

// Variante pra valores que já são string (sem aspas de JSON), como os
// campos de texto do carrinho (tipo de pedido, mesa, endereço, observações).
export function useLocalStorageString(chave, valorInicial) {
  return useLocalStorageState(chave, valorInicial, {
    serialize: (v) => String(v),
    deserialize: (v) => v,
  });
}

/* ==========================================================================
   Formatação — moeda e preço vigente de um item.
   ========================================================================== */
// Formata um número como moeda brasileira (R$ 1.234,56).
export const fmt = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Preço "vigente" de um item: usa o promocional só quando ele existe e é
// menor que o preço cheio (mesma regra usada nos cards e na ficha do produto).
export function precoBase(item) {
  return item.precoPromo != null && item.precoPromo < item.preco
    ? item.precoPromo
    : item.preco;
}

/* ==========================================================================
   Senha — espelha a política mínima do back-end (ver server/src/lib/senha.js
   — SEMPRE a fonte da verdade, isso aqui só dá feedback antes de enviar) e
   classifica visualmente pra alimentar o medidor de força no formulário de
   cadastro/redefinição (ver AccountSheet.jsx#MedidorForcaSenha).
   ========================================================================== */
export function motivoSenhaFraca(senha) {
  if (!senha || senha.length < 8) return "Pelo menos 8 caracteres";
  if (!/[a-zA-Z]/.test(senha)) return "Pelo menos 1 letra";
  if (!/[0-9]/.test(senha)) return "Pelo menos 1 número";
  return null;
}

export function forcaSenha(senha) {
  if (!senha) return { nivel: "vazia", label: "" };
  if (motivoSenhaFraca(senha)) return { nivel: "fraca", label: "Fraca" };
  const variada =
    /[a-z]/.test(senha) && /[A-Z]/.test(senha) && /[0-9]/.test(senha) && senha.length >= 12;
  const boa = senha.length >= 10 || /[^a-zA-Z0-9]/.test(senha);
  if (variada) return { nivel: "forte", label: "Forte" };
  if (boa) return { nivel: "media", label: "Média" };
  return { nivel: "ok", label: "Ok" };
}

/* ==========================================================================
   Hash de senha forte 100% no navegador (PBKDF2-SHA256 via Web Crypto API,
   nativo — sem dependência nenhuma) — usado pelo PIN da carteira (ver seção
   Carteira abaixo). Não dá pra usar bcrypt de verdade aqui porque essa parte
   do app não tem back-end (fidelidade/carteira continuam 100% localStorage,
   ver CLAUDE.md); PBKDF2 com salt aleatório por registro e iterações altas é
   a alternativa forte equivalente disponível no browser — mesmo espírito do
   bcrypt (cost 12) que protege a senha de login no servidor (ver
   server/src/lib/senha.js), nunca texto puro.
   ========================================================================== */
const ITERACOES = 210000; // piso recomendado (OWASP, 2023+) pra PBKDF2-SHA256
const TAMANHO_HASH_BITS = 256;

function bufParaHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexParaBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function hashForte(texto) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(texto),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERACOES, hash: "SHA-256" },
    chave,
    TAMANHO_HASH_BITS,
  );
  return { hash: bufParaHex(bits), salt: bufParaHex(salt), iteracoes: ITERACOES };
}

export async function conferirHashForte(texto, registro) {
  if (!registro?.hash || !registro?.salt) return false;
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(texto),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexParaBuf(registro.salt),
      iterations: registro.iteracoes || ITERACOES,
      hash: "SHA-256",
    },
    chave,
    TAMANHO_HASH_BITS,
  );
  return bufParaHex(bits) === registro.hash;
}

/* ==========================================================================
   Clube de fidelidade + cashback (protótipo de TCC). Só funciona pra quem
   está logado (sessao.tipo === "usuario") — um pedido feito como visitante
   não tem e-mail pra vincular pontos/cashback (ver AppContext#finalizarPedido
   e AppContext#montarPedidoPendente, campo `clienteEmail`).
   //
   `tnm_admin_fidelidade_config` é editado pelo painel admin (pontos por
   real, validade dos pontos, % de cashback, níveis e catálogo de
   recompensas). `tnm_fidelidade` é o "extrato" por conta (chaveado por
   e-mail, igual tnm_reviews_user) — escrito tanto pelo cliente (ganhos ao
   comprar, resgates, uso de cashback) quanto pelo admin (ajustes manuais).
   //
   Pontos vencem: cada compra gera um "lote" com validade própria
   (`validoAte`); resgates e ajustes negativos consomem primeiro os lotes
   mais antigos ainda válidos (FIFO). `pontosVitalicios` nunca diminui — é a
   soma histórica de tudo que a conta já ganhou, usada só pra calcular o
   nível (bronze/prata/ouro), não o saldo gastável.
   ========================================================================== */
export const NIVEIS_PADRAO = [
  { id: "bronze", nome: "Bronze", minPontosVitalicios: 0, multiplicador: 1 },
  { id: "prata", nome: "Prata", minPontosVitalicios: 500, multiplicador: 1.2 },
  { id: "ouro", nome: "Ouro", minPontosVitalicios: 1500, multiplicador: 1.5 },
];

export const CONFIG_PADRAO = {
  pontosPorReal: 1,
  validadePontosDias: 90,
  cashbackPct: 5,
  niveis: NIVEIS_PADRAO,
  recompensas: [
    { id: "rc-fritas", nome: "Batata Frita Média grátis", custoPontos: 300 },
    { id: "rc-refri", nome: "Refrigerante Lata grátis", custoPontos: 150 },
    { id: "rc-desc10", nome: "R$ 10 de desconto", custoPontos: 500 },
  ],
};

export function getConfigFidelidade() {
  const salva = ler("tnm_admin_fidelidade_config", {});
  return { ...CONFIG_PADRAO, ...salva, niveis: salva.niveis?.length ? salva.niveis : NIVEIS_PADRAO };
}

function contaVazia() {
  return { pontosLotes: [], pontosVitalicios: 0, cashback: 0, historico: [] };
}

export function getContaFidelidade(email) {
  if (!email) return contaVazia();
  const todas = ler("tnm_fidelidade", {});
  return todas[email] || contaVazia();
}

function salvarConta(email, conta) {
  const todas = ler("tnm_fidelidade", {});
  todas[email] = conta;
  salvar("tnm_fidelidade", todas);
}

export function getNivel(pontosVitalicios, niveis) {
  const lista = niveis?.length ? niveis : NIVEIS_PADRAO;
  const ordenados = [...lista].sort(
    (a, b) => a.minPontosVitalicios - b.minPontosVitalicios,
  );
  const atingidos = ordenados.filter(
    (n) => pontosVitalicios >= n.minPontosVitalicios,
  );
  return atingidos[atingidos.length - 1] || ordenados[0];
}

// Soma só os lotes ainda não expirados — pontos vencidos somem do saldo
// gastável sozinhos, sem precisar de nenhum job/limpeza.
export function saldoPontos(conta) {
  const agora = Date.now();
  return conta.pontosLotes
    .filter((l) => l.validoAte >= agora)
    .reduce((s, l) => s + l.restante, 0);
}

// Pontos que vencem nos próximos `dias` dias (pra avisar o cliente).
export function pontosVencendoEm(conta, dias) {
  const agora = Date.now();
  const limite = agora + dias * 86400000;
  return conta.pontosLotes
    .filter((l) => l.validoAte >= agora && l.validoAte <= limite)
    .reduce((s, l) => s + l.restante, 0);
}

function consumirPontosFIFO(lotes, quantidade) {
  const agora = Date.now();
  let restante = quantidade;
  const copia = [...lotes]
    .sort((a, b) => a.ganhoEm - b.ganhoEm)
    .map((l) => ({ ...l }));
  for (const lote of copia) {
    if (restante <= 0) break;
    if (lote.validoAte < agora || lote.restante <= 0) continue;
    const usar = Math.min(lote.restante, restante);
    lote.restante -= usar;
    restante -= usar;
  }
  return copia;
}

// Chamado quando um pedido de conta logada é finalizado de verdade — credita
// pontos (multiplicados pelo nível calculado ANTES desta compra) e cashback
// sobre o valor efetivamente pago (`totalPedido` já vem líquido de cashback
// usado nesse mesmo pedido, ver AppContext).
export function creditarCompra(email, totalPedido, pedidoId) {
  if (!email || !(totalPedido > 0)) return null;
  const config = getConfigFidelidade();
  const conta = getContaFidelidade(email);
  const nivel = getNivel(conta.pontosVitalicios, config.niveis);
  const pontosGanhos = Math.round(
    totalPedido * config.pontosPorReal * nivel.multiplicador,
  );
  const cashbackGanho = Number(
    (totalPedido * (config.cashbackPct / 100)).toFixed(2),
  );
  const agora = Date.now();

  salvarConta(email, {
    ...conta,
    pontosLotes:
      pontosGanhos > 0
        ? [
            ...conta.pontosLotes,
            {
              qtd: pontosGanhos,
              restante: pontosGanhos,
              ganhoEm: agora,
              validoAte: agora + config.validadePontosDias * 86400000,
            },
          ]
        : conta.pontosLotes,
    pontosVitalicios: conta.pontosVitalicios + pontosGanhos,
    cashback: Number((conta.cashback + cashbackGanho).toFixed(2)),
    historico: [
      ...conta.historico,
      {
        tipo: "compra",
        pontos: pontosGanhos,
        cashback: cashbackGanho,
        pedidoId,
        em: agora,
      },
    ],
  });
  return { pontosGanhos, cashbackGanho, nivel };
}

// Credita pontos "avulsos" que não vêm de uma compra — bônus de indicação
// (#aplicarCodigoIndicacao) e recompensa de missão semanal completada.
// Mesma regra de validade por lote das compras normais.
export function creditarPontosBonus(email, pontos, motivo) {
  if (!email || !(pontos > 0)) return;
  const config = getConfigFidelidade();
  const conta = getContaFidelidade(email);
  const agora = Date.now();
  salvarConta(email, {
    ...conta,
    pontosLotes: [
      ...conta.pontosLotes,
      {
        qtd: pontos,
        restante: pontos,
        ganhoEm: agora,
        validoAte: agora + config.validadePontosDias * 86400000,
      },
    ],
    pontosVitalicios: conta.pontosVitalicios + pontos,
    historico: [
      ...conta.historico,
      { tipo: "bonus", pontos, motivo, em: agora },
    ],
  });
}

// Troca pontos por uma recompensa do catálogo (config do admin) — consome os
// lotes mais antigos primeiro (FIFO, ver consumirPontosFIFO acima).
export function resgatarRecompensa(email, recompensaId) {
  const config = getConfigFidelidade();
  const recompensa = config.recompensas.find((r) => r.id === recompensaId);
  if (!recompensa) return { ok: false, erro: "Recompensa não encontrada." };
  const conta = getContaFidelidade(email);
  if (saldoPontos(conta) < recompensa.custoPontos) {
    return { ok: false, erro: "Pontos insuficientes para essa recompensa." };
  }
  const lotes = consumirPontosFIFO(conta.pontosLotes, recompensa.custoPontos);
  salvarConta(email, {
    ...conta,
    pontosLotes: lotes,
    historico: [
      ...conta.historico,
      {
        tipo: "resgate",
        pontos: -recompensa.custoPontos,
        recompensa: recompensa.nome,
        em: Date.now(),
      },
    ],
  });
  return { ok: true, recompensa };
}

// Recarga manual de saldo (carteira) — cliente "adiciona saldo" por conta
// própria, ao contrário do cashback normal que só é creditado por compra.
// Cai no mesmo campo `cashback` (é o mesmo saldo gastável no carrinho),
// só entra separado no extrato pra diferenciar a origem.
export function adicionarSaldoCarteira(email, valor) {
  if (!email || !(valor > 0)) return null;
  const conta = getContaFidelidade(email);
  const valorArred = Number(valor.toFixed(2));
  salvarConta(email, {
    ...conta,
    cashback: Number((conta.cashback + valorArred).toFixed(2)),
    historico: [
      ...conta.historico,
      { tipo: "recarga", cashback: valorArred, em: Date.now() },
    ],
  });
  return valorArred;
}

// Crédito de vale-presente resgatado (ver seção Carteira abaixo) — cai no
// mesmo saldo gastável do cashback, só entra separado no extrato pra
// diferenciar a origem (igual à recarga manual).
export function creditarValePresente(email, valor, codigo) {
  if (!email || !(valor > 0)) return null;
  const conta = getContaFidelidade(email);
  const valorArred = Number(valor.toFixed(2));
  salvarConta(email, {
    ...conta,
    cashback: Number((conta.cashback + valorArred).toFixed(2)),
    historico: [
      ...conta.historico,
      { tipo: "vale-presente-resgatado", cashback: valorArred, codigo, em: Date.now() },
    ],
  });
  return valorArred;
}

// Só registra no extrato de quem CRIOU o vale-presente, pra transparência —
// não mexe no saldo dele. O valor do vale-presente é uma "impressão"
// simulada pro presenteado, não descontada de quem presenteia, mesmo
// espírito sem gateway real de `adicionarSaldoCarteira` acima.
export function registrarValePresenteComprado(email, valor, codigo) {
  if (!email) return;
  const conta = getContaFidelidade(email);
  salvarConta(email, {
    ...conta,
    historico: [
      ...conta.historico,
      { tipo: "vale-presente-comprado", valor: Number(valor.toFixed(2)), codigo, em: Date.now() },
    ],
  });
}

// Debita do saldo de cashback (usado como desconto no carrinho). Retorna o
// valor efetivamente usado (nunca mais que o saldo disponível).
export function usarCashback(email, valor) {
  const conta = getContaFidelidade(email);
  const valorUsado = Math.min(conta.cashback, valor);
  if (valorUsado <= 0) return 0;
  salvarConta(email, {
    ...conta,
    cashback: Number((conta.cashback - valorUsado).toFixed(2)),
    historico: [
      ...conta.historico,
      { tipo: "uso-cashback", cashback: -valorUsado, em: Date.now() },
    ],
  });
  return valorUsado;
}

/* ==========================================================================
   Engajamento — funcionalidades que não são "pontos por compra" nem
   "cashback": indique um amigo, missão semanal, oferta personalizada por
   comportamento e o clube de assinatura (Casa do Pato+). Usam
   creditarPontosBonus (fidelidade, acima) quando precisam creditar algo.
   ========================================================================== */

// Indique um amigo — código curto e determinístico por e-mail (não precisa
// de cadastro prévio: o código só "nasce" registrado em
// tnm_codigos_indicacao na primeira vez que alguém olha pro próprio código).
function hashCurto(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(5, "0").slice(-5);
}

export function getCodigoIndicacao(email) {
  const mapa = ler("tnm_codigos_indicacao", {});
  const codigo = "AMG-" + hashCurto(email.toLowerCase());
  if (mapa[codigo] !== email) {
    mapa[codigo] = email;
    salvar("tnm_codigos_indicacao", mapa);
  }
  return codigo;
}

export function totalIndicados(email) {
  const usos = ler("tnm_indicacoes", []);
  return usos.filter((u) => u.indicadorEmail === email).length;
}

// +100 pts pra quem indicou, +50 pts de boas-vindas pra quem usou o código —
// cada e-mail só pode usar um código de indicação 1 vez na vida.
export function aplicarCodigoIndicacao(codigoBruto, novoEmail) {
  const codigo = (codigoBruto || "").trim().toUpperCase();
  if (!codigo) return { ok: false, erro: "Informe um código." };
  const mapa = ler("tnm_codigos_indicacao", {});
  const indicadorEmail = mapa[codigo];
  if (!indicadorEmail) return { ok: false, erro: "Código de indicação inválido." };
  if (indicadorEmail === novoEmail) {
    return { ok: false, erro: "Você não pode usar seu próprio código." };
  }
  const usos = ler("tnm_indicacoes", []);
  if (usos.some((u) => u.indicadoEmail === novoEmail)) {
    return { ok: false, erro: "Você já usou um código de indicação antes." };
  }
  usos.push({ codigo, indicadorEmail, indicadoEmail: novoEmail, em: Date.now() });
  salvar("tnm_indicacoes", usos);
  creditarPontosBonus(indicadorEmail, 100, "Indicou um amigo");
  creditarPontosBonus(novoEmail, 50, "Bônus de boas-vindas por indicação");
  return { ok: true };
}

// Missão semanal — "peça N vezes essa semana". Uma missão fixa (ao vivo dá
// pra virar catálogo rotativo, mas o protótipo mantém 1 só, sempre visível
// no Clube de Fidelidade). Progresso é calculado direto de `tnm_pedidos`
// (sem estado próprio); só o resgate final fica marcado, pra não creditar
// 2x a mesma semana.
export const MISSAO_SEMANAL = {
  id: "pedidos-semana",
  titulo: "Cliente fiel da semana",
  descricao: "Peça 2 vezes essa semana e ganhe pontos bônus.",
  meta: 2,
  recompensaPontos: 30,
};

function inicioSemana() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function progressoMissaoSemanal(email, pedidos) {
  const inicio = inicioSemana();
  const doUsuario = pedidos.filter(
    (p) => p.clienteEmail === email && p.criadoEm >= inicio && !p._canceladoAdmin,
  );
  const chaveResgate = email + ":" + inicio;
  const resgatadas = ler("tnm_missoes_resgatadas", []);
  return {
    progresso: Math.min(doUsuario.length, MISSAO_SEMANAL.meta),
    meta: MISSAO_SEMANAL.meta,
    completa: doUsuario.length >= MISSAO_SEMANAL.meta,
    jaResgatou: resgatadas.includes(chaveResgate),
    chaveResgate,
  };
}

export function resgatarMissaoSemanal(email, chaveResgate) {
  const resgatadas = ler("tnm_missoes_resgatadas", []);
  if (resgatadas.includes(chaveResgate)) return false;
  creditarPontosBonus(email, MISSAO_SEMANAL.recompensaPontos, MISSAO_SEMANAL.titulo);
  salvar("tnm_missoes_resgatadas", [...resgatadas, chaveResgate]);
  return true;
}

// Oferta personalizada — cupom automático de reengajamento quando o cliente
// fica alguns dias sem pedir (estilo "sentimos sua falta" do McDonald's/
// iFood). Regra única e simples de propósito: é um protótipo, não um motor
// de recomendação.
export function getOfertaPersonalizada(email, pedidos) {
  const doUsuario = pedidos.filter((p) => p.clienteEmail === email && !p._canceladoAdmin);
  if (!doUsuario.length) return null;
  const ultimo = Math.max(...doUsuario.map((p) => p.criadoEm));
  const diasSemComprar = Math.floor((Date.now() - ultimo) / 86400000);
  if (diasSemComprar < 3) return null;
  return {
    id: "reengajamento",
    titulo: "Sentimos sua falta! 🍔",
    texto:
      `Já faz ${diasSemComprar} dia(s) desde seu último pedido — ` +
      "15% de desconto só por hoje.",
    cupom: { codigo: "VOLTEI15", tipo: "pct", valor: 15, label: "15% de desconto (oferta personalizada)" },
  };
}

// Clube de assinatura (Casa do Pato+) — mensalidade simulada, dá 10% de
// desconto automático em todo pedido (aplicado no checkout só quando não
// há outro cupom digitado — ver AppContext#calcularDesconto).
export const ASSINATURA_PRECO_MES = 14.9;
export const ASSINATURA_DESCONTO_PCT = 10;

export function getAssinatura(email) {
  const todas = ler("tnm_assinaturas", {});
  return todas[email] || { ativo: false, desde: null };
}

export function definirAssinatura(email, ativo) {
  const todas = ler("tnm_assinaturas", {});
  todas[email] = { ativo, desde: ativo ? todas[email]?.desde || Date.now() : todas[email]?.desde || null };
  salvar("tnm_assinaturas", todas);
}

/* ==========================================================================
   Carteira do cliente: PIN de acesso, cartões salvos (simulados, nunca
   cobram de verdade) e vale-presente (código único, resgatável 1 vez). Tudo
   100% localStorage, no mesmo espírito de fidelidade/cashback acima — o
   back-end (server/) só cobre auth/pedidos/garçom/grupo, ver CLAUDE.md.
   ========================================================================== */

// PIN da carteira — hash forte (PBKDF2, ver acima), nunca texto puro.
// Guardado por e-mail, igual ao resto de fidelidade/carteira.
export function temPinCarteira(email) {
  const todos = ler("tnm_carteira_pin", {});
  return Boolean(todos[email]);
}

export async function definirPinCarteira(email, pin) {
  const todos = ler("tnm_carteira_pin", {});
  todos[email] = await hashForte(pin);
  salvar("tnm_carteira_pin", todos);
}

export async function conferirPinCarteira(email, pin) {
  const todos = ler("tnm_carteira_pin", {});
  return conferirHashForte(pin, todos[email]);
}

// Cartões salvos — só exibição/simulação (sem gateway de pagamento de
// verdade, mesma limitação do resto do checkout, ver CLAUDE.md). Guarda só
// os 4 últimos dígitos, nunca o número completo.
const BANDEIRAS = [
  { prefixo: "4", nome: "Visa" },
  { prefixo: "5", nome: "Mastercard" },
  { prefixo: "3", nome: "Amex" },
  { prefixo: "6", nome: "Elo" },
];
function detectarBandeira(numero) {
  return BANDEIRAS.find((b) => numero.startsWith(b.prefixo))?.nome || "Cartão";
}

export function getCartoesSalvos(email) {
  const todos = ler("tnm_cartoes_salvos", {});
  return todos[email] || [];
}

export function salvarCartao(email, { numero, nomeTitular, validade, apelido }) {
  const numeroLimpo = (numero || "").replace(/\D/g, "");
  if (numeroLimpo.length < 13 || numeroLimpo.length > 19) {
    return { ok: false, erro: "Número de cartão inválido." };
  }
  if (!/^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test((validade || "").trim())) {
    return { ok: false, erro: "Validade inválida — use o formato MM/AA." };
  }
  const todos = ler("tnm_cartoes_salvos", {});
  const cartoes = todos[email] || [];
  const cartao = {
    id: "crt-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    bandeira: detectarBandeira(numeroLimpo),
    final4: numeroLimpo.slice(-4),
    nomeTitular: (nomeTitular || "").trim(),
    validade: (validade || "").trim(),
    apelido: (apelido || "").trim(),
  };
  todos[email] = [...cartoes, cartao];
  salvar("tnm_cartoes_salvos", todos);
  return { ok: true, cartao };
}

export function removerCartao(email, cartaoId) {
  const todos = ler("tnm_cartoes_salvos", {});
  todos[email] = (todos[email] || []).filter((c) => c.id !== cartaoId);
  salvar("tnm_cartoes_salvos", todos);
}

// Vale-presente — a pessoa "compra" (sem gateway real, mesmo espírito de
// adicionarSaldoCarteira acima) e recebe um código único pra compartilhar
// manualmente; quem resgata credita o valor na própria carteira. Guardado
// num registro à parte (não sob a conta de ninguém), porque quem resgata
// pode nem ter conta ainda quando o código foi gerado.
function gerarCodigoValePresente() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I, evita confundir
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const sufixo = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join("");
  return "GFT-" + sufixo;
}

export function comprarValePresente(email, valor, destinatario) {
  if (!email) return { ok: false, erro: "Entre na sua conta pra comprar um vale-presente." };
  if (!(valor > 0)) return { ok: false, erro: "Informe um valor válido." };
  const todos = ler("tnm_vale_presentes", {});
  const codigo = gerarCodigoValePresente();
  const valorArred = Number(valor.toFixed(2));
  todos[codigo] = {
    codigo,
    valor: valorArred,
    deEmail: email,
    destinatario: (destinatario || "").trim(),
    criadoEm: Date.now(),
    resgatadoPor: null,
    resgatadoEm: null,
  };
  salvar("tnm_vale_presentes", todos);
  registrarValePresenteComprado(email, valorArred, codigo);
  return { ok: true, codigo, valor: valorArred };
}

export function resgatarValePresente(email, codigoBruto) {
  const codigo = (codigoBruto || "").trim().toUpperCase();
  if (!codigo) return { ok: false, erro: "Informe o código do vale-presente." };
  const todos = ler("tnm_vale_presentes", {});
  const vale = todos[codigo];
  if (!vale) return { ok: false, erro: "Código de vale-presente inválido." };
  if (vale.resgatadoPor) return { ok: false, erro: "Esse vale-presente já foi resgatado." };
  if (vale.deEmail === email) {
    return { ok: false, erro: "Você não pode resgatar um vale-presente que você mesmo criou." };
  }
  todos[codigo] = { ...vale, resgatadoPor: email, resgatadoEm: Date.now() };
  salvar("tnm_vale_presentes", todos);
  creditarValePresente(email, vale.valor, codigo);
  return { ok: true, valor: vale.valor };
}

export function getValesPresenteCriados(email) {
  const todos = ler("tnm_vale_presentes", {});
  return Object.values(todos)
    .filter((v) => v.deEmail === email)
    .sort((a, b) => b.criadoEm - a.criadoEm);
}

/* ==========================================================================
   Reserva de mesa — só existia como "agendar horário" dentro do carrinho
   (que fazia sentido pra retirada/entrega, não pra quem já tá sentado à
   mesa); virou uma funcionalidade própria do perfil, sem relação com um
   pedido específico. 100% localStorage, mesmo espírito de fidelidade/
   engajamento acima (sem back-end pra isso, ver CLAUDE.md).
   ========================================================================== */
export function getReservas(email) {
  const todas = ler("tnm_reservas", {});
  return (todas[email] || []).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
}

export function criarReserva(email, { data, hora, pessoas, observacao }) {
  if (!email) return { ok: false, erro: "Entre na sua conta pra reservar uma mesa." };
  if (!data || !hora) return { ok: false, erro: "Informe a data e a hora da reserva." };
  const qtdPessoas = Number(pessoas) || 1;
  const todas = ler("tnm_reservas", {});
  const lista = todas[email] || [];
  const reserva = {
    id: "res-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    data,
    hora,
    pessoas: qtdPessoas,
    observacao: (observacao || "").trim(),
    criadaEm: Date.now(),
  };
  todas[email] = [...lista, reserva];
  salvar("tnm_reservas", todas);
  return { ok: true, reserva };
}

export function cancelarReserva(email, reservaId) {
  const todas = ler("tnm_reservas", {});
  todas[email] = (todas[email] || []).filter((r) => r.id !== reservaId);
  salvar("tnm_reservas", todas);
}

/* ==========================================================================
   Configuração e helpers do acompanhamento de pedidos (aba "Pedidos").
   O status é sempre calculado a partir do tempo decorrido desde a criação
   do pedido (statusPedido) — os dados do pedido em si vêm do back-end
   (server/) desde a migração pra pedidos + tempo real, mas o cálculo do
   status continua 100% no cliente (puramente função de `criadoEm`/
   `statusManual`, ver CLAUDE.md).
   ========================================================================== */
export const STATUS_STEPS = [
  { key: "recebido", label: "Recebido" },
  { key: "preparo", label: "Em preparo" },
  { key: "pronto", label: "Pronto" },
  { key: "entregue", label: "Entregue" },
];

export const STATUS_LABEL = {
  recebido: "Recebido",
  preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
};

export const STATUS_ICONE = {
  recebido: "📥",
  preparo: "👨‍🍳",
  pronto: "🔔",
  entregue: "✅",
};

// Mensagem exibida sob o stepper (estilo "Pizza Tracker" do Domino's)
export const STATUS_MENSAGEM = {
  recebido: "Recebemos seu pedido e já vamos confirmar com a cozinha.",
  preparo: "Sua comida está sendo preparada com carinho.",
  pronto: "Pedido pronto! Já está a caminho.",
  entregue: "Pedido entregue. Bom apetite!",
};

export const TIPO_PEDIDO_LABEL = {
  balcao: "Retirar no balcão",
  mesa: "Na mesa",
  entrega: "Entrega",
};

export const PAGAMENTO_LABEL = {
  pix: "Pix",
  cartao: "Cartão (débito/crédito)",
  "cartao-motoboy": "Cartão na maquininha do motoboy",
  dinheiro: "Dinheiro",
  "dinheiro-nota": "Dinheiro (em nota)",
  "dinheiro-carteira": "Saldo da carteira",
  "pendente-garcom": "A pagar — chamando o garçom",
  "pendente-caixa": "A pagar — no caixa",
  dividido: "Dividido",
};

// Conteúdo da tela de checkout (título/ícone/instrução/textos de botão),
// um conjunto por forma de pagamento — ver PixSheet.
export const PAGAMENTO_CHECKOUT = {
  pix: {
    titulo: "Pagamento via Pix",
    icone: "▦ QR Code Pix",
    instrucao:
      "Escaneie o QR Code com o app do seu banco. A confirmação é automática assim que o pagamento é recebido — não é necessário enviar comprovante.",
    botao: "Simular pagamento recebido",
    botaoCarregando: "Confirmando pagamento...",
    toast: "Pagamento confirmado via Pix! ✅",
  },
  cartao: {
    titulo: "Pagamento no cartão",
    icone: "💳 Maquininha",
    instrucao:
      "Aproxime, insira ou passe seu cartão de débito ou crédito na maquininha. A confirmação é automática assim que o pagamento é aprovado.",
    botao: "Simular pagamento aprovado",
    botaoCarregando: "Aprovando pagamento...",
    toast: "Pagamento aprovado no cartão! ✅",
  },
  dinheiro: {
    titulo: "Pagamento em dinheiro",
    icone: "💵 Dinheiro",
    instrucao:
      "Pague em dinheiro ao garçom ou no caixa. A confirmação é automática assim que o recebimento é registrado.",
    botao: "Confirmar recebimento em dinheiro",
    botaoCarregando: "Confirmando recebimento...",
    toast: "Pagamento em dinheiro confirmado! ✅",
  },
};

// Deriva o status de um pedido a partir do tempo decorrido desde a criação —
// puramente uma função do relógio, então basta re-renderizar periodicamente
// (ver useStatusTick) pra o stepper avançar sozinho.
//
// EXCEÇÃO: se a equipe mexeu no pedido pelo Painel de Cozinha (KDS) do
// admin, ele ganha um `statusManual` gravado no back-end — a partir daí o
// relógio é ignorado pra sempre nesse pedido específico (é "cozinha real"
// agora, não simulação). Pedidos nunca tocados pela cozinha continuam 100%
// automáticos, como sempre foram.
export function statusPedido(pedido) {
  if (pedido.statusManual) return pedido.statusManual;
  const decorrido = (Date.now() - pedido.criadoEm) / 1000;
  if (decorrido < 10) return "recebido";
  if (decorrido < 30) return "preparo";
  if (decorrido < 50) return "pronto";
  return "entregue";
}

// Motivos disponíveis ao chamar o garçom — antes era um botão único, agora
// carrega um motivo junto (mostrado pro admin na aba Mesas).
export const MOTIVO_GARCOM = {
  presenca: "Só chamando",
  talheres: "Preciso de talheres/guardanapo",
  conta: "Pedir a conta",
  duvida: "Dúvida no cardápio",
  outro: "Outro motivo",
};

// "Chamar garçom" e "avaliar atendimento" migraram pro back-end (server/,
// rotas /api/garcom/chamadas — ver AppContext.jsx#chamarGarcomAgora e
// #avaliarGarcom) — antes eram funções aqui que escreviam direto em
// tnm_chamadas_garcom.

// Estima o tempo restante somando o preparo dos pedidos "na frente" (ainda
// não prontos/entregues, criados antes deste) ao tempo já decorrido — em
// vez do tempo fixo por etapa do `statusPedido`, reflete a fila real da
// cozinha no momento. Só usado pra exibição (não altera `statusPedido`,
// que continua sendo a fonte da verdade do status em si).
export function estimarTempoFila(todosPedidos, pedidoAtual) {
  const MIN_POR_PEDIDO_NA_FRENTE = 3;
  const naFrente = todosPedidos.filter(
    (p) =>
      p.id !== pedidoAtual.id &&
      p.criadoEm < pedidoAtual.criadoEm &&
      statusPedido(p) !== "entregue" &&
      !p._canceladoAdmin,
  ).length;
  const decorridoMin = Math.floor((Date.now() - pedidoAtual.criadoEm) / 60000);
  const basePreparoMin = pedidoAtual.tipo === "entrega" ? 30 : 18;
  const restante = Math.max(
    1,
    basePreparoMin + naFrente * MIN_POR_PEDIDO_NA_FRENTE - decorridoMin,
  );
  return { restanteMin: restante, naFrente };
}

/* ==========================================================================
   Mapa de entrega — coordenadas do estabelecimento (fictícias, ajuste pras
   coordenadas reais da sua loja antes de qualquer uso real, ver CLAUDE.md,
   "Limitações conhecidas") e interpolação da posição do entregador. Usadas
   só pelo mapa de entrega simulado (MapaEntrega, ver components/orders.jsx).
   ========================================================================== */
export const COORDS_LOJA = { lat: -23.5505, lng: -46.6333 };

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// O app nunca geocodifica o endereço de entrega de verdade — `endereco` é
// só texto livre digitado pelo cliente (ver PedidoInfo, em components/
// cart.jsx), e geocodificar isso exigiria uma API paga ou um serviço de
// terceiro com limite de uso (ex.: Nominatim). Em vez disso, deriva um
// ponto fictício mas ESTÁVEL (o mesmo pedido sempre cai no mesmo lugar) a
// partir do id do pedido, a uma distância plausível da loja — só pra dar
// contexto visual real no mapa, não é geolocalização de verdade.
export function coordsEntregaPedido(pedido) {
  const h = hashString(String(pedido.id || pedido.criadoEm || ""));
  const angulo = (h % 360) * (Math.PI / 180);
  const distanciaKm = 0.8 + (h % 250) / 100; // ~0,8 km a ~3,3 km da loja
  // ~111,32 km por grau de latitude; longitude varia com cos(latitude).
  const dLat = (distanciaKm / 111.32) * Math.cos(angulo);
  const dLng =
    (distanciaKm / (111.32 * Math.cos((COORDS_LOJA.lat * Math.PI) / 180))) * Math.sin(angulo);
  return { lat: COORDS_LOJA.lat + dLat, lng: COORDS_LOJA.lng + dLng };
}

export function interpolarPosicao(origem, destino, fracao) {
  const f = Math.min(1, Math.max(0, fracao));
  return {
    lat: origem.lat + (destino.lat - origem.lat) * f,
    lng: origem.lng + (destino.lng - origem.lng) * f,
  };
}

/* ==========================================================================
   Rola até uma seção do cardápio compensando a altura do header sticky
   (.header-fixo). scrollIntoView({block:"start"}) sozinho alinha o topo da
   seção exatamente no topo da viewport — mas aí ela fica escondida atrás do
   header sticky, que continua ocupando aquele espaço. Isso fazia a página
   "descer demais": o usuário precisava rolar pra cima manualmente pra
   revelar o conteúdo que ficou encoberto.
   ========================================================================== */
export function rolarParaSecao(id) {
  const secao = document.getElementById(`secao-${id}`);
  if (!secao) return;
  const header = document.querySelector(".header-fixo");
  const alturaHeader = header ? header.getBoundingClientRect().height : 0;
  const topoSecao = secao.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: topoSecao - alturaHeader - 8, behavior: "smooth" });
}
