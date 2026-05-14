// server/utils/mailer
import nodemailer from "nodemailer";

type Transporter = nodemailer.Transporter;

const SUPPORT_FALLBACK = "suporte@footera.app.br";

function getFrom() {
  return process.env.EMAIL_FROM || '"FootEra" <no-reply@footera.app.br>';
}

function getReplyTo() {
  return process.env.SUPPORT_EMAIL || SUPPORT_FALLBACK;
}

function isDevLike() {
  return process.env.NODE_ENV !== "production";
}

/**
 * Em DEV, alguns PCs (proxy/antivírus) injetam certificado SSL e o Node acusa:
 * "self-signed certificate in certificate chain"
 * => habilitamos rejectUnauthorized=false APENAS em DEV quando SMTP_HOST existe.
 */
function devTlsPatch() {
  const allowInsecure =
    isDevLike() &&
    (process.env.SMTP_ALLOW_INSECURE_TLS === "1" ||
      process.env.SMTP_ALLOW_INSECURE_TLS === "true");

  // Se você NÃO setar a env, ainda dá pra "auto-liberar" só em DEV:
  // eu recomendo deixar via ENV pra não correr risco sem querer.
  return allowInsecure
    ? { rejectUnauthorized: false }
    : undefined;
}

export async function createTransport(): Promise<Transporter> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST) {
    const port = Number(SMTP_PORT ?? 587);

    return nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: false, // SES normalmente usa 587 STARTTLS
      requireTLS: true,
      auth:
        SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,

      // ✅ aqui é o ponto
      tls: {
        minVersion: "TLSv1.2",
        ...(devTlsPatch() ?? {}),
      },

      pool: true,
      maxConnections: 2,
      rateDelta: 1000,
      rateLimit: 14,
      logger: isDevLike(),
      debug: isDevLike(),
    } as any);
  }

  // fallback (Ethereal) - ótimo pra DEV sem SMTP
  const acc = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: acc.smtp.host,
    port: acc.smtp.port,
    secure: acc.smtp.secure,
    auth: { user: acc.user, pass: acc.pass },
  });
}

export async function sendPasswordResetEmail(to: string, link: string) {
  const transporter = await createTransport();

  const info = await transporter.sendMail({
    from: getFrom(),
    to,
    replyTo: getReplyTo(),
    subject: "Redefinição de senha",
    text: `Olá!\n\nClique para redefinir sua senha: ${link}`,
    html: `<p>Olá!</p><p>Clique para redefinir sua senha: <a href="${link}">${link}</a></p>`,
  });

  const preview = (nodemailer as any).getTestMessageUrl?.(info);
  if (preview) console.log("[password-reset] preview email:", preview);
}

export async function sendEmailVerification(opts: {
  to: string;
  verifyUrl: string;
  isResponsavel?: boolean;
  nome: string;
  username: string;
  tipo: string;
  cidade?: string | null;
  estado?: string | null;
  supportEmail?: string;
}) {
  const transporter = await createTransport();

  const support = opts.supportEmail ?? process.env.SUPPORT_EMAIL ?? SUPPORT_FALLBACK;
  const subject = opts.isResponsavel
    ? "Confirme o e-mail do responsável – FootEra"
    : "Confirme seu e-mail – FootEra";

  const aviso = `Se não foi você quem criou a conta, NÃO clique em validar e contate: ${support}`;

  const PUBLIC_WEB_BASE = (process.env.WEB_BASE_URL || "https://footera.app.br").replace(/\/+$/, "");
  const LOGO_URL = `${PUBLIC_WEB_BASE}/assets/usuarios/footera-logo-fundo-verde.png`;

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
    <img src="${LOGO_URL}" alt="FootEra" style="height:48px;margin-bottom:8px"/>
    <h2 style="margin:8px 0 2px">Olá, ${opts.isResponsavel ? "Responsável" : opts.nome}!</h2>
    <p style="margin:4px 0 14px;line-height:1.5">
      ${
        opts.isResponsavel
          ? `Você foi indicado como responsável pelo cadastro do atleta <b>${opts.nome}</b> (@${opts.username}).`
          : `Recebemos seu cadastro @${opts.username} como <b>${opts.tipo}</b>${
              opts.cidade ? ` em ${opts.cidade}-${opts.estado ?? ""}` : ""
            }.`
      }
    </p>

    <a href="${opts.verifyUrl}" style="display:inline-block;background:#065f46;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:600">
      Validar e-mail
    </a>

    <p style="margin-top:18px;color:#555;font-size:13px">${aviso}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
    <p style="color:#777;font-size:12px">
      Se o botão não funcionar, copie e cole este link:<br/>
      <span style="word-break:break-all;color:#444">${opts.verifyUrl}</span>
    </p>
  </div>`;

  const text = `${
    opts.isResponsavel ? "Responsável" : opts.nome
  }, confirme o e-mail na FootEra.
Link: ${opts.verifyUrl}
${aviso}`;

  await transporter.sendMail({
    from: getFrom(),
    to: opts.to,
    replyTo: getReplyTo(),
    subject,
    html,
    text,
  });
}

export async function sendLiveEventAccessEmail(opts: {
  to: string;
  nome?: string | null;
  tituloEvento: string;
  dataInicio?: Date | string | null;
  linkEvento: string;
  linkLive?: string;
}) {
  const transporter = await createTransport();

  const PUBLIC_WEB_BASE = (process.env.WEB_BASE_URL || "https://footera.app.br").replace(/\/+$/, "");
  const LOGO_URL = `${PUBLIC_WEB_BASE}/assets/usuarios/footera-logo-fundo-verde.png`;

  const dataTexto = opts.dataInicio
    ? new Date(opts.dataInicio).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Data em breve";

  const nome = opts.nome || "Participante";

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;padding:22px;color:#0b2f22">
    <img src="${LOGO_URL}" alt="FootEra" style="height:48px;margin-bottom:12px"/>
    
    <h2 style="margin:8px 0 4px;color:#063f2a">Inscrição confirmada</h2>
    
    <p style="font-size:15px;line-height:1.6;margin:8px 0 16px">
      Olá, <b>${nome}</b>! Seu acesso ao evento <b>${opts.tituloEvento}</b> foi iniciado.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:14px;margin:16px 0">
      <p style="margin:0;font-size:14px;color:#14532d">
        <b>Data do evento:</b><br/>
        ${dataTexto}
      </p>
    </div>

    <a href="${opts.linkEvento}" style="display:inline-block;background:#064e3b;color:#fff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:700">
      Acessar página do evento
    </a>

    ${
      opts.linkLive
        ? `<p style="margin-top:14px;font-size:13px;color:#555">
            Link direto da live/replay: <br/>
            <span style="word-break:break-all">${opts.linkLive}</span>
          </p>`
        : ""
    }

    <p style="margin-top:18px;color:#555;font-size:13px;line-height:1.5">
      Se o evento ainda não começou, a página mostrará o horário de início. Depois da transmissão, o replay poderá ficar disponível no mesmo acesso.
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>

    <p style="color:#777;font-size:12px">
      Se o botão não funcionar, copie e cole este link:<br/>
      <span style="word-break:break-all;color:#444">${opts.linkEvento}</span>
    </p>
  </div>`;

  const text = `Olá, ${nome}!

Sua inscrição/acesso ao evento "${opts.tituloEvento}" foi iniciado.

Data do evento: ${dataTexto}

Acesse a página do evento:
${opts.linkEvento}

${opts.linkLive ? `Link direto da live/replay: ${opts.linkLive}` : ""}

FootEra`;

  const info = await transporter.sendMail({
    from: getFrom(),
    to: opts.to,
    replyTo: getReplyTo(),
    subject: `Acesso ao evento: ${opts.tituloEvento}`,
    html,
    text,
  });

  const preview = (nodemailer as any).getTestMessageUrl?.(info);
  if (preview) console.log("[live-event-access] preview email:", preview);
}