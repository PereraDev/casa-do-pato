import dns from "node:dns/promises";

// Envio de e-mail via API HTTPS do Resend (sem SMTP: o plano gratuito do Render
// bloqueia as portas 25/465/587). Sem RESEND_API_KEY o recurso fica desligado e o
// fluxo cai no modo de desenvolvimento (código no log do servidor, cadastro sem
// confirmação) — ver emailAtivo(). As variáveis são lidas a cada chamada (não no
// import), o que também deixa os testes trocarem o ambiente.
//   RESEND_API_KEY  chave da API (resend.com)
//   EMAIL_FROM      remetente, ex.: "Casa do Pato <nao-responda@seudominio.com.br>".
//                   Padrão = remetente de testes do Resend, que SÓ entrega no e-mail
//                   do dono da conta Resend; pra clientes de verdade é preciso um
//                   domínio verificado no Resend.
export const emailAtivo = () => Boolean(process.env.RESEND_API_KEY);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function enviarEmail({ para, assunto, texto, html }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Casa do Pato <onboarding@resend.dev>",
      to: [para],
      subject: assunto,
      text: texto,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Resend respondeu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
}

// Mensagem com o código de 6 dígitos (verificação de cadastro ou recuperação de senha).
export function emailComCodigo({ nome, codigo, motivo }) {
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  const assunto = `${codigo} é o seu código — Casa do Pato`;
  const texto = `${saudacao}\n\n${motivo}\n\nSeu código: ${codigo}\n\nEle vale por 15 minutos. Se não foi você, ignore este e-mail.\n\nCasa do Pato`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#222">` +
    `<h2 style="margin:0 0 12px">Casa do Pato</h2><p>${esc(saudacao)}</p><p>${esc(motivo)}</p>` +
    `<p style="font-size:32px;letter-spacing:6px;font-weight:bold;background:#f3f3f3;padding:12px;text-align:center;border-radius:8px">${esc(codigo)}</p>` +
    `<p style="color:#666;font-size:13px">Ele vale por 15 minutos. Se não foi você, ignore este e-mail.</p></div>`;
  return { assunto, texto, html };
}

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const emailComFormatoValido = (email) => email.length <= 254 && FORMATO_EMAIL.test(email);

// O domínio precisa poder receber e-mail: tem registro MX (ou ao menos endereço).
// Só reprova quando o DNS diz que o domínio NÃO existe (ENOTFOUND/ENODATA) — falha de
// rede ou timeout não deve impedir um cadastro. EMAIL_VERIFICAR_DNS=0 desliga (testes).
export async function dominioRecebeEmail(email) {
  if (process.env.EMAIL_VERIFICAR_DNS === "0") return true;
  const dominio = email.split("@")[1];
  try {
    const mx = await Promise.race([
      dns.resolveMx(dominio),
      new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), 3000)),
    ]);
    if (mx.length) return true;
  } catch (err) {
    if (err.code !== "ENOTFOUND" && err.code !== "ENODATA") return true;
  }
  return dns.lookup(dominio).then(() => true, () => false);
}
