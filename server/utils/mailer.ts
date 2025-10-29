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

export async function createTransport(): Promise<Transporter> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST) {

    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: false,
      requireTLS: true,
      tls: { minVersion: "TLSv1.2" },
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 2,
      rateDelta: 1000,
      rateLimit: 14,
      logger: true,
      debug: true,
    } as any);
  }

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
  if (preview) {
    console.log("[password-reset] preview email:", preview);
  }
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

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
    <img src="https://footera.com.br/assets/usuarios/footera-logo.png" alt="FootEra" style="height:48px;margin-bottom:8px"/>
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
