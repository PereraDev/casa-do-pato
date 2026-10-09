import { useState } from "react";
import { MENU, UPSELL_IDS } from "../data/data.js";
import { fmt, precoBase, getCartoesSalvos } from "../utils/utils.js";
import { useApp } from "../context/AppContext.jsx";
import { ModalSheet } from "../App.jsx";
import { FotoItem } from "./menu.jsx";

// O carrinho completo: pedido em grupo (GrupoPedido), lista de itens
// (CartItem), campos do pedido (PedidoInfo), sugestões de acompanhamento
// (Upsell), cupom/divisão da conta (CartExtra) e o rodapé fixo com o total
// (com desconto riscado quando aplicável) e o botão que chama
// AppContext#finalizarPedido.
export function CartDrawer() {
  const {
    itensAtivos,
    cartOpen,
    fecharCarrinho,
    irParaInicio,
    totalCarrinho,
    totalComDesconto,
    finalizarPedido,
  } = useApp();

  const subtotal = totalCarrinho();
  const totalFinal = totalComDesconto();

  return (
    <ModalSheet
      open={cartOpen}
      as="aside"
      className="cart-drawer"
      overlayClassName="cart-overlay"
      ariaLabel="Carrinho de pedidos"
      onOverlayClick={fecharCarrinho}
    >
      <div className="cart-head">
        <h2>Meus pedidos</h2>
        <button className="icon-btn" aria-label="Fechar carrinho" onClick={fecharCarrinho}>
          ✕
        </button>
      </div>

      <div className="cart-body">
        <GrupoPedido />
        {!itensAtivos.length ? (
          <div className="cart-empty">
            <span aria-hidden="true">🛒</span>
            <p>
              Seu carrinho está vazio.
              <br />
              Adicione itens do cardápio para começar.
            </p>
            <button
              type="button"
              className="btn-visitante estado-vazio-btn"
              onClick={() => {
                fecharCarrinho();
                irParaInicio();
              }}
            >
              Ver cardápio
            </button>
          </div>
        ) : (
          <>
            {itensAtivos.map((linha, idx) => (
              <CartItem key={idx} linha={linha} idx={idx} />
            ))}
            <Upsell />
            <PedidoInfo />
          </>
        )}
      </div>

      <div className="cart-foot">
        <div className="cart-extra-wrap">{itensAtivos.length > 0 && <CartExtra />}</div>
        <div className="cart-total-row">
          <span>Total</span>
          <span>
            {totalFinal < subtotal ? (
              <>
                <span className="total-riscado">{fmt(subtotal)}</span> {fmt(totalFinal)}
              </>
            ) : (
              fmt(subtotal)
            )}
          </span>
        </div>
        <button
          className="btn-continuar"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={finalizarPedido}
        >
          Ir para pagamento 🔥
        </button>
      </div>
    </ModalSheet>
  );
}

// Uma linha do carrinho: ícone, nome, quem pediu (só em grupo), resumo dos
// adicionais/ingredientes removidos dessa personalização específica,
// controle de quantidade e botão remover. `idx` é a posição na lista (não
// o id do item) — é o que AppContext usa pra achar a linha certa a alterar,
// já que o mesmo prato pode aparecer em mais de uma linha com personalizações diferentes.
export function CartItem({ linha, idx }) {
  const { removerDoCarrinho, incQtdCarrinho, decQtdCarrinho } = useApp();
  const item = MENU.find((m) => m.id === linha.itemId);
  if (!item) return null;

  const subtotal = linha.precoUnitario * linha.qtd;
  const addonsTxt = linha.addons.length
    ? linha.addons.map((a) => `${a.qtd}x ${a.nome}`).join(", ")
    : "";
  const removidosTxt = (linha.ingredientesRemovidos || []).length
    ? `Sem ${linha.ingredientesRemovidos.join(", ")}`
    : "";

  return (
    <div className="cart-item">
      <span className="icon" aria-hidden="true">
        {item.img}
      </span>
      <div className="info">
        <h4>{item.nome}</h4>
        {linha.participanteNome && (
          <div className="cart-item-participante">🧑‍🤝‍🧑 {linha.participanteNome}</div>
        )}
        {addonsTxt && <div className="addons-resumo">{addonsTxt}</div>}
        {removidosTxt && (
          <div className="addons-resumo removidos-resumo">{removidosTxt}</div>
        )}
        <div className="linha-baixo">
          <div className="qtd-ctrl" role="group" aria-label={`Quantidade de ${item.nome}`}>
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={() => decQtdCarrinho(idx)}
            >
              –
            </button>
            <span>{linha.qtd}</span>
            <button
              type="button"
              aria-label="Aumentar quantidade"
              onClick={() => incQtdCarrinho(idx)}
            >
              +
            </button>
          </div>
          <span className="preco-item">{fmt(subtotal)}</span>
          <button className="remover" onClick={() => removerDoCarrinho(idx)}>
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}

// Campos de observações, tipo de pedido, agendamento (não pra mesa — ver
// "Reservar mesa" no perfil), mesa/endereço e forma de pagamento, exibidos
// junto ao carrinho.
export function PedidoInfo() {
  const {
    observacoes,
    setObservacoes,
    tipoPedido,
    setTipoPedido,
    numeroMesa,
    setNumeroMesa,
    enderecoEntrega,
    setEnderecoEntrega,
    enderecos,
    salvarEndereco,
    selecionarEndereco,
    removerEndereco,
    agendamento,
    setAgendamento,
    pagamentoTiming,
    setPagamentoTiming,
    pagarDepoisComo,
    setPagarDepoisComo,
    dividindoAConta,
    setGarcomBarOpen,
  } = useApp();
  const [rotuloNovoEndereco, setRotuloNovoEndereco] = useState("");
  const dividindoPagamento = dividindoAConta();

  const hoje = new Date().toISOString().slice(0, 10);

  function onSalvarEndereco() {
    if (!rotuloNovoEndereco.trim() || !enderecoEntrega.trim()) return;
    salvarEndereco(rotuloNovoEndereco, enderecoEntrega);
    setRotuloNovoEndereco("");
  }

  return (
    <div className="pedido-info">
      <div className="obs-campo">
        <label htmlFor="inputObs">Observações do pedido</label>
        <textarea
          id="inputObs"
          placeholder="Ex.: sem cebola, ponto da carne, alergias..."
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>
      <div className="tipo-pedido-row">
        <button
          type="button"
          className={tipoPedido === "balcao" ? "ativo" : ""}
          onClick={() => setTipoPedido("balcao")}
        >
          Retirar no balcão
        </button>
        <button
          type="button"
          className={tipoPedido === "mesa" ? "ativo" : ""}
          onClick={() => setTipoPedido("mesa")}
        >
          Na mesa
        </button>
        <button
          type="button"
          className={tipoPedido === "entrega" ? "ativo" : ""}
          onClick={() => setTipoPedido("entrega")}
        >
          Entrega
        </button>
      </div>

      {tipoPedido !== "mesa" && (
        <div className="agendamento-campo">
          <div className="tipo-pedido-row">
            <button
              type="button"
              className={!agendamento ? "ativo" : ""}
              onClick={() => setAgendamento(null)}
            >
              Assim que possível
            </button>
            <button
              type="button"
              className={agendamento ? "ativo" : ""}
              onClick={() => setAgendamento({ data: hoje, hora: "" })}
            >
              📅 Agendar horário
            </button>
          </div>
          {agendamento && (
            <div className="agendamento-inputs">
              <input
                type="date"
                min={hoje}
                value={agendamento.data}
                onChange={(e) => setAgendamento({ ...agendamento, data: e.target.value })}
              />
              <input
                type="time"
                value={agendamento.hora}
                onChange={(e) => setAgendamento({ ...agendamento, hora: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      <div className={"mesa-campo" + (tipoPedido === "mesa" ? " mostrar" : "")}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Número da mesa"
          value={numeroMesa}
          onChange={(e) => setNumeroMesa(e.target.value)}
        />
        <button
          type="button"
          className="btn-chamar-garcom"
          onClick={() => setGarcomBarOpen(true)}
        >
          🔔 Chamar garçom
        </button>
      </div>

      <div className={"mesa-campo" + (tipoPedido === "entrega" ? " mostrar" : "")}>
        {enderecos.length > 0 && (
          <div className="enderecos-salvos">
            {enderecos.map((end) => (
              <span key={end.id} className="endereco-chip-wrap">
                <button
                  type="button"
                  className={"endereco-chip" + (enderecoEntrega === end.endereco ? " ativo" : "")}
                  onClick={() => selecionarEndereco(end.id)}
                >
                  📍 {end.rotulo}
                </button>
                <button
                  type="button"
                  className="endereco-chip-remover"
                  aria-label={`Remover endereço ${end.rotulo}`}
                  onClick={() => removerEndereco(end.id)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="Endereço completo (rua, número, bairro)"
          value={enderecoEntrega}
          onChange={(e) => setEnderecoEntrega(e.target.value)}
        />
        <div className="salvar-endereco-row">
          <input
            type="text"
            placeholder='Rótulo pra salvar (ex.: "Casa")'
            value={rotuloNovoEndereco}
            onChange={(e) => setRotuloNovoEndereco(e.target.value)}
          />
          <button type="button" onClick={onSalvarEndereco}>
            Salvar
          </button>
        </div>
      </div>

      {!dividindoPagamento && tipoPedido === "mesa" && (
        <div className="pagamento-timing">
          <div className="pagamento-titulo">Quando vai pagar?</div>
          <div className="tipo-pedido-row">
            <button
              type="button"
              className={pagamentoTiming === "agora" ? "ativo" : ""}
              onClick={() => setPagamentoTiming("agora")}
            >
              💳 Pagar agora
            </button>
            <button
              type="button"
              className={pagamentoTiming === "depois" ? "ativo" : ""}
              onClick={() => setPagamentoTiming("depois")}
            >
              ⏳ Pagar depois
            </button>
          </div>
          {pagamentoTiming === "depois" && (
            <div className="tipo-pedido-row">
              <button
                type="button"
                className={pagarDepoisComo === "garcom" ? "ativo" : ""}
                onClick={() => setPagarDepoisComo("garcom")}
              >
                🔔 Chamando o garçom
              </button>
              <button
                type="button"
                className={pagarDepoisComo === "caixa" ? "ativo" : ""}
                onClick={() => setPagarDepoisComo("caixa")}
              >
                🧾 Pagando no caixa
              </button>
            </div>
          )}
        </div>
      )}

      {!dividindoPagamento && (tipoPedido !== "mesa" || pagamentoTiming === "agora") && (
        <FormaPagamento />
      )}
    </div>
  );
}

const FORMAS = [
  { id: "pix", label: "⚡ Pix" },
  { id: "cartao", label: "💳 Cartão" },
  { id: "dinheiro", label: "💵 Dinheiro" },
];

// Forma de pagamento do carrinho — Pix (gera Copia e Cola no checkout, ver
// components/checkout.jsx#PixSheet), Cartão (escolhe entre cartões salvos na
// Carteira ou, só em entrega, pagar na maquininha do motoboy) e Dinheiro
// (usar saldo da carteira ou pagar em nota física, com calculadora de troco
// — mesmo cálculo do PDV do admin, agora do lado do cliente). Só aparece
// quando não tá dividindo a conta e, numa mesa, só quando "Pagar agora" está
// selecionado (ver PedidoInfo acima).
export function FormaPagamento() {
  const {
    formaPagamento,
    setFormaPagamento,
    tipoPedido,
    sessao,
    cartaoEscolhidoId,
    setCartaoEscolhidoId,
    dinheiroOpcao,
    escolherOpcaoDinheiro,
    precisaTroco,
    setPrecisaTroco,
    valorTroco,
    setValorTroco,
    trocoCalculado,
    totalComDesconto,
    saldoCashbackDisponivel,
  } = useApp();

  return (
    <>
      <div className="pagamento-titulo">Forma de pagamento</div>
      <div className="tipo-pedido-row">
        {FORMAS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={formaPagamento === id ? "ativo" : ""}
            onClick={() => setFormaPagamento(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {formaPagamento === "pix" && (
        <p className="conta-hint">Ao confirmar, você recebe um Pix Copia e Cola pra pagar.</p>
      )}

      {formaPagamento === "cartao" && (
        <SecaoCartao
          tipoPedido={tipoPedido}
          sessao={sessao}
          cartaoEscolhidoId={cartaoEscolhidoId}
          setCartaoEscolhidoId={setCartaoEscolhidoId}
        />
      )}

      {formaPagamento === "dinheiro" && (
        <SecaoDinheiro
          tipoPedido={tipoPedido}
          logado={sessao?.tipo === "usuario"}
          dinheiroOpcao={dinheiroOpcao}
          escolherOpcaoDinheiro={escolherOpcaoDinheiro}
          precisaTroco={precisaTroco}
          setPrecisaTroco={setPrecisaTroco}
          valorTroco={valorTroco}
          setValorTroco={setValorTroco}
          trocoCalculado={trocoCalculado}
          total={totalComDesconto()}
          saldoCarteira={saldoCashbackDisponivel()}
        />
      )}
    </>
  );
}

// Sub-escolha de "Cartão": lista os cartões salvos na Carteira do cliente
// logado, ou (só em entrega) a opção de pagar direto na maquininha do
// entregador — ver components/account.jsx#CarteiraSheet pra onde salvar um cartão.
function SecaoCartao({ tipoPedido, sessao, cartaoEscolhidoId, setCartaoEscolhidoId }) {
  const cartoes = sessao?.tipo === "usuario" ? getCartoesSalvos(sessao.email) : [];
  // Só conta como "na maquininha" em entrega — em outro tipo de pedido,
  // um cartaoEscolhidoId "motoboy" que sobrou de um pedido de entrega
  // anterior não pode esconder a lista de cartões salvos (ver AppContext).
  const naMaquininha = tipoPedido === "entrega" && cartaoEscolhidoId === "motoboy";

  return (
    <div className="pagamento-sub">
      {tipoPedido === "entrega" && (
        <div className="tipo-pedido-row">
          <button
            type="button"
            className={!naMaquininha ? "ativo" : ""}
            onClick={() => setCartaoEscolhidoId(cartoes[0]?.id || "")}
          >
            💳 Cartão salvo
          </button>
          <button
            type="button"
            className={naMaquininha ? "ativo" : ""}
            onClick={() => setCartaoEscolhidoId("motoboy")}
          >
            🛵 Na maquininha do motoboy
          </button>
        </div>
      )}
      {!naMaquininha &&
        (cartoes.length === 0 ? (
          <p className="conta-hint">
            Nenhum cartão salvo — adicione um na Carteira (👤 Sua conta → Carteira).
          </p>
        ) : (
          <div className="pagamento-cartoes-lista">
            {cartoes.map((c) => (
              <button
                key={c.id}
                type="button"
                className={"pagamento-cartao-opcao" + (cartaoEscolhidoId === c.id ? " ativo" : "")}
                onClick={() => setCartaoEscolhidoId(c.id)}
              >
                {c.bandeira} •••• {c.final4}
                {c.apelido ? ` — ${c.apelido}` : ""}
              </button>
            ))}
          </div>
        ))}
    </div>
  );
}

// Sub-escolha de "Dinheiro": usar o saldo da carteira (atalho pro toggle de
// cashback, ver AppContext#escolherOpcaoDinheiro) ou pagar em nota física,
// com calculadora de troco opcional (AppContext#trocoCalculado).
function SecaoDinheiro({
  tipoPedido,
  logado,
  dinheiroOpcao,
  escolherOpcaoDinheiro,
  precisaTroco,
  setPrecisaTroco,
  valorTroco,
  setValorTroco,
  trocoCalculado,
  total,
  saldoCarteira,
}) {
  const quemRecebe =
    tipoPedido === "entrega" ? "pro entregador" : tipoPedido === "mesa" ? "pro garçom" : "no caixa";

  return (
    <div className="pagamento-sub">
      <div className="tipo-pedido-row">
        <button
          type="button"
          className={dinheiroOpcao === "carteira" ? "ativo" : ""}
          disabled={!logado || saldoCarteira <= 0}
          onClick={() => escolherOpcaoDinheiro("carteira")}
        >
          👛 Usar saldo da carteira{logado && saldoCarteira > 0 ? ` (${fmt(saldoCarteira)})` : ""}
        </button>
        <button
          type="button"
          className={dinheiroOpcao === "nota" ? "ativo" : ""}
          onClick={() => escolherOpcaoDinheiro("nota")}
        >
          💵 Pagar em nota {quemRecebe}
        </button>
      </div>

      {dinheiroOpcao === "nota" && (
        <div className="pagamento-troco">
          <div className="tipo-pedido-row">
            <button type="button" className={!precisaTroco ? "ativo" : ""} onClick={() => setPrecisaTroco(false)}>
              Não precisa de troco
            </button>
            <button type="button" className={precisaTroco ? "ativo" : ""} onClick={() => setPrecisaTroco(true)}>
              Vou precisar de troco
            </button>
          </div>
          {precisaTroco && (
            <div className="pagamento-troco-calc">
              <label htmlFor="valorTroco">Vai pagar com quanto?</label>
              <input
                id="valorTroco"
                type="text"
                inputMode="decimal"
                placeholder={fmt(total)}
                value={valorTroco}
                onChange={(e) => setValorTroco(e.target.value.replace(/[^\d.,]/g, ""))}
              />
              {valorTroco && <span className="pagamento-troco-resultado">Troco: {fmt(trocoCalculado())}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FORMAS_PAGAMENTO = [
  { id: "pix", label: "Pix" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
  { id: "dinheiro", label: "Dinheiro" },
];

// Chips de forma de pagamento por pessoa (Pix/Débito/Crédito/Dinheiro),
// reutilizados tanto no rateio igual quanto na divisão por participante
// (ver CartExtra abaixo) — mais granular que o seletor único de FormaPagamento.
function SeletorFormaPagamento({ ativo, onEscolher }) {
  return (
    <div className="tipo-pedido-row divisao-pagto-row">
      {FORMAS_PAGAMENTO.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={ativo === id ? "ativo" : ""}
          onClick={() => onEscolher(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Bloco extra do rodapé do carrinho: cupom de desconto, divisão da conta
// (quando "Na mesa") e tempo estimado — inspirados em iFood/Burger King
// (cupom) e iFood/Uber Eats (tempo estimado).
export function CartExtra() {
  const {
    cupomAplicado,
    aplicarCupom,
    removerCupom,
    usarCashbackNoCarrinho,
    setUsarCashbackNoCarrinho,
    saldoCashbackDisponivel,
    tipoPedido,
    grupoAtivo,
    pessoasDivisao,
    alterarPessoasDivisao,
    divisaoPagamentos,
    definirPagamentoDivisao,
    valoresDivisaoConta,
    divisaoModo,
    setDivisaoModo,
    valoresDivisaoPorParticipante,
    divisaoPagamentosPorNome,
    definirPagamentoDivisaoPorNome,
    estimarTempoPedido,
  } = useApp();
  const cashbackDisponivel = saldoCashbackDisponivel();
  const [inputCupom, setInputCupom] = useState("");
  const [cupomAberto, setCupomAberto] = useState(false);

  function onSubmitCupom(e) {
    e.preventDefault();
    aplicarCupom(inputCupom);
    setInputCupom("");
  }

  // A divisão "inteligente" (cada um paga o que pediu) só existe dentro de
  // um pedido em grupo — só ali cada item do carrinho carrega
  // participanteNome pra dar pra separar por pessoa. Com <2 participantes
  // com item no carrinho, cai direto no rateio igual de sempre.
  const porParticipante = valoresDivisaoPorParticipante();
  const temDivisaoInteligente = Boolean(grupoAtivo) && porParticipante.length > 1;
  const mostrarRateioIgual = !temDivisaoInteligente || divisaoModo === "igual";

  const eta = estimarTempoPedido();
  const etaTxt =
    tipoPedido === "entrega" ? `🛵 Chega em ~${eta} min` : `⏱ Fica pronto em ~${eta} min`;

  return (
    <>
      {cupomAplicado ? (
        <div className="cupom-aplicado">
          <span>
            🏷️ {cupomAplicado.codigo} — {cupomAplicado.label}
          </span>
          <button type="button" aria-label="Remover cupom" onClick={removerCupom}>
            ✕
          </button>
        </div>
      ) : (
        // Campo de cupom recolhido por padrão (menos ruído no rodapé); 1 toque abre.
        <>
          {!cupomAberto && (
            <button type="button" className="cupom-toggle" onClick={() => setCupomAberto(true)}>
              🏷️ Tem um cupom?
            </button>
          )}
          {cupomAberto && (
            <form className="cupom-form" onSubmit={onSubmitCupom}>
              <input
                type="text"
                placeholder="Código do cupom"
                aria-label="Código do cupom"
                autoComplete="off"
                autoFocus
                value={inputCupom}
                onChange={(e) => setInputCupom(e.target.value)}
              />
              <button type="submit">Aplicar</button>
            </form>
          )}
        </>
      )}

      {cashbackDisponivel > 0 && (
        <label className="cashback-toggle">
          <input
            type="checkbox"
            checked={usarCashbackNoCarrinho}
            onChange={(e) => setUsarCashbackNoCarrinho(e.target.checked)}
          />
          Usar meu cashback ({fmt(cashbackDisponivel)} disponível)
        </label>
      )}

      {tipoPedido === "mesa" && (
        <div className="divisao-conta">
          <span>Dividir a conta{temDivisaoInteligente ? "" : " entre"}</span>

          {temDivisaoInteligente && (
            <div className="tipo-pedido-row divisao-modo-row">
              <button
                type="button"
                className={divisaoModo === "porPedido" ? "ativo" : ""}
                onClick={() => setDivisaoModo("porPedido")}
              >
                🧾 Cada um paga o que pediu
              </button>
              <button
                type="button"
                className={divisaoModo === "igual" ? "ativo" : ""}
                onClick={() => setDivisaoModo("igual")}
              >
                ➗ Dividir igual
              </button>
            </div>
          )}

          {!mostrarRateioIgual && (
            <div className="divisao-pessoas">
              {porParticipante.map((d) => (
                <div className="divisao-pessoa-linha" key={d.nome}>
                  <span className="divisao-pessoa-nome">
                    {d.nome} · <b>{fmt(d.valor)}</b>
                  </span>
                  <SeletorFormaPagamento
                    ativo={divisaoPagamentosPorNome[d.nome] || "pix"}
                    onEscolher={(forma) => definirPagamentoDivisaoPorNome(d.nome, forma)}
                  />
                </div>
              ))}
            </div>
          )}

          {mostrarRateioIgual && (
            <>
              <div className="qtd-ctrl">
                <button
                  type="button"
                  aria-label="Diminuir número de pessoas"
                  onClick={() => alterarPessoasDivisao(-1)}
                >
                  –
                </button>
                <span>{pessoasDivisao}</span>
                <button
                  type="button"
                  aria-label="Aumentar número de pessoas"
                  onClick={() => alterarPessoasDivisao(1)}
                >
                  +
                </button>
              </div>
              {pessoasDivisao > 1 && (
                <div className="divisao-pessoas">
                  {valoresDivisaoConta().map((valor, i) => (
                    <div className="divisao-pessoa-linha" key={i}>
                      <span className="divisao-pessoa-nome">
                        Pessoa {i + 1} · <b>{fmt(valor)}</b>
                      </span>
                      <SeletorFormaPagamento
                        ativo={divisaoPagamentos[i] || "pix"}
                        onEscolher={(forma) => definirPagamentoDivisao(i, forma)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="eta-linha">{etaTxt}</div>
    </>
  );
}

// Componente de up-sell / cross-sell exibido no carrinho, antes do checkout.
export function Upsell() {
  const { itensAtivos, adicionarItemAoCarrinho, showToast } = useApp();
  if (!itensAtivos.length) return null;

  const idsNoCarrinho = new Set(itensAtivos.map((c) => c.itemId));
  const sugestoes = UPSELL_IDS.map((id) => MENU.find((m) => m.id === id)).filter(
    (item) => item && !idsNoCarrinho.has(item.id),
  );
  if (!sugestoes.length) return null;

  function adicionar(item) {
    adicionarItemAoCarrinho(item.id, 1, [], [], precoBase(item));
    showToast(`${item.nome} adicionado ao pedido`);
  }

  return (
    <div className="upsell">
      <h3 className="upsell-titulo">🔥 Que tal um acompanhamento?</h3>
      <div className="upsell-track">
        {sugestoes.map((item) => (
          <div className="upsell-card" key={item.id}>
            <div className="upsell-img">
              <FotoItem item={item} />
              <button
                className="upsell-add"
                aria-label={`Adicionar ${item.nome} ao pedido`}
                onClick={() => adicionar(item)}
              >
                +
              </button>
            </div>
            <div className="upsell-info">
              <div className="upsell-nome">{item.nome}</div>
              <div className="upsell-preco">{fmt(precoBase(item))}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pedido em grupo: cria ou entra num carrinho compartilhado por código —
// sincronizado de verdade entre dispositivos diferentes via back-end +
// Socket.IO (ver AppContext.jsx#grupoObj), não só entre abas do mesmo
// navegador como era antes de haver back-end.
export function GrupoPedido() {
  const { grupoAtivo, grupoObj, criarGrupoPedido, entrarGrupoPedido, sairGrupoPedido } =
    useApp();
  const [aberto, setAberto] = useState(false);
  const [codigoDigitado, setCodigoDigitado] = useState("");

  if (grupoAtivo) {
    return (
      <div className="grupo-pedido grupo-ativo">
        <div className="grupo-pedido-cabeca">
          <span>
            🧑‍🤝‍🧑 Grupo <b>{grupoAtivo.codigo}</b>
          </span>
          <button type="button" className="link-voltar" onClick={sairGrupoPedido}>
            Sair do grupo
          </button>
        </div>
        <div className="grupo-participantes">
          Participantes: {(grupoObj?.participantes || []).map((p) => p.nome).join(", ")}
        </div>
        <p className="grupo-pedido-aviso">
          Compartilhe o código com quem está na mesa — cada um entra pelo próprio celular
          pra adicionar itens ao mesmo carrinho.
        </p>
      </div>
    );
  }

  return (
    <div className="grupo-pedido">
      <button
        type="button"
        className="grupo-pedido-toggle"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        🧑‍🤝‍🧑 Pedir em grupo
      </button>
      {aberto && (
        <div className="grupo-pedido-opcoes">
          <button type="button" className="btn-continuar" onClick={criarGrupoPedido}>
            Criar grupo novo
          </button>
          <div className="grupo-entrar-form">
            <input
              type="text"
              placeholder="Código do grupo"
              value={codigoDigitado}
              onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              onClick={() => {
                // entrarGrupoPedido agora fala com o back-end (server/) —
                // vira Promise<boolean>, ver AppContext.jsx.
                entrarGrupoPedido(codigoDigitado).then((ok) => {
                  if (ok) setCodigoDigitado("");
                });
              }}
            >
              Entrar
            </button>
          </div>
          <p className="grupo-pedido-aviso">
            Funciona em celulares diferentes — compartilhe o código com quem está na mesa.
          </p>
        </div>
      )}
    </div>
  );
}
