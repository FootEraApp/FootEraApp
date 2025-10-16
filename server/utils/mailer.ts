import nodemailer from "nodemailer";

type Transporter = nodemailer.Transporter;

function getFrom() {
  return process.env.EMAIL_FROM || '"FootEra" <no-reply@footera.app>';
}

export async function createTransport(): Promise<Transporter> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: false,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
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
    subject: "Redefinição de senha",
    html: `<p>Olá!</p><p>Clique para redefinir sua senha: <a href="${link}">${link}</a></p>`,
  });

  const preview = (nodemailer as any).getTestMessageUrl?.(info);
  if (preview) {
    console.log("[password-reset] preview email:", preview);
  }
}