import { useEffect, useState } from "react";
import { fmt, PAGAMENTO_CHECKOUT } from "../utils/utils.js";
import { useApp } from "../context/AppContext.jsx";
import { ModalSheet } from "../App.jsx";

// Checkout simulado (Pix / Cartão / Dinheiro), generalizado a partir de um
// único sheet: PAGAMENTO_CHECKOUT muda título/ícone/instrução/texto do botão
// conforme a forma de pagamento escolhida no carrinho. Pix ganha um Copia e
// Cola pra colar no app do banco (simulado); Dinheiro em nota mostra o
// troco calculado no carrinho (ver components/cart.jsx#FormaPagamento).
export function PixSheet() {
  const {
    pixOpen,
    fecharPix,
    formaPagamento,
    pixEtapa,
    pixCarregando,
    simularPagamento,
    totalComDesconto,
    gerarPixCopiaCola,
    dinheiroOpcao,
    precisaTroco,
    valorTroco,
    trocoCalculado,
    showToast,
  } = useApp();
  const [copiaCola, setCopiaCola] = useState("");
  // PixSheet nunca desmonta (ModalSheet fica sempre no DOM, ver App.jsx) —
  // gera um código novo a cada checkout que abre, não só na primeira vez.
  useEffect(() => {
    if (pixOpen) setCopiaCola(gerarPixCopiaCola());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a pixOpen abrir, gerarPixCopiaCola já lê o total mais recente na hora
  }, [pixOpen]);

  const info = PAGAMENTO_CHECKOUT[formaPagamento] || PAGAMENTO_CHECKOUT.pix;
  const passos = ["aguardando", "confirmado", "preparo"];
  const idxAtual = passos.indexOf(pixEtapa);

  function copiarPix() {
    navigator.clipboard?.writeText(copiaCola);
    showToast("Código Pix copiado!");
  }

  return (
    <ModalSheet
      open={pixOpen}
      className="pix-sheet"
      overlayClassName="pix-overlay"
      ariaLabel={info.titulo}
      onOverlayClick={fecharPix}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Fechar" onClick={fecharPix}>
          ←
        </button>
        <h2>{info.titulo}</h2>
      </div>

      <div className="pix-body">
        <div className="pix-status-track">
          {passos.map((step, idx) => (
            <div
              key={step}
              className={
                "pix-status-step" +
                (idx < idxAtual || (idx === idxAtual && pixEtapa === "preparo")
                  ? " concluido"
                  : "") +
                (idx === idxAtual ? " atual" : "")
              }
            >
              <span className="pix-status-dot"></span>
              <span className="pix-status-label">
                {step === "aguardando"
                  ? "Aguardando pagamento"
                  : step === "confirmado"
                    ? "Pagamento confirmado"
                    : "Em preparação"}
              </span>
            </div>
          ))}
        </div>

        {pixEtapa === "aguardando" ? (
          <div className="pix-painel">
            <div className="pix-qr" aria-hidden="true">
              {info.icone}
            </div>
            <p className="pix-instrucao">{info.instrucao}</p>

            {formaPagamento === "pix" && (
              <div className="pix-copia-cola">
                <span className="pix-copia-cola-label">Pix Copia e Cola</span>
                <div className="pix-copia-cola-row">
                  <code>{copiaCola}</code>
                  <button type="button" onClick={copiarPix}>
                    Copiar
                  </button>
                </div>
              </div>
            )}

            {formaPagamento === "dinheiro" && dinheiroOpcao === "nota" && precisaTroco && valorTroco && (
              <div className="pix-troco-resumo">
                Você vai pagar com {fmt(Number(String(valorTroco).replace(",", ".")) || 0)} — troco de{" "}
                <b>{fmt(trocoCalculado())}</b>
              </div>
            )}

            <div className="pix-total-row">
              <span>Total do pedido</span>
              <span>{fmt(totalComDesconto())}</span>
            </div>
            <button
              className="btn-continuar"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={pixCarregando}
              onClick={simularPagamento}
            >
              {pixCarregando ? info.botaoCarregando : info.botao}
            </button>
          </div>
        ) : (
          <div className="pix-painel">
            <div className="pix-check" aria-hidden="true">
              ✓
            </div>
            <p className="pix-instrucao pix-sucesso">
              Pagamento confirmado! Seu pedido já foi enviado para a cozinha.
            </p>
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
