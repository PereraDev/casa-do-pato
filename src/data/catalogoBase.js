// Fonte única do catálogo-base, SEM imports — o app React importa direto
// (data.js) e o painel admin recebe uma cópia gerada por
// scripts/gerar-catalogo-admin.mjs (roda em predev/prebuild). Edite o
// cardápio aqui, nunca em public/admin/catalogo.gerado.js.

// Cupons de desconto mock, aplicáveis no carrinho
export const CATEGORIES_BASE = [
  { id: "campanha", label: "Campanha Terça Feira", icon: "🔥" },
  { id: "lancamentos", label: "Lançamentos", icon: "✨" },
  { id: "combos", label: "Combos", icon: "🍔" },
  { id: "tradicionais", label: "Hambúrgueres Tradicionais", icon: "🍔" },
  { id: "autorais", label: "Hambúrgueres Autorais", icon: "👨‍🍳" },
  { id: "acompanhamentos", label: "Acompanhamentos", icon: "🍟" },
  { id: "sobremesas", label: "Sobremesa", icon: "🍮" },
  { id: "bebidas", label: "Bebidas", icon: "🥤" },
];

// Grupos de adicionais reutilizáveis, no molde "Turbine seu Hambúrguer"
export const ADDON_GROUPS_BASE = {
  turbine: {
    id: "turbine",
    nome: "Turbine seu Hambúrguer",
    min: 0,
    max: 10,
    itens: [
      { id: "carne130", nome: "Carne 130g", preco: 10.0 },
      { id: "carne180costela", nome: "Carne 180g (Costela)", preco: 16.0 },
      { id: "carne180picanha", nome: "Carne 180g (Picanha)", preco: 18.0 },
      { id: "bacon", nome: "Bacon", preco: 8.0 },
      { id: "cheddar", nome: "Cheddar Cremoso", preco: 6.0 },
      { id: "ovo", nome: "Ovo", preco: 4.0 },
      { id: "cebolaCaramelizada", nome: "Cebola Caramelizada", preco: 5.0 },
    ],
  },
  molhos: {
    id: "molhos",
    nome: "Escolha o molho",
    min: 0,
    max: 3,
    itens: [
      { id: "molhoBarbecue", nome: "Barbecue", preco: 0 },
      { id: "molhoChimichurri", nome: "Chimichurri", preco: 0 },
      { id: "molhoMaioneseGrill", nome: "Maionese Grill", preco: 0 },
      { id: "molhoPicante", nome: "Picante da Casa", preco: 2.0 },
    ],
  },
  bebidaCombo: {
    id: "bebidaCombo",
    nome: "Escolha sua bebida",
    min: 0,
    max: 1,
    itens: [
      { id: "guaranaLata", nome: "Guaraná Antárctica Lata", preco: 0 },
      { id: "cocaLata", nome: "Coca-Cola Lata", preco: 0 },
      { id: "suco300", nome: "Suco Natural 300ml", preco: 4.0 },
    ],
  },
};

export const COUPONS = {
  TCC10: { tipo: "pct", valor: 10, label: "10% de desconto" },
  BEMVINDO8: { tipo: "valor", valor: 8, label: "R$ 8,00 de desconto" },
};

// Catálogo mockado do cardápio. Forma de cada item:
//   id          — identificador único, referenciado pelo carrinho/pedidos/favoritos
//   cat         — id de uma das CATEGORIES acima
//   nome/desc   — texto exibido no card e na ficha do produto
//   preco       — preço normal; precoPromo/descontoPct (opcionais) mostram o
//                 preço "de/por" riscado — ver utils/utils.js#precoBase, que
//                 decide qual dos dois usar em qualquer cálculo
//   icon/img    — emoji usado como fallback quando não há imgUrl
//   imgUrl      — foto do prato (aqui, placeholder do Unsplash)
//   tag         — selo opcional no card ("Mais Pedido"/"Novidade"), também
//                 usado pela busca por IA como sinal de relevância
//   addons      — lista de ids de ADDON_GROUPS aplicáveis a este item (ficha
//                 do produto exibe cada grupo referenciado, ex. "Turbine seu
//                 Hambúrguer")
//   ingredientes — lista de textos livres; presente = habilita a
//                 personalização "Monte do seu jeito" (remover/devolver um
//                 ingrediente padrão, sem alterar o preço)
export const MENU_BASE = [
  // ---------- Campanha Terça Feira ----------
  {
    id: "pt01",
    cat: "campanha",
    nome: "Pato - Cheddar Bacon",
    desc: "Pão Brioche, Burger 130gr, Cheddar Cremoso Vigor, Bacon Crocante, Ketchup Americano.",
    preco: 30.0,
    precoPromo: 24.0,
    descontoPct: 20,
    icon: "🍔",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
    addons: ["turbine", "molhos"],
    ingredientes: [
      "Pão Brioche",
      "Burger 130gr",
      "Cheddar Cremoso Vigor",
      "Bacon Crocante",
      "Ketchup Americano",
    ],
  },
  {
    id: "pt02",
    cat: "campanha",
    nome: 'Pato - Parrilla + Guaraná Antárctica Lata "Grátis"',
    desc: "Pão Brioche, Burger 130gr, Maionese Grill, Queijo Prato, Chimichurri, Bacon Crocante.",
    preco: 34.0,
    icon: "🍔",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
    tag: "Mais Pedido",
    addons: ["turbine", "molhos", "bebidaCombo"],
    ingredientes: [
      "Pão Brioche",
      "Burger 130gr",
      "Maionese Grill",
      "Queijo Prato",
      "Chimichurri",
      "Bacon Crocante",
    ],
  },

  // ---------- Lançamentos Agosto ----------
  {
    id: "la01",
    cat: "lancamentos",
    nome: "Duplo Cheddar Bacon",
    desc: "Pão Brioche, 2x Burger 130gr, dobro de cheddar, bacon extra crocante.",
    preco: 38.0,
    icon: "🍔",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=800&q=80",
    tag: "Novidade",
    addons: ["turbine", "molhos"],
    ingredientes: [
      "Pão Brioche",
      "2x Burger 130gr",
      "Dobro de Cheddar",
      "Bacon Extra Crocante",
    ],
  },
  {
    id: "la02",
    cat: "lancamentos",
    nome: "Verde Fresh",
    desc: "Pão australiano, burger 130gr, rúcula, tomate seco, maionese de ervas.",
    preco: 32.0,
    icon: "🥬",
    img: "🥬",
    imgUrl:
      "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=800&q=80",
    tag: "Novidade",
    addons: ["turbine", "molhos"],
    ingredientes: [
      "Pão Australiano",
      "Burger 130gr",
      "Rúcula",
      "Tomate Seco",
      "Maionese de Ervas",
    ],
  },

  // ---------- Combos ----------
  {
    id: "cb01",
    cat: "combos",
    nome: "Combo Pato Cheese Burguer",
    desc: "Cheese Burguer clássico + fritas média + refrigerante lata.",
    preco: 42.0,
    icon: "🍟",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=80",
    addons: ["turbine", "bebidaCombo"],
  },
  {
    id: "cb02",
    cat: "combos",
    nome: "Combo Duplo Bacon",
    desc: "Duplo Cheddar Bacon + fritas média + refrigerante lata.",
    preco: 48.0,
    icon: "🍟",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80",
    tag: "Mais Pedido",
    addons: ["turbine", "bebidaCombo"],
  },

  // ---------- Hambúrgueres Tradicionais ----------
  {
    id: "tr01",
    cat: "tradicionais",
    nome: "X-Salada",
    desc: "Pão, burger 130gr, queijo prato, alface, tomate e maionese da casa.",
    preco: 22.0,
    icon: "🍔",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80",
    addons: ["turbine", "molhos"],
    ingredientes: [
      "Pão",
      "Burger 130gr",
      "Queijo Prato",
      "Alface",
      "Tomate",
      "Maionese da Casa",
    ],
  },
  {
    id: "tr02",
    cat: "tradicionais",
    nome: "X-Bacon",
    desc: "Pão, burger 130gr, queijo prato, bacon crocante e maionese da casa.",
    preco: 26.0,
    icon: "🍔",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=800&q=80",
    addons: ["turbine", "molhos"],
    ingredientes: ["Pão", "Burger 130gr", "Queijo Prato", "Bacon Crocante", "Maionese da Casa"],
  },
  {
    id: "tr03",
    cat: "tradicionais",
    nome: "X-Egg",
    desc: "Pão, burger 130gr, queijo prato, ovo e maionese da casa.",
    preco: 24.0,
    icon: "🍔",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    addons: ["turbine", "molhos"],
    ingredientes: ["Pão", "Burger 130gr", "Queijo Prato", "Ovo", "Maionese da Casa"],
  },

  // ---------- Hambúrgueres Autorais ----------
  {
    id: "au01",
    cat: "autorais",
    nome: "Chef Especial Costela",
    desc: "Pão brioche, carne 180g de costela, cheddar cremoso, cebola caramelizada, barbecue defumado.",
    preco: 36.0,
    icon: "👨‍🍳",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=800&q=80",
    addons: ["turbine", "molhos"],
    ingredientes: [
      "Pão Brioche",
      "Carne 180g de Costela",
      "Cheddar Cremoso",
      "Cebola Caramelizada",
      "Barbecue Defumado",
    ],
  },
  {
    id: "au02",
    cat: "autorais",
    nome: "Picanha na Brasa",
    desc: "Pão brioche, carne 180g de picanha, queijo coalho grelhado, farofa crocante, chimichurri.",
    preco: 39.0,
    icon: "👨‍🍳",
    img: "🍔",
    imgUrl:
      "https://images.unsplash.com/photo-1607013251379-e6eecfffe234?auto=format&fit=crop&w=800&q=80",
    tag: "Mais Pedido",
    addons: ["turbine", "molhos"],
    ingredientes: [
      "Pão Brioche",
      "Carne 180g de Picanha",
      "Queijo Coalho Grelhado",
      "Farofa Crocante",
      "Chimichurri",
    ],
  },

  // ---------- Acompanhamentos ----------
  {
    id: "ac01",
    cat: "acompanhamentos",
    nome: "Batata Frita Média",
    desc: "Porção de batata frita crocante, tempero da casa.",
    preco: 16.0,
    icon: "🍟",
    img: "🍟",
    imgUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",
    addons: [],
  },
  {
    id: "ac02",
    cat: "acompanhamentos",
    nome: "Onion Rings",
    desc: "Anéis de cebola empanados e fritos, acompanha molho barbecue.",
    preco: 18.0,
    icon: "🧅",
    img: "🧅",
    imgUrl:
      "https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=800&q=80",
    addons: [],
  },

  // ---------- Sobremesa ----------
  {
    id: "sb01",
    cat: "sobremesas",
    nome: "Pudim de Leite",
    desc: "Receita tradicional da casa com calda de caramelo.",
    preco: 14.5,
    icon: "🍮",
    img: "🍮",
    imgUrl:
      "https://images.unsplash.com/photo-1470124182917-cc6de9827bc4?auto=format&fit=crop&w=800&q=80",
    addons: [],
  },
  {
    id: "sb02",
    cat: "sobremesas",
    nome: "Brownie com Sorvete",
    desc: "Brownie quente de chocolate meio amargo com bola de sorvete de creme.",
    preco: 19.0,
    icon: "🍫",
    img: "🍫",
    imgUrl:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
    tag: "Novidade",
    addons: [],
  },

  // ---------- Bebidas ----------
  {
    id: "bb01",
    cat: "bebidas",
    nome: "Refrigerante Lata",
    desc: "350ml, gelado.",
    preco: 6.5,
    icon: "🥤",
    img: "🥤",
    imgUrl:
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
    addons: [],
  },
  {
    id: "bb02",
    cat: "bebidas",
    nome: "Suco Natural 500ml",
    desc: "Feito na hora, sabor da estação.",
    preco: 9.9,
    icon: "🍊",
    img: "🍊",
    imgUrl:
      "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=800&q=80",
    addons: [],
  },
  {
    id: "bb03",
    cat: "bebidas",
    nome: "Água com Gás",
    desc: "500ml gelada.",
    preco: 5.0,
    icon: "💧",
    img: "💧",
    imgUrl:
      "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=800&q=80",
    addons: [],
  },
];

// Avaliações mockadas (simulam pedidos já avaliados por outros clientes)
export const REVIEWS_MOCK = {
  pt01: [
    {
      autor: "Marcos S.",
      estrelas: 5,
      comentario: "Bacon crocante demais, melhor cheddar bacon que já comi.",
      data: "2026-08-10",
    },
    {
      autor: "Juliana R.",
      estrelas: 4,
      comentario: "Muito bom, só achei o pão meio doce pro meu gosto.",
      data: "2026-08-05",
    },
  ],
  pt02: [
    {
      autor: "Felipe A.",
      estrelas: 5,
      comentario:
        "O chimichurri fez toda diferença, e a bebida grátis foi um mimo.",
      data: "2026-08-12",
    },
  ],
  tr01: [
    {
      autor: "Camila O.",
      estrelas: 4,
      comentario: "Clássico bem feito, maionese da casa é ótima.",
      data: "2026-07-28",
    },
    {
      autor: "Diego P.",
      estrelas: 3,
      comentario: "Bom, mas chegou um pouco frio.",
      data: "2026-07-20",
    },
  ],
  au02: [
    {
      autor: "Renata M.",
      estrelas: 5,
      comentario: "A picanha na brasa é surreal, farofa combina perfeito.",
      data: "2026-08-14",
    },
  ],
  cb01: [
    {
      autor: "Bruno T.",
      estrelas: 5,
      comentario: "Combo com ótimo custo-benefício, fritas sempre crocantes.",
      data: "2026-08-01",
    },
  ],
};
