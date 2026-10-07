import { useEffect, useRef, useState } from "react";
import { ADDON_GROUPS } from "../data/data.js";
import { fmt, precoBase } from "../utils/utils.js";
import { useApp } from "../context/AppContext.jsx";
import { ModalSheet } from "../App.jsx";
import { Estrelas } from "./menu.jsx";

// Ficha completa de um item do cardápio: imagem, favoritar, personalização
// "monte do seu jeito" (Ingredientes), grupos de adicionais (AddonGroup),
// salvar como combo (SalvarCombo), avaliações (Reviews) e o rodapé fixo com
// seletor de quantidade + botão "Adicionar" com o total já calculado.
export function ProductSheet() {
  const {
    produtoAtual,
    productSheetOpen,
    fecharProduto,
    isFavorito,
    toggleFavorito,
    qtdAtual,
    incQtd,
    decQtd,
    calcularTotalProduto,
    adicionarProdutoAoCarrinho,
  } = useApp();

  // O sheet fica sempre no DOM (inert quando fechado, ver ModalSheet), mas
  // só faz sentido montar o conteúdo quando existe um produto selecionado.
  const item = produtoAtual;

  return (
    <ModalSheet
      open={productSheetOpen}
      className="product-sheet"
      overlayClassName="product-overlay"
      ariaLabel="Detalhes do item"
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Voltar" onClick={fecharProduto}>
          ←
        </button>
        <h2>{item ? item.nome : "Item"}</h2>
      </div>
      <div className="product-body">
        {item && (
          <>
            <div className="product-hero">
              {item.imgUrl ? (
                <img src={item.imgUrl} alt={item.nome} loading="lazy" />
              ) : (
                <span aria-hidden="true">{item.img}</span>
              )}
              <button
                className={"btn-favorito grande" + (isFavorito(item.id) ? " ativo" : "")}
                aria-label={
                  isFavorito(item.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"
                }
                aria-pressed={isFavorito(item.id)}
                onClick={() => toggleFavorito(item.id)}
              >
                {isFavorito(item.id) ? "♥" : "♡"}
              </button>
            </div>
            <div className="product-desc">
              <p>{item.desc}</p>
              <div className="product-preco-base" style={{ marginTop: ".6rem" }}>
                {fmt(precoBase(item))}
              </div>
            </div>
            <Ingredientes item={item} />
            {(item.addons || []).map((groupId) => (
              <AddonGroup key={groupId} groupId={groupId} />
            ))}
            <SalvarCombo item={item} />
            <Reviews itemId={item.id} />
          </>
        )}
      </div>
      <div className="product-foot">
        <div className="qtd-ctrl grande">
          <button aria-label="Diminuir quantidade" onClick={decQtd}>
            –
          </button>
          <span>{qtdAtual}</span>
          <button aria-label="Aumentar quantidade" onClick={incQtd}>
            +
          </button>
        </div>
        <button className="btn-continuar" onClick={adicionarProdutoAoCarrinho}>
          Adicionar · <span>{fmt(calcularTotalProduto())}</span>
        </button>
      </div>
    </ModalSheet>
  );
}

// Um grupo de adicionais pagos (ex. "Turbine seu Hambúrguer") com contador
// +/- por item, respeitando o mínimo/máximo do grupo (a validação em si
// acontece em AppContext#adicionarProdutoAoCarrinho e #alterarAddonQtd).
export function AddonGroup({ groupId }) {
  const { selecaoAddons, alterarAddonQtd } = useApp();
  const group = ADDON_GROUPS[groupId];
  const sel = selecaoAddons[groupId] || {};

  return (
    <div className="addon-group">
      <div className="addon-group-head">
        <h3>{group.nome}</h3>
        <div className="addon-group-meta">
          Mínimo: {group.min} &nbsp;&nbsp; Máximo: {group.max}
        </div>
      </div>
      {group.itens.map((ad) => {
        const qtd = sel[ad.id] || 0;
        return (
          <div className="addon-item" key={ad.id}>
            <div>
              <div className="addon-nome">{ad.nome}</div>
              <span className={"addon-preco" + (ad.preco === 0 ? " gratis" : "")}>
                {ad.preco === 0 ? "Grátis" : "+ " + fmt(ad.preco)}
              </span>
            </div>
            <div className="qtd-ctrl">
              <button
                aria-label={`Diminuir ${ad.nome}`}
                onClick={() => alterarAddonQtd(groupId, ad.id, -1)}
              >
                –
              </button>
              <span>{qtd}</span>
              <button
                aria-label={`Aumentar ${ad.nome}`}
                onClick={() => alterarAddonQtd(groupId, ad.id, 1)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Personalização "monte do seu jeito": remove/devolve ingredientes padrão do
// item, no molde do app do McDonald's. Não altera o preço, só remoção/
// inclusão dos ingredientes que já vêm no item (só aparece em itens que têm
// `ingredientes` em data.js).
export function Ingredientes({ item }) {
  const { selecaoIngredientes, toggleIngrediente } = useApp();
  if (!item.ingredientes || !item.ingredientes.length) return null;

  return (
    <div className="ingredientes-group">
      <div className="addon-group-head">
        <h3>Monte do seu jeito</h3>
        <div className="addon-group-meta">
          Toque num ingrediente pra remover ou trazer de volta
        </div>
      </div>
      {item.ingredientes.map((nome, i) => {
        const removido = !!selecaoIngredientes[i];
        return (
          <button
            key={i}
            type="button"
            className={"ingrediente-item" + (removido ? " removido" : "")}
            aria-pressed={removido}
            aria-label={removido ? `Adicionar ${nome} de volta` : `Remover ${nome}`}
            onClick={() => toggleIngrediente(i)}
          >
            <span className="ingrediente-check" aria-hidden="true">
              {removido ? "↺" : "✕"}
            </span>
            <span className="ingrediente-nome">{nome}</span>
          </button>
        );
      })}
    </div>
  );
}

// Botão "Salvar esse jeito como favorito" — só aparece quando há alguma
// personalização (adicionais pagos e/ou ingredientes removidos) na seleção
// atual da ficha do produto.
export function SalvarCombo({ item }) {
  const { temPersonalizacao, salvarComboAtual } = useApp();
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState(`Meu ${item.nome}`);

  if (!temPersonalizacao()) return null;

  function onSubmit(e) {
    e.preventDefault();
    salvarComboAtual(nome.trim() || `Meu ${item.nome}`);
    setFormAberto(false);
    setNome(`Meu ${item.nome}`);
  }

  return (
    <div className="salvar-combo">
      <button
        type="button"
        className="btn-salvar-combo"
        onClick={() => setFormAberto((v) => !v)}
      >
        ⭐ Salvar esse jeito como favorito
      </button>
      {formAberto && (
        <form className="salvar-combo-form" onSubmit={onSubmit}>
          <input
            type="text"
            maxLength={40}
            placeholder="Nome pra esse combo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
          />
          <button type="submit">Salvar</button>
        </form>
      )}
    </div>
  );
}

// "AAAA-MM-DD" -> "10 ago" (formato curto em pt-BR usado no cabeçalho de cada review).
function formatarData(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Lista de avaliações do item (mock + do usuário, ver
// AppContext#getReviews) + formulário pra deixar uma nova avaliação, com
// foto opcional (lida como base64 via FileReader, nunca enviada a lugar
// nenhum — fica só no localStorage deste navegador).
export function Reviews({ itemId }) {
  const { getReviews, mediaEstrelas, enviarAvaliacao, pedidoAvaliandoId, showToast } =
    useApp();
  const [novaEstrelas, setNovaEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [fotoReview, setFotoReview] = useState(null);
  const formRef = useRef(null);

  function onEscolherFoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFotoReview(reader.result);
    reader.readAsDataURL(file);
  }

  const reviews = getReviews(itemId);
  const { media, total } = mediaEstrelas(itemId);

  // Veio do fluxo "Avaliar pedido" (Pedidos → pedido entregue) — rola até o
  // formulário de avaliação assim que a ficha do produto termina de abrir.
  useEffect(() => {
    if (!pedidoAvaliandoId) return;
    const t = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onEnviar() {
    if (novaEstrelas === 0) {
      showToast("Escolha de 1 a 5 estrelas");
      return;
    }
    if (!comentario.trim()) {
      showToast("Escreva uma pequena descrição da sua avaliação");
      return;
    }
    enviarAvaliacao(itemId, novaEstrelas, comentario.trim(), fotoReview);
    setNovaEstrelas(0);
    setComentario("");
    setFotoReview(null);
  }

  return (
    <div className="reviews-group">
      <div className="reviews-summary">
        <div className="reviews-media">{total ? media.toFixed(1) : "—"}</div>
        <div className="reviews-media-meta">
          <Estrelas valor={media} />
          <span className="reviews-contagem">
            {total} {total === 1 ? "avaliação" : "avaliações"}
          </span>
        </div>
      </div>

      {reviews.length ? (
        reviews.map((r, i) => (
          <div className="review-item" key={i}>
            <div className="review-head">
              <span className="review-autor">{r.autor}</span>
              <span className="review-data">{formatarData(r.data)}</span>
            </div>
            <Estrelas valor={r.estrelas} />
            <p className="review-comentario">{r.comentario}</p>
            {r.foto && <img className="review-foto" src={r.foto} alt="Foto do pedido" />}
          </div>
        ))
      ) : (
        <div className="review-sem">
          Ainda não há avaliações para este item. Seja o primeiro a avaliar!
        </div>
      )}

      <div className="review-form" ref={formRef}>
        <h4>Deixe sua avaliação</h4>
        <div
          className="star-picker"
          role="radiogroup"
          aria-label="Nota de 1 a 5 estrelas"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= novaEstrelas ? "ativa" : ""}
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              aria-pressed={novaEstrelas === n}
              onClick={() => setNovaEstrelas(n)}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          maxLength={240}
          placeholder="Conte como foi seu pedido..."
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <div className="review-foto-campo">
          <label htmlFor="reviewFoto">Adicionar foto (opcional)</label>
          <input id="reviewFoto" type="file" accept="image/*" onChange={onEscolherFoto} />
          {fotoReview && <img className="review-foto-preview" src={fotoReview} alt="" />}
        </div>
        <button className="btn-enviar-review" onClick={onEnviar}>
          Enviar avaliação
        </button>
      </div>
    </div>
  );
}
