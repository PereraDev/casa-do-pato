import crypto from "node:crypto";

// Códigos de 6 dígitos de uso único (verificação de e-mail e recuperação de senha),
// em memória: 15 min de validade, 5 tentativas, 1 envio por minuto por chave.
// ponytail: Map em processo único — reiniciar o servidor (o plano grátis do Render
// "dorme") invalida os códigos pendentes; o usuário só pede outro. Upgrade = tabela.
const VALIDADE_MS = 15 * 60 * 1000;
const INTERVALO_MS = 60 * 1000;
const TENTATIVAS = 5;
const codigos = new Map(); // chave -> { codigo, expira, emitidoEm, tentativas }

// Devolve o código novo, ou null se já saiu um código há menos de 1 minuto (anti-spam
// na caixa de entrada de terceiros).
export function emitirCodigo(chave) {
  const atual = codigos.get(chave);
  if (atual && Date.now() - atual.emitidoEm < INTERVALO_MS) return null;
  const codigo = String(crypto.randomInt(100000, 1000000));
  codigos.set(chave, { codigo, expira: Date.now() + VALIDADE_MS, emitidoEm: Date.now(), tentativas: 0 });
  return codigo;
}

// true só uma vez por código; cada chamada gasta uma das 5 tentativas.
export function conferirCodigo(chave, informado) {
  const c = codigos.get(chave);
  if (!c || c.expira < Date.now() || c.tentativas >= TENTATIVAS) return false;
  c.tentativas++;
  const a = Buffer.from(String(informado ?? "").padEnd(6).slice(0, 6));
  if (String(informado).length !== 6 || !crypto.timingSafeEqual(a, Buffer.from(c.codigo))) return false;
  codigos.delete(chave);
  return true;
}
