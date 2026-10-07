import { Server } from "socket.io";
import fp from "fastify-plugin";

// Anexa o Socket.IO ao MESMO http.Server do Fastify (fastify.server já
// existe assim que a instância é criada, antes do .listen) — não precisa de
// porta/processo separado. Rooms: "admin" (painel admin.html),
// "grupo:<codigo>" (participantes de um pedido em grupo), "chamada:<id>"
// (quem fez aquele chamado de garçom específico). Ver CLAUDE.md pra lista
// completa de eventos emitidos por cada rota.
export default fp(async function socketsPlugin(fastify) {
  const io = new Server(fastify.server, {
    path: "/socket.io",
  });

  // A room "admin" recebe pedido com e-mail/endereço de cliente — só entra
  // quem tem a sessão de admin (mesmo cookie das rotas REST, vem no handshake).
  function ehAdmin(socket) {
    const bruto = /(?:^|;\s*)tnm_sessao=([^;]+)/.exec(socket.handshake.headers.cookie || "")?.[1];
    if (!bruto) return false;
    try {
      return fastify.sessaoAdminValida(fastify.decodeSecureSession(decodeURIComponent(bruto)));
    } catch {
      return false;
    }
  }

  io.on("connection", (socket) => {
    socket.on("admin:entrar", () => {
      if (ehAdmin(socket)) socket.join("admin");
    });
    socket.on("admin:sair", () => socket.leave("admin"));
    socket.on("grupo:entrar-sala", (codigo) => {
      if (typeof codigo === "string" && codigo) socket.join("grupo:" + codigo);
    });
    socket.on("grupo:sair-sala", (codigo) => {
      if (typeof codigo === "string" && codigo) socket.leave("grupo:" + codigo);
    });
    socket.on("garcom:acompanhar", (id) => {
      if (typeof id === "string" && id) socket.join("chamada:" + id);
    });
  });

  fastify.decorate("io", io);
});
