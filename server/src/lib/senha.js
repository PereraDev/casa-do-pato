// bcryptjs (puro JS) em vez do pacote nativo `bcrypt` — mesmo algoritmo/
// formato de hash, mas sem precisar compilar binário nativo (node-gyp) no
// Windows do desenvolvedor.
import bcrypt from "bcryptjs";

// 12 rounds é o piso recomendado atualmente pra bcrypt (10 era o padrão
// antigo da lib) — cada round a mais dobra o custo de força bruta, ainda
// rápido o suficiente pra não travar a resposta do cadastro/login.
const SALT_ROUNDS = 12;

export function hashSenha(senha) {
  return bcrypt.hash(senha, SALT_ROUNDS);
}

export function conferirSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

// Política mínima de senha forte pro cadastro/redefinição de conta de
// cliente — server é sempre a fonte da verdade (o front-end só espelha essa
// regra pra dar feedback antes de enviar, ver src/utils/senha.js).
export function motivoSenhaFraca(senha) {
  if (!senha || senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(senha)) return "A senha precisa ter pelo menos 1 letra.";
  if (!/[0-9]/.test(senha)) return "A senha precisa ter pelo menos 1 número.";
  return null;
}
