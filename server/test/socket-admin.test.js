// Socket.IO: só quem tem sessão de admin entra na room "admin" e recebe eventos dela.
import assert from "node:assert/strict";
import { test } from "node:test";
import { io as cliente } from "../../node_modules/socket.io-client/build/esm/index.js";
import { buildApp } from "../src/app.js";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test("room admin exige sessão de admin", async () => {
  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const login = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: process.env.ADMIN_TOKEN }),
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
    await espera(300);
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
    await app.close();
  }
});
