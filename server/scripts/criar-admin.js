// Cria (ou redefine a senha de) um administrador do painel, direto no Postgres.
// Uso local:      npm run admin:criar
// Uso em produção (sem tocar no painel do Render), apontando pro banco de lá:
//   DATABASE_URL="postgresql://..." npm run admin:criar
// Variável já definida no ambiente vence o .env (comportamento do --env-file).
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";
import { garantirFuncoesPadrao } from "../src/lib/funcoes.js";
import { hashSenha, motivoSenhaFraca } from "../src/lib/senha.js";

const prisma = new PrismaClient();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Fila de linhas: funciona tanto digitando quanto com entrada redirecionada (pipe),
// onde um rl.question() sequencial perderia as linhas que chegam antes da pergunta.
const fila = [];
const aguardando = [];
rl.on("line", (linha) => (aguardando.length ? aguardando.shift()(linha) : fila.push(linha)));
const lerLinha = () => new Promise((resolve) => (fila.length ? resolve(fila.shift()) : aguardando.push(resolve)));

// Esconde o que é digitado quando o terminal é interativo (TTY).
let mudo = false;
const escrever = rl._writeToOutput.bind(rl);
rl._writeToOutput = (texto) => {
  if (!mudo) escrever(texto);
};

async function perguntar(texto) {
  process.stdout.write(texto);
  return lerLinha();
}

// Em terminais que não são TTY (ex.: alguns Git Bash/mintty) a digitação aparece na
// tela — avisa antes, em vez de fingir que está escondida.
async function perguntarSenha(texto) {
  if (!process.stdin.isTTY) {
    console.log("(este terminal não esconde a digitação: a senha vai aparecer na tela)");
    return perguntar(texto);
  }
  process.stdout.write(texto);
  mudo = true;
  const resposta = await lerLinha();
  mudo = false;
  process.stdout.write("\n");
  return resposta;
}

async function main() {
  const host = new URL(process.env.DATABASE_URL).hostname;
  console.log(`Banco: ${host}\n`);

  const nome = (await perguntar("Nome [Administrador]: ")).trim() || "Administrador";
  const usuario = (await perguntar("E-mail/usuário de login: ")).trim().toLowerCase();
  if (usuario.length < 3) throw new Error("Usuário muito curto.");

  const senha = await perguntarSenha("Senha (mín. 8, com letra e número): ");
  const motivo = motivoSenhaFraca(senha);
  if (motivo) throw new Error(motivo);
  if (senha !== (await perguntarSenha("Repita a senha: "))) throw new Error("As senhas não coincidem.");

  await garantirFuncoesPadrao(prisma);
  const senhaHash = await hashSenha(senha);
  const existente = await prisma.funcionario.findUnique({ where: { usuario } });
  if (existente) {
    await prisma.funcionario.update({ where: { usuario }, data: { nome, senhaHash, funcao: "admin" } });
    console.log(`\nAdministrador "${usuario}" já existia: senha redefinida.`);
  } else {
    await prisma.funcionario.create({ data: { nome, usuario, senhaHash, funcao: "admin" } });
    console.log(`\nAdministrador "${usuario}" criado.`);
  }
}

main()
  .catch((err) => {
    console.error("\nErro:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
