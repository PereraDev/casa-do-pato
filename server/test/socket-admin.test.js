// Socket.IO: só quem tem sessão de funcionário entra na room "admin" e recebe eventos dela.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { io as cliente } from "../../node_modules/socket.io-client/build/esm/index.js";
import { buildApp } from "../src/app.js";
import { garantirFuncoesPadrao } from "../src/lib/funcoes.js";
import { hashSenha } from "../src/lib/senha.js";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test("room admin exige sessão de funcionário", async () => {
  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const usuario = `teste-socket-${crypto.randomBytes(3).toString("hex")}@teste.local`;
  try {
    await garantirFuncoesPadrao(app.prisma);
    await app.prisma.funcionario.create({
      data: { nome: "Teste Socket", usuario, senhaHash: await hashSenha("Senha1234"), funcao: "garcom" },
    });
    const login = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usuario, senha: "Senha1234" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const abrir = (extraHeaders) =>
      new Promise((resolve) => {
        const s = cliente(base, { path: "/socket.io", transports: ["websocket"], extraHeaders });
        s.on("connect", () => resolve(s));
      });
    const anonimo = await abrir({});
    const admin = await abrir({ cookie });
    const recebidos = { anonimo: 0, admin: 0 };
    anonimo.on("teste", () => recebidos.anonimo++);
    admin.on("teste", () => recebidos.admin++);
    anonimo.emit("admin:entrar");
    admin.emit("admin:entrar");
    await espera(500);
    app.io.to("admin").emit("teste", 1);
    await espera(300);
    assert.deepEqual(recebidos, { anonimo: 0, admin: 1 });

    admin.emit("admin:sair");
    await espera(300);
    app.io.to("admin").emit("teste", 2);
    await espera(300);
    assert.equal(recebidos.admin, 1, "depois de admin:sair não recebe mais");
    anonimo.close();
    admin.close();
  } finally {
    await app.prisma.funcionario.deleteMany({ where: { usuario } });
    await app.close();
  }
});
