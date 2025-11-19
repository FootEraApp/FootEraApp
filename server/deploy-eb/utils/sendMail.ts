import nodemailer from "nodemailer";

export const sendMail = async (to: string, subject: string, text: string) => {
  const transporter = nodemailer.createTransport({
    host: "mail5019.site4now.net",
    port: 465,
    secure: true,
    auth: {
      user: "contato@footera.com.br",
      pass: "10Footer@10#",
    },
  });

  const mailOptions = {
    from: '"Footera" <contato@footera.com.br>',
    to,
    subject,
    text,
  };

  return transporter.sendMail(mailOptions);
};
