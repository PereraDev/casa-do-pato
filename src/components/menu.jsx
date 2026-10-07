import { CATEGORIES, MENU } from "../data/data.js";
import { useApp } from "../context/AppContext.jsx";
import { fmt, getConfigFidelidade, getContaFidelidade, getNivel, saldoPontos } from "../utils/utils.js";
import { ModalSheet } from "../App.jsx";

// Faixa do Clube de Fidelidade fixada logo abaixo das abas de categoria, no
// topo do cardápio — antes só era acessível de dentro de "Sua conta". O
// botão "USAR MEUS PONTOS" abre direto a janela de resgate de recompensas
// (FidelidadeSheet), sem precisar passar pelo painel de conta primeiro.
export function FidelidadeBanner() {
  const { sessao, abrirFidelidade, abrirConta } = useApp();
  const logado = sessao?.tipo === "usuario";

  if (!logado) {
    return (
      <button
        type="button"
        className="fidelidade-banner fidelidade-banner-convite"
        onClick={abrirConta}
      >
        <span className="fidelidade-banner-icon" aria-hidden="true">
          🏅
        </span>
        <span className="fidelidade-banner-texto">
          Entre na sua conta pra acumular pontos e cashback a cada pedido
        </span>
        <span className="fidelidade-banner-seta" aria-hidden="true">
          ›
        </span>
      </button>
    );
  }

  const config = getConfigFidelidade();
  const conta = getContaFidelidade(sessao.email);
  const nivel = getNivel(conta.pontosVitalicios, config.niveis);
  const saldo = saldoPontos(conta);

  return (
    <div className="fidelidade-banner">
      <span className="fidelidade-banner-icon" aria-hidden="true">
        🏅
      </span>
      <div className="fidelidade-banner-texto">
        <div className="fidelidade-banner-nivel">
          {nivel.nome} · {saldo} ponto(s)
        </div>
        {conta.cashback > 0 && (
          <div className="fidelidade-banner-cashback">
            {fmt(conta.cashback)} de cashback disponível
          </div>
        )}
      </div>
      <button type="button" className="btn-usar-pontos" onClick={abrirFidelidade}>
        Usar meus pontos
      </button>
    </div>
  );
}

// Lista o cardápio inteiro, agrupado por categoria (uma seção com carrossel
// horizontal por categoria) e filtrado pelo termo de busca de texto — a
// menos que exista um resultado de busca por IA, caso em que essas seções
// desaparecem e viram uma única lista ordenada pela relevância que a IA
// devolveu (ver AppContext#buscarComIA).
export function MenuSections() {
  const { termoBusca, iaResultado } = useApp();
  const termo = termoBusca.trim().toLowerCase();

  // Com resposta da IA presente, ela substitui o agrupamento por categoria
  // por uma lista única ordenada pela relevância que a IA devolveu (ver
  // AppContext#buscarComIA) — cai fora assim que a busca é limpa.
  if (iaResultado) {
    const itens = iaResultado.itemIds.map((id) => MENU.find((m) => m.id === id)).filter(Boolean);
    if (!itens.length) {
      return (
        <p style={{ color: "var(--ink-soft)", textAlign: "center", padding: "3rem 1rem" }}>
          A IA não encontrou nenhum prato pra essa pergunta. Tente reformular.
        </p>
      );
    }
    return (
      <section className="cardapio-secao" aria-label="Sugestões da IA">
        <div className="secao-titulo">
          <h2>✨ Sugestões da IA</h2>
          <span className="contagem">
            {itens.length} {itens.length === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="carrossel">
          {itens.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    );
  }

  const secoes = CATEGORIES.map((cat) => {
    const itens = MENU.filter((m) => m.cat === cat.id).filter(
      (m) => !termo || (m.nome + " " + m.desc).toLowerCase().includes(termo),
    );
    return { cat, itens };
  }).filter((s) => s.itens.length > 0);

  if (!secoes.length) {
    return (
      <p style={{ color: "var(--ink-soft)", textAlign: "center", padding: "3rem 1rem" }}>
        Nenhum prato encontrado. Tente outra busca.
      </p>
    );
  }

  return (
    <>
      {secoes.map(({ cat, itens }) => (
        <section
          key={cat.id}
          className="cardapio-secao"
          id={`secao-${cat.id}`}
          aria-labelledby={`tit-${cat.id}`}
        >
          <div className="secao-titulo">
            <h2 id={`tit-${cat.id}`}>
              {cat.icon} {cat.label}
            </h2>
            <span className="contagem">
              {itens.length} {itens.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <div className="carrossel">
            {itens.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// Conteúdo de "Favoritos": combos personalizados salvos (ver ComboCard) +
// itens simples favoritados (ver ItemCard), ambos filtrados pela busca de
// texto e pelo que ainda existe no cardápio atual. Reaproveitado dentro do
// FavoritesSheet (janela própria) abaixo.
export function FavoritesSection() {
  const { favoritos, favoritosPersonalizados, termoBusca, irParaInicio } =
    useApp();
  const termo = termoBusca.trim().toLowerCase();

  const itens = MENU.filter((m) => favoritos.includes(m.id)).filter(
    (m) => !termo || (m.nome + " " + m.desc).toLowerCase().includes(termo),
  );
  const combos = favoritosPersonalizados.filter((f) =>
    MENU.some((m) => m.id === f.itemId),
  );

  if (!combos.length && !itens.length) {
    return (
      <div className="favoritos-vazio">
        <span aria-hidden="true">♡</span>
        <p>
          Você ainda não favoritou nenhum item.
          <br />
          Toque no coração de um prato para guardá-lo aqui.
        </p>
        <button
          type="button"
          className="btn-visitante estado-vazio-btn"
          onClick={irParaInicio}
        >
          Explorar cardápio
        </button>
      </div>
    );
  }

  return (
    <>
      {combos.length > 0 && (
        <section className="cardapio-secao" aria-labelledby="tit-combos-salvos">
          <div className="secao-titulo">
            <h2 id="tit-combos-salvos">⭐ Meus combos salvos</h2>
            <span className="contagem">
              {combos.length} {combos.length === 1 ? "combo" : "combos"}
            </span>
          </div>
          <div className="lista-combos">
            {combos.map((fav) => (
              <ComboCard key={fav.id} fav={fav} />
            ))}
          </div>
        </section>
      )}
      {itens.length > 0 && (
        <section className="cardapio-secao" aria-labelledby="tit-favoritos">
          <div className="secao-titulo">
            <h2 id="tit-favoritos">♥ Favoritos</h2>
            <span className="contagem">
              {itens.length} {itens.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <div className="carrossel grade-favoritos">
            {itens.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// Janela própria de Favoritos, aberta a partir do item de menu "Favoritos"
// em "Sua conta" (ver components/account.jsx#AccountSheet) — em vez de
// mostrar a seção embutida no painel de conta.
export function FavoritesSheet() {
  const { favoritosOpen, fecharFavoritos } = useApp();

  return (
    <ModalSheet
      open={favoritosOpen}
      className="favoritos-sheet"
      overlayClassName="favoritos-overlay"
      ariaLabel="Favoritos"
      onOverlayClick={fecharFavoritos}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Voltar" onClick={fecharFavoritos}>
          ←
        </button>
        <h2>♥ Favoritos</h2>
      </div>
      <div className="product-body">
        <FavoritesSection />
      </div>
    </ModalSheet>
  );
}

// Card de um item do cardápio: imagem, tag de promoção/novidade, favoritar,
// nota média (Estrelas) e preço (com o riscado quando há promoção). O card
// inteiro é clicável (role="button", também responde a Enter) e abre a
// ficha do produto — o botão de favorito para a propagação do clique
// (stopPropagation) pra não abrir a ficha ao só favoritar.
export function ItemCard({ item }) {
  const { abrirProduto, isFavorito, toggleFavorito, mediaEstrelas } = useApp();
  const promo = item.precoPromo != null && item.precoPromo < item.preco;
  const { media, total } = mediaEstrelas(item.id);
  const favoritado = isFavorito(item.id);

  return (
    <article
      className="item-card"
      role="button"
      tabIndex={0}
      onClick={() => abrirProduto(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") abrirProduto(item.id);
      }}
    >
      <div className="item-imagem">
        {item.tag && <span className="item-tag">{item.tag}</span>}
        {item.descontoPct && (
          <span className="item-desconto">{item.descontoPct}%</span>
        )}
        <button
          className={"btn-favorito" + (favoritado ? " ativo" : "")}
          aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={favoritado}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorito(item.id);
          }}
        >
          {favoritado ? "♥" : "♡"}
        </button>
        {item.imgUrl ? (
          <img src={item.imgUrl} alt={item.nome} loading="lazy" />
        ) : (
          <span aria-hidden="true">{item.img}</span>
        )}
      </div>
      <div className="item-info">
        <h3>{item.nome}</h3>
        <p>{item.desc}</p>
        {total > 0 && (
          <div className="card-rating">
            <Estrelas valor={media} /> <span>{media.toFixed(1)} ({total})</span>
          </div>
        )}
        <div className="item-precos">
          {promo && <span className="item-preco-riscado">{fmt(item.preco)}</span>}
          <span className="item-preco">{fmt(promo ? item.precoPromo : item.preco)}</span>
        </div>
      </div>
    </article>
  );
}

// Card de um combo personalizado salvo como favorito ("meu pedido de
// sempre", no molde do Starbucks) — adicionais pagos + ingredientes
// removidos, com nome próprio, reutilizável com um toque a partir daqui.
export function ComboCard({ fav }) {
  const { precoComboPersonalizado, adicionarFavoritoPersonalizadoAoCarrinho, removerFavoritoPersonalizado } =
    useApp();
  const item = MENU.find((m) => m.id === fav.itemId);
  if (!item) return null;

  const addonsTxt = fav.addons.length
    ? fav.addons.map((a) => `${a.qtd}x ${a.nome}`).join(", ")
    : "";
  const removidosTxt = fav.ingredientesRemovidos.length
    ? `Sem ${fav.ingredientesRemovidos.join(", ")}`
    : "";

  return (
    <div className="combo-card">
      <div className="combo-info">
        <h4>{fav.nome}</h4>
        <div className="combo-base">{item.nome}</div>
        {addonsTxt && <div className="addons-resumo">{addonsTxt}</div>}
        {removidosTxt && (
          <div className="addons-resumo removidos-resumo">{removidosTxt}</div>
        )}
        <div className="combo-preco">{fmt(precoComboPersonalizado(fav))}</div>
      </div>
      <div className="combo-acoes">
        <button
          type="button"
          className="btn-avaliar-pedido"
          onClick={() => adicionarFavoritoPersonalizadoAoCarrinho(fav.id)}
        >
          Adicionar
        </button>
        <button
          type="button"
          className="combo-remover"
          aria-label="Remover combo salvo"
          onClick={() => removerFavoritoPersonalizado(fav.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Renderiza de 1 a 5 estrelas, arredondando um valor decimal (média) pra
// estrela cheia mais próxima na exibição.
export function Estrelas({ valor, tamanho }) {
  const cheias = Math.round(valor);
  return (
    <span className="estrelas" style={tamanho ? { fontSize: tamanho } : undefined}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= cheias ? "" : "vazia"}>
          ★
        </span>
      ))}
    </span>
  );
}

// Faixa de reengajamento (estilo "sentimos sua falta" do McDonald's/iFood) —
// só aparece pra quem está logado e já não pede há alguns dias (ver
// utils/utils.js#getOfertaPersonalizada). Dispensável: some até a próxima
// recarga da página se a pessoa fechar sem aplicar.
export function OfertaPersonalizada() {
  const { ofertaPersonalizadaAtual, aplicarOfertaPersonalizada, dispensarOfertaPersonalizada } =
    useApp();
  const oferta = ofertaPersonalizadaAtual();
  if (!oferta) return null;

  return (
    <div className="oferta-personalizada">
      <span className="oferta-personalizada-icon" aria-hidden="true">
        🎯
      </span>
      <div className="oferta-personalizada-texto">
        <div className="oferta-personalizada-titulo">{oferta.titulo}</div>
        <div className="oferta-personalizada-sub">{oferta.texto}</div>
      </div>
      <button type="button" className="btn-usar-pontos" onClick={aplicarOfertaPersonalizada}>
        Aplicar
      </button>
      <button
        type="button"
        className="icon-btn oferta-personalizada-fechar"
        aria-label="Dispensar oferta"
        onClick={dispensarOfertaPersonalizada}
      >
        ✕
      </button>
    </div>
  );
}
