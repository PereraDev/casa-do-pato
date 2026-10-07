import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  fmt,
  PAGAMENTO_LABEL,
  STATUS_ICONE,
  STATUS_LABEL,
  STATUS_MENSAGEM,
  STATUS_STEPS,
  TIPO_PEDIDO_LABEL,
  statusPedido,
  COORDS_LOJA,
  coordsEntregaPedido,
  interpolarPosicao,
} from "../utils/utils.js";
import { useApp } from "../context/AppContext.jsx";
import { ModalSheet } from "../App.jsx";

// Lista do histórico de pedidos do cliente logado/visitante — cada linha é
// um OrderCard recolhido. Reaproveitado dentro do OrdersSheet (janela
// própria) abaixo.
export function OrdersSection() {
  const { pedidos, irParaInicio, statusTick } = useApp();
  void statusTick; // força este componente a re-renderizar a cada 3s (ver AppContext) pro stepper avançar sozinho

  if (!pedidos.length) {
    return (
      <div className="favoritos-vazio">
        <span aria-hidden="true">🧾</span>
        <p>
          Você ainda não fez nenhum pedido.
          <br />
          Monte seu pedido no cardápio para começar.
        </p>
        <button
          type="button"
          className="btn-visitante estado-vazio-btn"
          onClick={irParaInicio}
        >
          Ver cardápio
        </button>
      </div>
    );
  }

  return (
    <section className="cardapio-secao">
      <div className="secao-titulo">
        <h2>🧾 Meus pedidos</h2>
        <span className="contagem">
          {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
        </span>
      </div>
      <div className="lista-pedidos">
        {pedidos.map((pedido) => (
          <OrderCard key={pedido.id} pedido={pedido} />
        ))}
      </div>
    </section>
  );
}

// Janela própria de Pedidos, aberta a partir do item de menu "Pedidos" em
// "Sua conta" (ver components/account.jsx#AccountSheet) — em vez de mostrar
// a seção embutida no painel de conta.
export function OrdersSheet() {
  const { pedidosOpen, fecharPedidos } = useApp();

  return (
    <ModalSheet
      open={pedidosOpen}
      className="pedidos-sheet"
      overlayClassName="pedidos-overlay"
      ariaLabel="Meus pedidos"
      onOverlayClick={fecharPedidos}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Voltar" onClick={fecharPedidos}>
          ←
        </button>
        <h2>🧾 Meus pedidos</h2>
      </div>
      <div className="product-body">
        <OrdersSection />
      </div>
    </ModalSheet>
  );
}

// Card clicável: a cabeça funciona como botão que expande/recolhe os
// detalhes do pedido (stepper, itens e ações), em vez de mostrar tudo
// sempre aberto.
// Componente-card de um pedido no histórico. Começa recolhido (só número/
// tipo/hora/status/total); a cabeça é um <button> que expande/recolhe os
// detalhes completos (stepper, mapa de entrega, itens, divisão da conta,
// observações e ações "Repetir"/"Avaliar").
export function OrderCard({ pedido }) {
  const { repetirPedido, avaliarPedido, estimarTempoFilaPedido } = useApp();
  const [aberto, setAberto] = useState(false);
  const status = statusPedido(pedido);

  const tipoMeta =
    TIPO_PEDIDO_LABEL[pedido.tipo] +
    (pedido.tipo === "mesa" && pedido.mesa ? ` · Mesa ${pedido.mesa}` : "") +
    (pedido.tipo === "entrega" && pedido.endereco ? ` · ${pedido.endereco}` : "") +
    (pedido.pagamento ? ` · ${PAGAMENTO_LABEL[pedido.pagamento]}` : "") +
    (pedido.cupom ? ` · Cupom ${pedido.cupom}` : "") +
    (pedido.agendamento
      ? ` · Agendado ${pedido.agendamento.data?.slice(8, 10)}/${pedido.agendamento.data?.slice(5, 7)} ${pedido.agendamento.hora}`
      : "");

  const eta = status !== "entregue" ? estimarTempoFilaPedido(pedido) : null;

  const hora = new Date(pedido.criadoEm).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const detalhesId = `pedido-detalhes-${pedido.id}`;

  return (
    <div className="panel-pedido">
      <button
        type="button"
        className="pedido-cabeca pedido-cabeca-clicavel"
        aria-expanded={aberto}
        aria-controls={detalhesId}
        onClick={() => setAberto((v) => !v)}
      >
        <div>
          <div className="pedido-numero">Pedido #{pedido.id}</div>
          <div className="pedido-meta">
            {tipoMeta} · {hora}
          </div>
        </div>
        <div className="pedido-cabeca-direita">
          <span className={"pedido-status-pill status-" + status}>
            {STATUS_ICONE[status]} {STATUS_LABEL[status]}
          </span>
          <span className="pedido-total pedido-total-resumo">
            {fmt(pedido.total)}
          </span>
          <span
            className={"pedido-chevron" + (aberto ? " aberto" : "")}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
      </button>

      {aberto && (
        <div id={detalhesId} className="pedido-detalhes">
          <StatusStepper pedido={pedido} />
          <div className="pedido-status-msg">{STATUS_MENSAGEM[status]}</div>
          {eta && (
            <div className="pedido-eta-fila">
              ⏱ ~{eta.restanteMin} min restantes
              {eta.naFrente > 0 ? ` · ${eta.naFrente} pedido(s) na frente na cozinha` : ""}
            </div>
          )}
          <MapaEntrega pedido={pedido} />
          <div className="pedido-itens">
            {pedido.itens.map((it, i) => (
              <div className="pedido-item-linha" key={i}>
                <span>
                  {it.qtd}x {it.nome}
                  {it.participanteNome && (
                    <span className="pedido-item-participante"> · {it.participanteNome}</span>
                  )}
                </span>
                <span className="pedido-item-preco">{fmt(it.subtotal)}</span>
              </div>
            ))}
          </div>
          {pedido.divisao && (
            <div className="pedido-divisao">
              {pedido.divisao.map((d) => (
                <div className="pedido-item-linha" key={d.pessoa}>
                  <span>
                    {typeof d.pessoa === "number" ? `Pessoa ${d.pessoa}` : d.pessoa} ·{" "}
                    {PAGAMENTO_LABEL[d.pagamento] || d.pagamento}
                  </span>
                  <span className="pedido-item-preco">{fmt(d.valor)}</span>
                </div>
              ))}
            </div>
          )}
          {pedido.observacoes && (
            <div className="pedido-obs">Obs.: {pedido.observacoes}</div>
          )}
          <div className="pedido-rodape">
            <span className="pedido-total">
              Total{" "}
              <span className="pedido-total-valor">{fmt(pedido.total)}</span>
            </span>
            <div className="pedido-acoes">
              <button
                className="btn-avaliar-pedido"
                onClick={() => repetirPedido(pedido.id)}
              >
                Repetir pedido
              </button>
              {status === "entregue" && !pedido.avaliado && (
                <button
                  className="btn-avaliar-pedido"
                  onClick={() => avaliarPedido(pedido.id)}
                >
                  Avaliar pedido
                </button>
              )}
              {status === "entregue" && pedido.avaliado && (
                <span className="pedido-avaliado">Avaliado, obrigado! ★</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusStepper({ pedido }) {
  const status = statusPedido(pedido);
  const idxAtual = STATUS_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="pedido-stepper">
      {STATUS_STEPS.map((s, i) => {
        const cls = i < idxAtual ? "concluido" : i === idxAtual ? "atual" : "";
        return (
          <div key={s.key} className={"pedido-step " + cls}>
            <span className="pedido-dot">{i < idxAtual ? "✓" : i + 1}</span>
            <span className="pedido-lbl">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const ESTAGIOS = ["recebido", "preparo", "pronto"];

// Monta um marcador Leaflet com um emoji como ícone (loja/destino/moto), em
// vez de um pin de imagem — mais leve e sem precisar hospedar ícones.
function pinIcon(emoji, className) {
  return L.divIcon({
    className: `mapa-pin ${className}`,
    html: emoji,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Mapa de entrega — mapa real (Leaflet + tiles do OpenStreetMap, ambos
// gratuitos e sem chave de API) só pra pedidos tipo "entrega" ainda não
// finalizados. A ROTA em si é ilustrativa (loja fixa + um ponto de entrega
// derivado do id do pedido, ver utils/utils.js — o app nunca geocodifica o
// endereço de texto livre de verdade), mas o mapa/ruas ao redor são reais.
// A posição do ícone na rota reflete o progresso: pelo tempo decorrido em
// pedidos automáticos, ou pelo estágio atual quando a equipe já assumiu o
// controle manual pelo KDS (ver statusPedido).
export function MapaEntrega({ pedido }) {
  const status = statusPedido(pedido);
  const visivel = pedido.tipo === "entrega" && status !== "entregue" && !pedido._canceladoAdmin;

  let pct = 0;
  if (visivel) {
    if (pedido.statusManual) {
      const idx = ESTAGIOS.indexOf(status);
      pct = ((idx + 1) / (ESTAGIOS.length + 1)) * 100;
    } else {
      const decorrido = (Date.now() - pedido.criadoEm) / 1000;
      pct = Math.min(92, (decorrido / 50) * 100);
    }
  }

  const destino = coordsEntregaPedido(pedido);
  const containerRef = useRef(null);
  const motoMarkerRef = useRef(null);

  // Cria o mapa 1x por pedido — Leaflet manipula o DOM direto, não dá pra
  // deixar o React re-renderizar o container a cada tick de status.
  useEffect(() => {
    if (!visivel || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.marker([COORDS_LOJA.lat, COORDS_LOJA.lng], { icon: pinIcon("🏪", "mapa-pin-loja") }).addTo(
      map,
    );
    L.marker([destino.lat, destino.lng], { icon: pinIcon("📍", "mapa-pin-destino") }).addTo(map);
    L.polyline(
      [
        [COORDS_LOJA.lat, COORDS_LOJA.lng],
        [destino.lat, destino.lng],
      ],
      { color: "#d73129", weight: 3, dashArray: "6 6" },
    ).addTo(map);

    motoMarkerRef.current = L.marker([COORDS_LOJA.lat, COORDS_LOJA.lng], {
      icon: pinIcon("🛵", "mapa-pin-moto"),
    }).addTo(map);

    map.fitBounds(
      [
        [COORDS_LOJA.lat, COORDS_LOJA.lng],
        [destino.lat, destino.lng],
      ],
      { padding: [28, 28] },
    );

    return () => {
      map.remove();
      motoMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recria o mapa se o pedido ou a visibilidade mudarem, nunca por causa do pct
  }, [pedido.id, visivel]);

  // Move o marcador da moto conforme `pct` avança (recalculado a cada 3s
  // pelo statusTick do AppContext) — não recria o mapa, só reposiciona.
  useEffect(() => {
    if (!motoMarkerRef.current) return;
    const pos = interpolarPosicao(COORDS_LOJA, destino, pct / 100);
    motoMarkerRef.current.setLatLng([pos.lat, pos.lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- destino.lat/lng cobrem o objeto; incluir `destino` (novo por render) rodaria o efeito toda hora
  }, [pct, destino.lat, destino.lng]);

  if (!visivel) return null;

  return (
    <div className="mapa-entrega">
      <div ref={containerRef} className="mapa-entrega-leaflet" aria-hidden="true" />
      <p className="mapa-entrega-legenda">
        Rota ilustrativa num mapa real — sem GPS do entregador neste protótipo.
      </p>
    </div>
  );
}
