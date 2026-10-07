// GERADO por scripts/gerar-catalogo-admin.mjs a partir de src/data/catalogoBase.js — NÃO EDITE.
export var MENU_BASE = [
  {"id":"pt01","cat":"campanha","name":"Pato - Cheddar Bacon","price":24,"desc":"Pão Brioche, Burger 130gr, Cheddar Cremoso Vigor, Bacon Crocante, Ketchup Americano."},
  {"id":"pt02","cat":"campanha","name":"Pato - Parrilla + Guaraná Antárctica Lata \"Grátis\"","price":34,"desc":"Pão Brioche, Burger 130gr, Maionese Grill, Queijo Prato, Chimichurri, Bacon Crocante."},
  {"id":"la01","cat":"lancamentos","name":"Duplo Cheddar Bacon","price":38,"desc":"Pão Brioche, 2x Burger 130gr, dobro de cheddar, bacon extra crocante."},
  {"id":"la02","cat":"lancamentos","name":"Verde Fresh","price":32,"desc":"Pão australiano, burger 130gr, rúcula, tomate seco, maionese de ervas."},
  {"id":"cb01","cat":"combos","name":"Combo Pato Cheese Burguer","price":42,"desc":"Cheese Burguer clássico + fritas média + refrigerante lata."},
  {"id":"cb02","cat":"combos","name":"Combo Duplo Bacon","price":48,"desc":"Duplo Cheddar Bacon + fritas média + refrigerante lata."},
  {"id":"tr01","cat":"tradicionais","name":"X-Salada","price":22,"desc":"Pão, burger 130gr, queijo prato, alface, tomate e maionese da casa."},
  {"id":"tr02","cat":"tradicionais","name":"X-Bacon","price":26,"desc":"Pão, burger 130gr, queijo prato, bacon crocante e maionese da casa."},
  {"id":"tr03","cat":"tradicionais","name":"X-Egg","price":24,"desc":"Pão, burger 130gr, queijo prato, ovo e maionese da casa."},
  {"id":"au01","cat":"autorais","name":"Chef Especial Costela","price":36,"desc":"Pão brioche, carne 180g de costela, cheddar cremoso, cebola caramelizada, barbecue defumado."},
  {"id":"au02","cat":"autorais","name":"Picanha na Brasa","price":39,"desc":"Pão brioche, carne 180g de picanha, queijo coalho grelhado, farofa crocante, chimichurri."},
  {"id":"ac01","cat":"acompanhamentos","name":"Batata Frita Média","price":16,"desc":"Porção de batata frita crocante, tempero da casa."},
  {"id":"ac02","cat":"acompanhamentos","name":"Onion Rings","price":18,"desc":"Anéis de cebola empanados e fritos, acompanha molho barbecue."},
  {"id":"sb01","cat":"sobremesas","name":"Pudim de Leite","price":14.5,"desc":"Receita tradicional da casa com calda de caramelo."},
  {"id":"sb02","cat":"sobremesas","name":"Brownie com Sorvete","price":19,"desc":"Brownie quente de chocolate meio amargo com bola de sorvete de creme."},
  {"id":"bb01","cat":"bebidas","name":"Refrigerante Lata","price":6.5,"desc":"350ml, gelado."},
  {"id":"bb02","cat":"bebidas","name":"Suco Natural 500ml","price":9.9,"desc":"Feito na hora, sabor da estação."},
  {"id":"bb03","cat":"bebidas","name":"Água com Gás","price":5,"desc":"500ml gelada."}
];
export var CATEGORIES_BASE = [
  {"id":"campanha","label":"Campanha Terça Feira"},
  {"id":"lancamentos","label":"Lançamentos"},
  {"id":"combos","label":"Combos"},
  {"id":"tradicionais","label":"Hambúrgueres Tradicionais"},
  {"id":"autorais","label":"Hambúrgueres Autorais"},
  {"id":"acompanhamentos","label":"Acompanhamentos"},
  {"id":"sobremesas","label":"Sobremesa"},
  {"id":"bebidas","label":"Bebidas"}
];
export var ADDON_GROUPS_BASE = {
  "turbine": {
    "id": "turbine",
    "nome": "Turbine seu Hambúrguer",
    "min": 0,
    "max": 10,
    "itens": [
      {
        "id": "carne130",
        "nome": "Carne 130g",
        "preco": 10
      },
      {
        "id": "carne180costela",
        "nome": "Carne 180g (Costela)",
        "preco": 16
      },
      {
        "id": "carne180picanha",
        "nome": "Carne 180g (Picanha)",
        "preco": 18
      },
      {
        "id": "bacon",
        "nome": "Bacon",
        "preco": 8
      },
      {
        "id": "cheddar",
        "nome": "Cheddar Cremoso",
        "preco": 6
      },
      {
        "id": "ovo",
        "nome": "Ovo",
        "preco": 4
      },
      {
        "id": "cebolaCaramelizada",
        "nome": "Cebola Caramelizada",
        "preco": 5
      }
    ]
  },
  "molhos": {
    "id": "molhos",
    "nome": "Escolha o molho",
    "min": 0,
    "max": 3,
    "itens": [
      {
        "id": "molhoBarbecue",
        "nome": "Barbecue",
        "preco": 0
      },
      {
        "id": "molhoChimichurri",
        "nome": "Chimichurri",
        "preco": 0
      },
      {
        "id": "molhoMaioneseGrill",
        "nome": "Maionese Grill",
        "preco": 0
      },
      {
        "id": "molhoPicante",
        "nome": "Picante da Casa",
        "preco": 2
      }
    ]
  },
  "bebidaCombo": {
    "id": "bebidaCombo",
    "nome": "Escolha sua bebida",
    "min": 0,
    "max": 1,
    "itens": [
      {
        "id": "guaranaLata",
        "nome": "Guaraná Antárctica Lata",
        "preco": 0
      },
      {
        "id": "cocaLata",
        "nome": "Coca-Cola Lata",
        "preco": 0
      },
      {
        "id": "suco300",
        "nome": "Suco Natural 300ml",
        "preco": 4
      }
    ]
  }
};
export var COUPONS = {
  "TCC10": {
    "tipo": "pct",
    "valor": 10,
    "label": "10% de desconto"
  },
  "BEMVINDO8": {
    "tipo": "valor",
    "valor": 8,
    "label": "R$ 8,00 de desconto"
  }
};
export var REVIEWS_MOCK = {
  "pt01": [
    {
      "autor": "Marcos S.",
      "estrelas": 5,
      "comentario": "Bacon crocante demais, melhor cheddar bacon que já comi.",
      "data": "2026-08-10"
    },
    {
      "autor": "Juliana R.",
      "estrelas": 4,
      "comentario": "Muito bom, só achei o pão meio doce pro meu gosto.",
      "data": "2026-08-05"
    }
  ],
  "pt02": [
    {
      "autor": "Felipe A.",
      "estrelas": 5,
      "comentario": "O chimichurri fez toda diferença, e a bebida grátis foi um mimo.",
      "data": "2026-08-12"
    }
  ],
  "tr01": [
    {
      "autor": "Camila O.",
      "estrelas": 4,
      "comentario": "Clássico bem feito, maionese da casa é ótima.",
      "data": "2026-07-28"
    },
    {
      "autor": "Diego P.",
      "estrelas": 3,
      "comentario": "Bom, mas chegou um pouco frio.",
      "data": "2026-07-20"
    }
  ],
  "au02": [
    {
      "autor": "Renata M.",
      "estrelas": 5,
      "comentario": "A picanha na brasa é surreal, farofa combina perfeito.",
      "data": "2026-08-14"
    }
  ],
  "cb01": [
    {
      "autor": "Bruno T.",
      "estrelas": 5,
      "comentario": "Combo com ótimo custo-benefício, fritas sempre crocantes.",
      "data": "2026-08-01"
    }
  ]
};
