// Entrypoint do processo Node (o que `npm start`/`npm run dev` de fato
// executa) — separado de app.js pra deixar a instância Fastify (buildApp)
// testável/inspecionável sem precisar abrir uma porta de rede de verdade.
import { buildApp } from "./app.js";

const app = await buildApp();
const port = Number(process.env.PORT) || 4000;

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
