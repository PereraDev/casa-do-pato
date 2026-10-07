import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { ModalSheet } from "../App.jsx";
import {
  fmt,
  forcaSenha,
  getContaFidelidade,
  getCartoesSalvos,
  getValesPresenteCriados,
  temPinCarteira,
  getConfigFidelidade,
  getNivel,
  saldoPontos,
  pontosVencendoEm,
  ASSINATURA_PRECO_MES,
  getReservas,
} from "../utils/utils.js";

// Painel de conta (login / cadastro / recuperar senha / visitante / perfil).
// A entrada padrão (tipo QR Code) nunca fica bloqueada por isso: sem sessão
// salva, o app já cai como visitante (ver AppContext) — a conta é sempre
// uma ação opcional, aberta por este sheet.
export function AccountSheet() {
  const {
    contaOpen,
    fecharConta,
    sessao,
    sair,
    favoritos,
    favoritosPersonalizados,
    pedidos,
    abrirFavoritos,
    abrirPedidos,
    abrirExtrato,
    abrirCarteira,
    abrirReservas,
  } = useApp();
  const [aba, setAba] = useState("entrar"); // "entrar" | "cadastro" | "recuperar"
  const [etapaRecuperar, setEtapaRecuperar] = useState("email"); // "email" | "novaSenha"
  const [emailRecuperar, setEmailRecuperar] = useState("");

  // Reseta o sub-fluxo sempre que o painel é reaberto, pra nunca cair no
  // meio de uma recuperação de senha de uma visita anterior.
  useEffect(() => {
    if (contaOpen) {
      setAba("entrar");
      setEtapaRecuperar("email");
    }
  }, [contaOpen]);

  let conteudo;
  if (sessao && sessao.tipo === "usuario") {
    conteudo = <PerfilLogado sessao={sessao} sair={sair} />;
  } else if (aba === "recuperar") {
    conteudo = (
      <RecuperarSenha
        etapa={etapaRecuperar}
        setEtapa={setEtapaRecuperar}
        email={emailRecuperar}
        setEmail={setEmailRecuperar}
        setAba={setAba}
        voltar={() => {
          setAba("entrar");
          setEtapaRecuperar("email");
        }}
      />
    );
  } else {
    conteudo = (
      <LoginCadastro
        aba={aba}
        setAba={setAba}
        irParaRecuperar={() => {
          setAba("recuperar");
          setEtapaRecuperar("email");
        }}
      />
    );
  }

  return (
    <ModalSheet
      open={contaOpen}
      className="conta-sheet"
      overlayClassName="conta-overlay"
      ariaLabel="Sua conta"
      onOverlayClick={fecharConta}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Fechar" onClick={fecharConta}>
          ←
        </button>
        <h2>Sua conta</h2>
      </div>
      <div className="conta-body">
        {conteudo}
        <div className="conta-divisor">seus itens</div>
        <div className="conta-menu">
          <button type="button" className="conta-menu-item" onClick={abrirFavoritos}>
            <span className="conta-menu-icon" aria-hidden="true">
              ♥
            </span>
            <span className="conta-menu-label">Favoritos</span>
            {favoritos.length + favoritosPersonalizados.length > 0 && (
              <span className="conta-menu-contagem">
                {favoritos.length + favoritosPersonalizados.length}
              </span>
            )}
            <span className="conta-menu-seta" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" className="conta-menu-item" onClick={abrirPedidos}>
            <span className="conta-menu-icon" aria-hidden="true">
              🧾
            </span>
            <span className="conta-menu-label">Pedidos</span>
            {pedidos.length > 0 && (
              <span className="conta-menu-contagem">{pedidos.length}</span>
            )}
            <span className="conta-menu-seta" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" className="conta-menu-item" onClick={abrirExtrato}>
            <span className="conta-menu-icon" aria-hidden="true">
              🏅
            </span>
            <span className="conta-menu-label">Extrato</span>
            <span className="conta-menu-seta" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" className="conta-menu-item" onClick={abrirCarteira}>
            <span className="conta-menu-icon" aria-hidden="true">
              👛
            </span>
            <span className="conta-menu-label">Carteira</span>
            <span className="conta-menu-seta" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" className="conta-menu-item" onClick={abrirReservas}>
            <span className="conta-menu-icon" aria-hidden="true">
              📅
            </span>
            <span className="conta-menu-label">Reservar mesa</span>
            <span className="conta-menu-seta" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}

// Conteúdo de "Sua conta" pra quem já está logado: dados básicos, botão de
// sair e o bloco "Indique um amigo" (código próprio pra copiar/compartilhar
// + campo pra usar o código de outra pessoa).
function PerfilLogado({ sessao, sair }) {
  const { codigoIndicacaoAtual, totalAmigosIndicados, usarCodigoIndicacao, showToast } =
    useApp();
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const meuCodigo = codigoIndicacaoAtual();

  function copiarCodigo() {
    navigator.clipboard?.writeText(meuCodigo);
    showToast("Código copiado!");
  }

  return (
    <>
      <div className="conta-perfil">
        <div className="conta-avatar" aria-hidden="true">
          🙂
        </div>
        <div className="conta-nome">{sessao.nome}</div>
        <div className="conta-email">{sessao.email}</div>
      </div>
      <button className="btn-sair" onClick={sair}>
        Sair da conta
      </button>

      <div className="indique-amigo">
        <h3>Indique um amigo</h3>
        <p>
          Compartilhe seu código — você ganha 100 pontos e quem usar ganha 50 de boas-vindas.
        </p>
        <div className="indique-amigo-codigo">
          <span>{meuCodigo}</span>
          <button type="button" onClick={copiarCodigo}>
            Copiar
          </button>
        </div>
        <p className="conta-hint">{totalAmigosIndicados()} amigo(s) indicado(s) até agora.</p>
        <div className="indique-amigo-usar">
          <input
            type="text"
            placeholder="Tem um código de indicação?"
            value={codigoDigitado}
            onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            onClick={() => {
              usarCodigoIndicacao(codigoDigitado);
              setCodigoDigitado("");
            }}
          >
            Usar
          </button>
        </div>
      </div>
    </>
  );
}

// Abas "Entrar"/"Cadastrar" (mais o atalho "Continuar como visitante") —
// ver o comentário longo abaixo sobre por que os campos de e-mail/senha são
// inputs não-controlados.
function LoginCadastro({ aba, setAba, irParaRecuperar }) {
  const { login, cadastro, continuarComoVisitante, fecharConta, sessao } = useApp();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [cadNome, setCadNome] = useState("");
  const [cadEmail, setCadEmail] = useState("");
  const [cadSenha, setCadSenha] = useState("");

  // login/cadastro agora falam com o back-end (server/) — viram assíncronos,
  // ver AppContext.jsx.
  //
  // `valorReal` existe porque autofill/gerenciador de senha do navegador
  // (o "autosave" que preenche e-mail/senha sozinho) às vezes escreve
  // direto no input sem disparar o onChange do React — o campo aparece
  // preenchido na tela, mas o estado (cadSenha etc.) fica vazio. No submit,
  // lê o valor real do DOM (pelo id do input) como fonte da verdade, com o
  // estado como fallback.
  //
  // Isso sozinho não bastava: `value={cadSenha}` (input controlado) fazia o
  // AppContext, que recria o objeto do Provider a cada render (inclusive o
  // `statusTick` de 3 em 3s que atualiza o status do pedido — roda sempre,
  // sheet de conta aberto ou não), forçar o DOM de volta pro estado vazio
  // pouco depois do autofill preencher o campo — então nem o DOM nem o
  // estado tinham o valor digitado na hora do submit, e o cadastro voltava
  // "senha inválida" mesmo com a senha visivelmente preenchida na tela. Por
  // isso os inputs abaixo usam `defaultValue` (não-controlado) em vez de
  // `value`: o React só escreve no DOM na 1ª montagem, então re-renders
  // depois disso (por qualquer motivo, incluindo o statusTick) não tocam
  // mais no valor que o autofill escreveu — `onChange` continua atualizando
  // o estado só pra alimentar o medidor de força de senha.
  function valorReal(form, id, estado) {
    return form.elements.namedItem(id)?.value ?? estado;
  }
  async function onSubmitEntrar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = valorReal(form, "loginEmail", loginEmail).trim();
    const senha = valorReal(form, "loginSenha", loginSenha);
    if (await login(email, senha)) fecharConta();
  }
  async function onSubmitCadastro(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const nome = valorReal(form, "cadNome", cadNome).trim();
    const email = valorReal(form, "cadEmail", cadEmail).trim();
    const senha = valorReal(form, "cadSenha", cadSenha);
    if (!nome || !email || !senha) return;
    if (await cadastro(nome, email, senha)) fecharConta();
    else setAba("entrar");
  }

  return (
    <>
      <div className="conta-abas">
        <button
          className={"conta-aba-btn" + (aba === "entrar" ? " ativa" : "")}
          onClick={() => setAba("entrar")}
        >
          Entrar
        </button>
        <button
          className={"conta-aba-btn" + (aba === "cadastro" ? " ativa" : "")}
          onClick={() => setAba("cadastro")}
        >
          Cadastrar
        </button>
      </div>

      {aba === "entrar" ? (
        <form className="conta-form" onSubmit={onSubmitEntrar}>
          <div>
            <label htmlFor="loginEmail">E-mail ou telefone</label>
            <input
              id="loginEmail"
              type="text"
              placeholder="voce@email.com"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              required
              defaultValue={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="loginSenha">Senha</label>
            <input
              id="loginSenha"
              type="password"
              placeholder="Sua senha"
              autoComplete="current-password"
              required
              defaultValue={loginSenha}
              onChange={(e) => setLoginSenha(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-entrar">
            Entrar
          </button>
          <button
            type="button"
            className="link-esqueci-senha"
            onClick={irParaRecuperar}
          >
            Esqueci minha senha
          </button>
        </form>
      ) : (
        <form className="conta-form" onSubmit={onSubmitCadastro}>
          <div>
            <label htmlFor="cadNome">Seu nome</label>
            <input
              id="cadNome"
              type="text"
              placeholder="Como podemos te chamar?"
              autoComplete="name"
              required
              defaultValue={cadNome}
              onChange={(e) => setCadNome(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cadEmail">E-mail ou telefone</label>
            <input
              id="cadEmail"
              type="text"
              placeholder="voce@email.com"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              required
              defaultValue={cadEmail}
              onChange={(e) => setCadEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cadSenha">Senha</label>
            <input
              id="cadSenha"
              type="password"
              placeholder="Mín. 8 caracteres, com letra e número"
              autoComplete="new-password"
              minLength={8}
              required
              defaultValue={cadSenha}
              onChange={(e) => setCadSenha(e.target.value)}
            />
            <MedidorForcaSenha senha={cadSenha} />
          </div>
          <button type="submit" className="btn-entrar">
            Criar conta
          </button>
        </form>
      )}

      <div className="conta-divisor">ou</div>
      <button
        className="btn-visitante"
        onClick={() => {
          continuarComoVisitante();
          fecharConta();
        }}
      >
        Continuar como visitante
      </button>
      {sessao && sessao.tipo === "visitante" && (
        <div className="conta-hint">
          Você já está navegando como visitante — o cardápio está liberado normalmente.
        </div>
      )}
    </>
  );
}

// Recuperação de senha: fluxo simulado em 2 etapas (protótipo local, sem
// envio real de e-mail).
function RecuperarSenha({ etapa, setEtapa, email, setEmail, setAba, voltar }) {
  const { verificarEmailCadastrado, redefinirSenha, showToast } = useApp();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");

  // Mesmo problema de autofill dos formulários de login/cadastro (ver
  // `valorReal`/comentário em LoginCadastro acima) — inputs não-controlados
  // (defaultValue) + leitura do DOM no submit como fonte da verdade.
  function valorReal(form, id, estado) {
    return form.elements.namedItem(id)?.value ?? estado;
  }
  async function onSubmitEmail(e) {
    e.preventDefault();
    const emailDigitado = valorReal(e.currentTarget, "recEmail", email).trim();
    if (await verificarEmailCadastrado(emailDigitado)) {
      setEmail(emailDigitado);
      setEtapa("novaSenha");
    }
  }
  async function onSubmitNovaSenha(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const senha = valorReal(form, "novaSenha", novaSenha);
    const confirma = valorReal(form, "novaSenhaConfirma", confirmaSenha);
    if (senha !== confirma) {
      showToast("As senhas não coincidem");
      return;
    }
    if (await redefinirSenha(email, valorReal(form, "recCodigo", "").trim(), senha)) {
      setEtapa("email");
      setAba("entrar");
    }
  }

  return (
    <div className="conta-recuperar">
      <button type="button" className="link-voltar" onClick={voltar}>
        ← Voltar para login
      </button>
      {etapa === "novaSenha" ? (
        <>
          <h3>Nova senha</h3>
          <p className="conta-hint">
            Código de 6 dígitos "enviado" para {email} (protótipo: aparece no console do
            servidor, válido por 15 min) — digite-o e defina sua nova senha.
          </p>
          <form className="conta-form" onSubmit={onSubmitNovaSenha}>
            <div>
              <label htmlFor="recCodigo">Código de recuperação</label>
              <input
                id="recCodigo"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                required
              />
            </div>
            <div>
              <label htmlFor="novaSenha">Nova senha</label>
              <input
                id="novaSenha"
                type="password"
                placeholder="Mín. 8 caracteres, com letra e número"
                autoComplete="new-password"
                minLength={8}
                required
                defaultValue={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
              <MedidorForcaSenha senha={novaSenha} />
            </div>
            <div>
              <label htmlFor="novaSenhaConfirma">Confirmar nova senha</label>
              <input
                id="novaSenhaConfirma"
                type="password"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                minLength={8}
                required
                defaultValue={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-entrar">
              Redefinir senha
            </button>
          </form>
        </>
      ) : (
        <>
          <h3>Recuperar senha</h3>
          <p className="conta-hint">
            Informe o e-mail cadastrado. Vamos simular o envio de um código de redefinição
            (protótipo local, sem envio real de e-mail).
          </p>
          <form className="conta-form" onSubmit={onSubmitEmail}>
            <div>
              <label htmlFor="recEmail">E-mail cadastrado</label>
              <input
                id="recEmail"
                type="text"
                placeholder="voce@email.com"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                required
                defaultValue={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-entrar">
              Enviar link de recuperação
            </button>
          </form>
        </>
      )}
    </div>
  );
}

// Feedback visual de força de senha — a regra de verdade é sempre a do
// back-end (server/src/lib/senha.js, hash bcrypt cost 12); isso aqui só
// evita a pessoa descobrir que a senha é fraca só depois de enviar (ver
// utils/utils.js#forcaSenha).
function MedidorForcaSenha({ senha }) {
  const { nivel, label } = forcaSenha(senha);
  if (nivel === "vazia") return null;
  return (
    <div className={"medidor-forca-senha nivel-" + nivel}>
      <div className="medidor-forca-senha-barra">
        <span />
        <span />
        <span />
      </div>
      <span className="medidor-forca-senha-label">{label}</span>
    </div>
  );
}

// Janela própria da Carteira, aberta pelo item "Carteira" em "Sua conta"
// (mesmo molde de Favoritos/Pedidos/Extrato — sem ícone próprio no TopBar).
// Protegida por PIN (hash forte, ver utils/utils.js#hashForte): abre travada
// toda vez, mesmo se já foi destravada antes na mesma sessão (ver
// AppContext#abrirCarteira). Reúne saldo/recarga (que antes vivia dentro do
// Clube de Fidelidade), cartões salvos (simulados) e vale-presente.
export function CarteiraSheet() {
  const { carteiraOpen, fecharCarteira, carteiraDesbloqueada, bloquearCarteira, sessao, abrirExtrato } =
    useApp();
  const logado = sessao?.tipo === "usuario";
  const temPin = logado && temPinCarteira(sessao.email);

  let conteudo;
  if (!logado) {
    conteudo = (
      <div className="fidelidade-convite">
        <p>Entre na sua conta pra usar a carteira, guardar cartões e comprar vale-presente.</p>
      </div>
    );
  } else if (!temPin) {
    conteudo = <CriarPin />;
  } else if (!carteiraDesbloqueada) {
    conteudo = <DesbloquearPin />;
  } else {
    conteudo = <CarteiraConteudo email={sessao.email} abrirExtrato={abrirExtrato} fecharCarteira={fecharCarteira} />;
  }

  return (
    <ModalSheet
      open={carteiraOpen}
      className="carteira-sheet"
      overlayClassName="carteira-overlay"
      ariaLabel="Carteira"
      onOverlayClick={fecharCarteira}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Voltar" onClick={fecharCarteira}>
          ←
        </button>
        <h2>👛 Carteira</h2>
        {logado && temPin && carteiraDesbloqueada && (
          <button
            type="button"
            className="icon-btn carteira-bloquear-btn"
            aria-label="Bloquear carteira"
            onClick={bloquearCarteira}
          >
            🔒
          </button>
        )}
      </div>
      <div className="product-body fidelidade-body">{conteudo}</div>
    </ModalSheet>
  );
}

// Primeira vez na carteira: formulário de criação do PIN (obrigatório antes
// de ver qualquer conteúdo dela, ver CarteiraSheet acima).
function CriarPin() {
  const { criarPinCarteira } = useApp();
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (await criarPinCarteira(pin, confirmar)) {
      setPin("");
      setConfirmar("");
    }
  }

  return (
    <div className="carteira-pin-gate">
      <p className="carteira-pin-intro">
        🔒 Crie um PIN de 4 a 6 números pra proteger sua carteira. Ele fica guardado com
        criptografia forte (PBKDF2 com salt, o mesmo tipo de proteção usado em senhas de verdade),
        nunca em texto puro.
      </p>
      <form className="conta-form" onSubmit={onSubmit}>
        <div>
          <label htmlFor="pinNovo">Criar PIN</label>
          <input
            id="pinNovo"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••"
            autoComplete="off"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div>
          <label htmlFor="pinConfirma">Confirmar PIN</label>
          <input
            id="pinConfirma"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••"
            autoComplete="off"
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <button type="submit" className="btn-entrar">
          Criar PIN e abrir carteira
        </button>
      </form>
    </div>
  );
}

// Já tem PIN, mas a carteira está travada nesta sessão de tela — pede o PIN
// de novo (carteiraDesbloqueada nunca persiste, ver AppContext).
function DesbloquearPin() {
  const { desbloquearCarteira } = useApp();
  const [pin, setPin] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!(await desbloquearCarteira(pin))) setPin("");
  }

  return (
    <div className="carteira-pin-gate">
      <p className="carteira-pin-intro">🔒 Digite seu PIN pra abrir a carteira.</p>
      <form className="conta-form" onSubmit={onSubmit}>
        <div>
          <label htmlFor="pinDigitado">PIN</label>
          <input
            id="pinDigitado"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••"
            autoComplete="off"
            autoFocus
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <button type="submit" className="btn-entrar">
          Desbloquear
        </button>
      </form>
    </div>
  );
}

// Carteira já destravada: saldo + recarga manual, cartões salvos
// (SecaoCartoes) e vale-presente (SecaoValePresente).
function CarteiraConteudo({ email, abrirExtrato, fecharCarteira }) {
  const { recarregarSaldoCarteira } = useApp();
  const conta = getContaFidelidade(email);
  const [valorRecarga, setValorRecarga] = useState("");

  return (
    <>
      <div className="carteira-saldo">
        <span className="carteira-saldo-label">Saldo disponível</span>
        <span className="carteira-saldo-valor">{fmt(conta.cashback)}</span>
        <button
          type="button"
          className="link-voltar"
          onClick={() => {
            fecharCarteira();
            abrirExtrato();
          }}
        >
          Ver extrato completo →
        </button>
      </div>

      <div className="carteira-recarga">
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Valor (R$)"
          value={valorRecarga}
          onChange={(e) => setValorRecarga(e.target.value)}
        />
        <button
          type="button"
          className="btn-resgatar"
          onClick={() => {
            recarregarSaldoCarteira(parseFloat(valorRecarga) || 0);
            setValorRecarga("");
          }}
        >
          💰 Adicionar saldo
        </button>
      </div>

      <h3 className="fidelidade-subtitulo">Meus cartões</h3>
      <SecaoCartoes email={email} />

      <h3 className="fidelidade-subtitulo">Vale-presente</h3>
      <SecaoValePresente email={email} />
    </>
  );
}

// Cartões salvos são só simulação/exibição (mesma limitação do resto do
// checkout, sem gateway de pagamento real) — guarda só os 4 últimos
// dígitos, nunca o número completo (ver utils/utils.js).
function SecaoCartoes({ email }) {
  const { adicionarCartaoCarteira, removerCartaoCarteira } = useApp();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [numero, setNumero] = useState("");
  const [nomeTitular, setNomeTitular] = useState("");
  const [validade, setValidade] = useState("");
  const [apelido, setApelido] = useState("");
  const cartoes = getCartoesSalvos(email);

  function onSubmit(e) {
    e.preventDefault();
    const ok = adicionarCartaoCarteira({ numero, nomeTitular, validade, apelido });
    if (ok) {
      setNumero("");
      setNomeTitular("");
      setValidade("");
      setApelido("");
      setMostrarForm(false);
    }
  }

  return (
    <div className="carteira-cartoes">
      {cartoes.length === 0 && !mostrarForm && (
        <p className="fidelidade-sem-recompensa">Nenhum cartão salvo ainda.</p>
      )}
      {cartoes.map((c) => (
        <div className="carteira-cartao" key={c.id}>
          <span className="carteira-cartao-bandeira">{c.bandeira}</span>
          <span className="carteira-cartao-numero">•••• {c.final4}</span>
          <span className="carteira-cartao-validade">{c.validade}</span>
          {c.apelido && <span className="carteira-cartao-apelido">{c.apelido}</span>}
          <button type="button" className="link-voltar" onClick={() => removerCartaoCarteira(c.id)}>
            Remover
          </button>
        </div>
      ))}
      {mostrarForm ? (
        <form className="conta-form carteira-cartao-form" onSubmit={onSubmit}>
          <div>
            <label htmlFor="cartaoNumero">Número do cartão</label>
            <input
              id="cartaoNumero"
              type="text"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              autoComplete="cc-number"
              required
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cartaoNome">Nome no cartão</label>
            <input
              id="cartaoNome"
              type="text"
              placeholder="Como está impresso"
              autoComplete="cc-name"
              required
              value={nomeTitular}
              onChange={(e) => setNomeTitular(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cartaoValidade">Validade (MM/AA)</label>
            <input
              id="cartaoValidade"
              type="text"
              placeholder="MM/AA"
              autoComplete="cc-exp"
              maxLength={5}
              required
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cartaoApelido">Apelido (opcional)</label>
            <input
              id="cartaoApelido"
              type="text"
              placeholder="Ex.: Cartão do trabalho"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-entrar">
            Salvar cartão
          </button>
          <button type="button" className="link-voltar" onClick={() => setMostrarForm(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" className="btn-resgatar" onClick={() => setMostrarForm(true)}>
          + Adicionar cartão
        </button>
      )}
      <p className="conta-hint">
        Cartão simulado — não processa pagamento de verdade, guardamos só os últimos 4 dígitos.
      </p>
    </div>
  );
}

// Comprar um vale-presente gera um código único (ver
// utils/utils.js#gerarCodigoValePresente) pra compartilhar manualmente —
// sem e-mail/SMS real, quem recebe digita o código na própria carteira pra
// resgatar. O valor não sai do saldo de quem presenteia (mesmo espírito
// sem gateway real de "Adicionar saldo" acima).
function SecaoValePresente({ email }) {
  const { comprarValePresenteCarteira, resgatarValePresenteCarteira, showToast } = useApp();
  const [valor, setValor] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [codigoResgate, setCodigoResgate] = useState("");
  const [ultimoCodigo, setUltimoCodigo] = useState(null);
  const criados = getValesPresenteCriados(email);

  function onComprar(e) {
    e.preventDefault();
    const codigo = comprarValePresenteCarteira(parseFloat(valor) || 0, destinatario);
    if (codigo) {
      setUltimoCodigo(codigo);
      setValor("");
      setDestinatario("");
    }
  }
  function onResgatar(e) {
    e.preventDefault();
    if (resgatarValePresenteCarteira(codigoResgate)) setCodigoResgate("");
  }
  function copiarCodigo(codigo) {
    navigator.clipboard?.writeText(codigo);
    showToast("Código copiado!");
  }

  return (
    <div className="carteira-vale-presente">
      <p className="conta-hint">
        Compre um vale-presente e mande o código pra alguém — quem resgatar recebe o valor direto
        na própria carteira.
      </p>
      <form className="conta-form carteira-vale-form" onSubmit={onComprar}>
        <div>
          <label htmlFor="valeValor">Valor do vale-presente</label>
          <input
            id="valeValor"
            type="number"
            min="1"
            step="1"
            placeholder="R$"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="valeDestinatario">Pra quem é (opcional)</label>
          <input
            id="valeDestinatario"
            type="text"
            placeholder="Nome de quem vai receber"
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-resgatar">
          Gerar vale-presente 🎁
        </button>
      </form>

      {ultimoCodigo && (
        <div className="carteira-vale-codigo">
          <span>{ultimoCodigo}</span>
          <button type="button" onClick={() => copiarCodigo(ultimoCodigo)}>
            Copiar
          </button>
        </div>
      )}

      <form className="conta-form carteira-vale-form" onSubmit={onResgatar}>
        <div>
          <label htmlFor="valeCodigoResgate">Recebeu um vale-presente? Resgate aqui</label>
          <input
            id="valeCodigoResgate"
            type="text"
            placeholder="GFT-XXXXXX"
            value={codigoResgate}
            onChange={(e) => setCodigoResgate(e.target.value.toUpperCase())}
          />
        </div>
        <button type="submit" className="btn-resgatar">
          Resgatar
        </button>
      </form>

      {criados.length > 0 && (
        <div className="carteira-vale-lista">
          <h4>Vale-presentes que você criou</h4>
          {criados.map((v) => (
            <div className="carteira-vale-linha" key={v.codigo}>
              <span>
                {v.codigo}
                {v.destinatario ? ` — ${v.destinatario}` : ""}
              </span>
              <span>{fmt(v.valor)}</span>
              <span className={"vale-status " + (v.resgatadoPor ? "resgatado" : "pendente")}>
                {v.resgatadoPor ? "Resgatado" : "Aguardando"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Janela própria de Extrato (pontos + cashback), aberta a partir do item de
// menu "Extrato" em "Sua conta" — antes era a parte de baixo do Clube de
// Fidelidade; virou uma tela separada porque é histórico da conta, não faz
// parte do fluxo de resgatar pontos (esse continua só no Clube de Fidelidade,
// aberto pelo botão "Usar meus pontos").
export function ExtratoSheet() {
  const { extratoOpen, fecharExtrato, sessao } = useApp();
  const logado = sessao?.tipo === "usuario";
  const conta = logado ? getContaFidelidade(sessao.email) : null;
  const historico = conta ? [...conta.historico].reverse() : [];

  return (
    <ModalSheet
      open={extratoOpen}
      className="extrato-sheet"
      overlayClassName="extrato-overlay"
      ariaLabel="Extrato"
      onOverlayClick={fecharExtrato}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Voltar" onClick={fecharExtrato}>
          ←
        </button>
        <h2>🏅 Extrato</h2>
      </div>
      <div className="product-body fidelidade-body">
        {!logado ? (
          <div className="fidelidade-convite">
            <p>Entre na sua conta pra ver seu extrato de pontos e cashback.</p>
          </div>
        ) : historico.length === 0 ? (
          <div className="fidelidade-convite">
            <p>Nenhuma movimentação ainda. Faça um pedido pra começar a acumular pontos.</p>
          </div>
        ) : (
          <div className="fidelidade-extrato">
            {historico.map((h, i) => (
              <ExtratoLinha key={i} item={h} />
            ))}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}

// Uma linha do extrato — traduz o `tipo` do lançamento (ver
// utils/utils.js#creditarCompra e afins) num texto legível.
function ExtratoLinha({ item }) {
  const data = new Date(item.em).toLocaleDateString("pt-BR");
  const textos = {
    compra: `Compra${item.pedidoId ? " #" + item.pedidoId : ""}: +${item.pontos} pts${item.cashback ? ` · +${fmt(item.cashback)} cashback` : ""}`,
    resgate: `Resgate: ${item.recompensa} (${item.pontos} pts)`,
    "uso-cashback": `Cashback usado no pedido: ${fmt(item.cashback || 0)}`,
    "ajuste-admin": `Ajuste da equipe: ${item.pontos ? item.pontos + " pts " : ""}${item.cashback ? fmt(item.cashback) : ""}${item.motivo ? " — " + item.motivo : ""}`,
    recarga: `Recarga de carteira: +${fmt(item.cashback || 0)}`,
    bonus: `Bônus: +${item.pontos} pts — ${item.motivo}`,
    "vale-presente-comprado": `Vale-presente comprado: ${fmt(item.valor || 0)} (código ${item.codigo})`,
    "vale-presente-resgatado": `Vale-presente resgatado: +${fmt(item.cashback || 0)}`,
  };
  return (
    <div className="fidelidade-extrato-linha">
      <span>{textos[item.tipo] || item.tipo}</span>
      <span className="fidelidade-extrato-data">{data}</span>
    </div>
  );
}

// Janela própria do Clube de Fidelidade + Cashback, aberta a partir do item
// de menu em "Sua conta" (mesmo molde de FavoritesSheet/OrdersSheet). Só faz
// sentido pra quem está logado — visitante não tem e-mail pra acumular nada
// (ver utils/utils.js).
export function FidelidadeSheet() {
  const {
    fidelidadeOpen,
    fecharFidelidade,
    sessao,
    resgatarPontos,
    missaoSemanalAtual,
    resgatarMissao,
    assinaturaAtiva,
    assinarClube,
    cancelarAssinaturaClube,
    abrirCarteira,
  } = useApp();
  const [filtroPontos, setFiltroPontos] = useState("todos");

  const logado = sessao?.tipo === "usuario";
  const config = getConfigFidelidade();
  const conta = logado ? getContaFidelidade(sessao.email) : null;
  const nivel = conta ? getNivel(conta.pontosVitalicios, config.niveis) : null;
  const saldo = conta ? saldoPontos(conta) : 0;
  const vencendo30d = conta ? pontosVencendoEm(conta, 30) : 0;

  return (
    <ModalSheet
      open={fidelidadeOpen}
      className="fidelidade-sheet"
      overlayClassName="fidelidade-overlay"
      ariaLabel="Clube de fidelidade"
      onOverlayClick={fecharFidelidade}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Voltar" onClick={fecharFidelidade}>
          ←
        </button>
        <h2>🏅 Clube de fidelidade</h2>
      </div>
      <div className="product-body fidelidade-body">
        {!logado ? (
          <div className="fidelidade-convite">
            <p>Entre na sua conta pra começar a acumular pontos e cashback a cada pedido.</p>
          </div>
        ) : (
          <>
            <div className="fidelidade-resumo">
              <div className="fidelidade-nivel">
                <span className="fidelidade-nivel-selo">{nivel.nome}</span>
                <span className="fidelidade-nivel-mult">
                  {nivel.multiplicador}x pontos por compra
                </span>
              </div>
              <div className="fidelidade-saldos">
                <div>
                  <span className="fidelidade-saldo-valor">{saldo}</span>
                  <span className="fidelidade-saldo-label">pontos</span>
                </div>
                <div>
                  <span className="fidelidade-saldo-valor">{fmt(conta.cashback)}</span>
                  <span className="fidelidade-saldo-label">cashback</span>
                </div>
              </div>
              {vencendo30d > 0 && (
                <div className="fidelidade-aviso">
                  ⏳ {vencendo30d} ponto(s) vencem nos próximos 30 dias
                </div>
              )}
              <ProximoNivel pontosVitalicios={conta.pontosVitalicios} niveis={config.niveis} />
            </div>

            <MissaoSemanal missao={missaoSemanalAtual()} resgatarMissao={resgatarMissao} />

            <h3 className="fidelidade-subtitulo">Trocar pontos</h3>
            <FiltroPontos
              recompensas={config.recompensas}
              filtro={filtroPontos}
              setFiltro={setFiltroPontos}
            />
            <RecompensasFiltradas
              recompensas={config.recompensas}
              filtro={filtroPontos}
              saldo={saldo}
              resgatarPontos={resgatarPontos}
            />

            <div className="fidelidade-carteira-link">
              <span>👛 Cartões salvos, recarga e vale-presente agora ficam na Carteira.</span>
              <button
                type="button"
                className="link-voltar"
                onClick={() => {
                  fecharFidelidade();
                  abrirCarteira();
                }}
              >
                Abrir carteira →
              </button>
            </div>

            <h3 className="fidelidade-subtitulo">Casa do Pato+</h3>
            <ClubeAssinatura
              ativo={assinaturaAtiva()}
              assinar={assinarClube}
              cancelar={cancelarAssinaturaClube}
            />
          </>
        )}
      </div>
    </ModalSheet>
  );
}

// Missão semanal fixa — progresso calculado a partir dos próprios pedidos
// (sem estado próprio, ver utils/utils.js#progressoMissaoSemanal).
function MissaoSemanal({ missao, resgatarMissao }) {
  if (!missao) return null;
  const pct = Math.round((missao.progresso / missao.meta) * 100);
  return (
    <div className="missao-semanal">
      <div className="missao-semanal-cabeca">
        <span>🏆 Cliente fiel da semana</span>
        <span className="missao-semanal-progresso">
          {missao.progresso}/{missao.meta}
        </span>
      </div>
      <p className="missao-semanal-desc">
        Peça {missao.meta} vezes essa semana e ganhe 30 pontos bônus.
      </p>
      <div className="missao-semanal-barra">
        <div className="missao-semanal-barra-fill" style={{ width: pct + "%" }} />
      </div>
      {missao.completa && !missao.jaResgatou && (
        <button type="button" className="btn-resgatar" onClick={resgatarMissao}>
          Resgatar recompensa 🎁
        </button>
      )}
      {missao.jaResgatou && (
        <span className="missao-semanal-resgatada">Recompensa já resgatada essa semana ✓</span>
      )}
    </div>
  );
}

// Clube de assinatura (Casa do Pato+) — mensalidade simulada, aplica 10% de
// desconto automático em todo pedido sem cupom digitado (ver
// AppContext#calcularDesconto).
function ClubeAssinatura({ ativo, assinar, cancelar }) {
  if (ativo) {
    return (
      <div className="clube-assinatura ativo">
        <p>
          ✓ Assinatura ativa — <b>10% de desconto</b> em todo pedido, aplicado
          automaticamente quando não há outro cupom.
        </p>
        <button type="button" className="link-voltar" onClick={cancelar}>
          Cancelar assinatura
        </button>
      </div>
    );
  }
  return (
    <div className="clube-assinatura">
      <p>Assine por {fmt(ASSINATURA_PRECO_MES)}/mês e ganhe 10% de desconto automático em todo pedido.</p>
      <button type="button" className="btn-resgatar" onClick={assinar}>
        Assinar Casa do Pato+
      </button>
    </div>
  );
}

// Chips pra filtrar o catálogo de recompensas pelo custo em pontos (ex.:
// "100 pontos", "150 pontos"), pra facilitar achar algo que dá pra resgatar
// com o saldo atual sem rolar a lista inteira.
function FiltroPontos({ recompensas, filtro, setFiltro }) {
  const valores = [...new Set(recompensas.map((r) => r.custoPontos))].sort(
    (a, b) => a - b,
  );
  if (valores.length < 2) return null;
  return (
    <div className="fidelidade-filtro-pontos">
      <button
        type="button"
        className={"fidelidade-filtro-chip" + (filtro === "todos" ? " ativo" : "")}
        onClick={() => setFiltro("todos")}
      >
        Todos
      </button>
      {valores.map((v) => (
        <button
          type="button"
          key={v}
          className={"fidelidade-filtro-chip" + (filtro === v ? " ativo" : "")}
          onClick={() => setFiltro(v)}
        >
          {v} pontos
        </button>
      ))}
    </div>
  );
}

// Catálogo em cards horizontais roláveis (imagem + nome + custo em pontos),
// no molde do "Clube BK" — cadeado nos que o saldo atual não alcança ainda,
// pra reforçar a ideia de meta a bater (não é só uma lista de preços).
function RecompensasFiltradas({ recompensas, filtro, saldo, resgatarPontos }) {
  const filtradas = recompensas.filter(
    (r) => filtro === "todos" || r.custoPontos === filtro,
  );
  return (
    <div className="fidelidade-recompensas">
      {filtradas.length === 0 && (
        <p className="fidelidade-sem-recompensa">Nenhuma recompensa com esse valor de pontos.</p>
      )}
      {filtradas.map((r) => {
        const alcancavel = saldo >= r.custoPontos;
        return (
          <div
            key={r.id}
            className={"fidelidade-recompensa" + (alcancavel ? "" : " bloqueada")}
          >
            <div className="fidelidade-recompensa-img">
              {r.foto ? (
                <img src={r.foto} alt={r.nome} loading="lazy" />
              ) : (
                <span aria-hidden="true">🎁</span>
              )}
              {!alcancavel && (
                <span className="fidelidade-recompensa-cadeado" aria-hidden="true">
                  🔒
                </span>
              )}
            </div>
            <div className="fidelidade-recompensa-info">
              <div className="fidelidade-recompensa-nome">{r.nome}</div>
              <div className="fidelidade-recompensa-custo">{r.custoPontos} pontos</div>
            </div>
            <button
              type="button"
              className="btn-resgatar"
              disabled={!alcancavel}
              onClick={() => resgatarPontos(r.id)}
            >
              Resgatar
            </button>
          </div>
        );
      })}
    </div>
  );
}

// "Faltam N pontos pra virar Prata/Ouro" — usa pontosVitalicios (histórico
// total, nunca diminui), não o saldo gastável, porque é isso que define o
// nível (ver utils/utils.js#getNivel).
function ProximoNivel({ pontosVitalicios, niveis }) {
  const ordenados = [...niveis].sort(
    (a, b) => a.minPontosVitalicios - b.minPontosVitalicios,
  );
  const proximo = ordenados.find((n) => n.minPontosVitalicios > pontosVitalicios);
  if (!proximo) return null;
  const faltam = proximo.minPontosVitalicios - pontosVitalicios;
  return (
    <div className="fidelidade-proximo-nivel">
      Faltam {faltam} ponto(s) (acumulados) pra virar {proximo.nome}
    </div>
  );
}

// Janela própria de "Reservar mesa", aberta a partir do item de menu em
// "Sua conta" (mesmo molde de Favoritos/Pedidos/Extrato/Carteira) — antes
// isso era "agendar horário" dentro do carrinho de mesa, que não fazia
// sentido pra quem já tá sentado (ver components/cart.jsx#PedidoInfo). Aqui
// é reservar uma mesa pra um horário futuro, sem relação com nenhum pedido
// específico.
export function ReservaMesaSheet() {
  const { reservasOpen, fecharReservas, sessao, criarReservaMesa, cancelarReservaMesa } = useApp();
  const logado = sessao?.tipo === "usuario";
  const reservas = logado ? getReservas(sessao.email) : [];

  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [hora, setHora] = useState("");
  const [pessoas, setPessoas] = useState(2);
  const [observacao, setObservacao] = useState("");

  function onSubmit(e) {
    e.preventDefault();
    if (criarReservaMesa({ data, hora, pessoas, observacao })) {
      setHora("");
      setObservacao("");
    }
  }

  return (
    <ModalSheet
      open={reservasOpen}
      className="reservas-sheet"
      overlayClassName="reservas-overlay"
      ariaLabel="Reservar mesa"
      onOverlayClick={fecharReservas}
    >
      <div className="product-head">
        <button className="icon-btn" aria-label="Voltar" onClick={fecharReservas}>
          ←
        </button>
        <h2>📅 Reservar mesa</h2>
      </div>
      <div className="product-body fidelidade-body">
        {!logado ? (
          <div className="fidelidade-convite">
            <p>Entre na sua conta pra reservar uma mesa com antecedência.</p>
          </div>
        ) : (
          <>
            <form className="conta-form reserva-form" onSubmit={onSubmit}>
              <div className="reserva-form-linha">
                <div>
                  <label htmlFor="reservaData">Data</label>
                  <input
                    id="reservaData"
                    type="date"
                    min={hoje}
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="reservaHora">Hora</label>
                  <input
                    id="reservaHora"
                    type="time"
                    required
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reservaPessoas">Quantas pessoas?</label>
                <input
                  id="reservaPessoas"
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={pessoas}
                  onChange={(e) => setPessoas(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="reservaObs">Observação (opcional)</label>
                <input
                  id="reservaObs"
                  type="text"
                  placeholder="Ex.: aniversário, cadeira de bebê..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-entrar">
                📅 Reservar mesa
              </button>
            </form>

            <h3 className="fidelidade-subtitulo">Suas reservas</h3>
            {reservas.length === 0 ? (
              <p className="fidelidade-sem-recompensa">Nenhuma reserva ainda.</p>
            ) : (
              <div className="reservas-lista">
                {reservas.map((r) => (
                  <div className="reserva-linha" key={r.id}>
                    <div>
                      <span className="reserva-data">
                        {r.data.split("-").reverse().join("/")} às {r.hora}
                      </span>
                      <span className="reserva-detalhe">
                        {r.pessoas} pessoa(s)
                        {r.observacao ? ` · ${r.observacao}` : ""}
                      </span>
                    </div>
                    <button type="button" className="link-voltar" onClick={() => cancelarReservaMesa(r.id)}>
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ModalSheet>
  );
}
