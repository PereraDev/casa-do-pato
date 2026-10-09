import { GoogleGenAI } from "@google/genai";

// Busca por IA do cardápio — 5ª fatia leve que migra pro back-end (ver
// CLAUDE.md, "Back-end (server/)"): só existe pra não expor a API key no
// cliente. O catálogo em si continua vivendo só no front (data/data.js) —
// o cliente manda os itens a cada chamada em vez do servidor duplicar o
// MENU, mesmo espírito de "server não é dono do cardápio" do resto do app.
// Usa o Gemini (tier gratuito do Google AI Studio, ver GEMINI_API_KEY no
// .env.example) em vez de uma API paga — combina com o resto do projeto
// sendo um protótipo de TCC. Sem GEMINI_API_KEY no ambiente, a rota
// responde 503 e a UI do cliente cai de volta pra busca por texto comum
// (ver SearchBar.jsx) — nunca derruba o cardápio por causa disso.
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Modelo Flash: é o recomendado pelo tier gratuito do Gemini (bem mais
// generoso que o de modelos "Pro") — sobra RPM/dia de sobra pra uma busca
// pontual de cardápio. gemini-2.5-flash foi descontinuado pra contas novas
// (a própria API passou a responder 404 recomendando este aqui).
const MODELO = "gemini-3.6-flash";

// Prompt "solto" de propósito — não é um filtro por palavra-chave, é pra
// agir como alguém da casa recomendando de verdade: pode opinar, comparar
// itens, montar combinação (prato + bebida + sobremesa), reagir a pedidos
// vagos ("me surpreenda", "o que você recomenda?", "tô sem fome mas quero
// beliscar algo") e considerar tag/promoção. Só duas regras rígidas: nunca
// inventar item fora do catálogo (os ids são conferidos no servidor de
// qualquer forma, ver abaixo) e responder em português do Brasil.
const SYSTEM_PROMPT =
  'Você é o atendente-recomendador do "Casa do Pato", um restaurante de ' +
  "hambúrgueres. Aja como alguém que conhece o cardápio de cor e gosta de " +
  "recomendar — não como um filtro de busca. Pode opinar, comparar pratos, " +
  "sugerir combinações (ex.: prato + bebida + sobremesa) e reagir bem a " +
  "pedidos vagos, indecisos ou abertos (\"me surpreenda\", \"o que tá bom " +
  'hoje?", "algo diferente"), usando categoria/preço/descrição/tag pra ' +
  "embasar a sugestão. Responda SEMPRE em português do Brasil. Só duas " +
  "regras fixas: nunca invente prato que não esteja no catálogo fornecido, " +
  "e nunca finja saber algo que o catálogo não diz (ex.: calorias, tempo de " +
  'preparo exato) — se não souber, admita. "resposta" pode ter até 2-3 ' +
  "frases (não precisa ser telegráfico, é pra soar como recomendação de " +
  'verdade, não legenda de resultado de busca). "itemIds" tem no máximo 8, ' +
  "do mais pro menos relevante — pode vir vazio só se o catálogo realmente " +
  "não tiver nada a ver com o pedido, e nesse caso explique o porquê em " +
  "resposta e sugira o que perguntar em vez disso.";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    resposta: { type: "STRING" },
    itemIds: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["resposta", "itemIds"],
};

export default async function iaRoutes(fastify) {
  if (!ai) fastify.log.warn("GEMINI_API_KEY ausente: busca por IA desligada (rota responde 503)");
  fastify.post("/api/ia/busca", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!ai) {
      return reply.code(503).send({ erro: "A busca por IA está desligada no momento. Use a busca por texto." });
    }
    const { pergunta, itens } = request.body || {};
    if (
      typeof pergunta !== "string" || !pergunta.trim() || pergunta.length > 300 ||
      !Array.isArray(itens) || !itens.length || itens.length > 100 || !itens.every((it) => it && typeof it === "object")
    ) {
      return reply.code(400).send({ erro: "Informe a pergunta (até 300 caracteres) e os itens do cardápio" });
    }

    const corta = (v, n) => String(v ?? "").slice(0, n);
    const catalogo = itens
      .map(
        (it) =>
          `${corta(it.id, 40)} | ${corta(it.nome, 80)} | ${corta(it.categoria, 40)} | R$${corta(it.preco, 10)}` +
          `${it.tag ? " | " + corta(it.tag, 30) : ""} | ${corta(it.desc, 200)}`,
      )
      .join("\n");

    try {
      const response = await ai.models.generateContent({
        model: MODELO,
        contents:
          `Catálogo (id | nome | categoria | preço | tag opcional | descrição):\n${catalogo}\n\n` +
          `Pedido do cliente: "${pergunta.trim()}"`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // thinkingBudget: -1 = automático (o modelo decide quanto
          // "pensar") — é uma recomendação de verdade agora, não um filtro
          // literal, vale deixar o modelo raciocinar mais pra combinar
          // itens e reagir bem a pedidos vagos.
          thinkingConfig: { thinkingBudget: -1 },
        },
      });

      const parsed = JSON.parse(response.text);
      const idsValidos = new Set(itens.map((it) => String(it.id)));
      const itemIds = Array.isArray(parsed.itemIds)
        ? parsed.itemIds.filter((id) => idsValidos.has(String(id))).slice(0, 8)
        : [];
      return {
        resposta: typeof parsed.resposta === "string" ? parsed.resposta : "Aqui estão algumas sugestões:",
        itemIds,
      };
    } catch (err) {
      request.log.error(err, "Falha na busca por IA");
      // 429 do Gemini = cota do tier gratuito estourada; o resto (chave inválida, modelo, rede) vira 502.
      if (err?.status === 429) {
        return reply.code(429).send({ erro: "A IA atingiu o limite de uso agora. Tente de novo em instantes." });
      }
      return reply.code(502).send({ erro: "A IA não respondeu agora, tente de novo." });
    }
  });
}
