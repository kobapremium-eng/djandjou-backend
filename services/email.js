const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "DJANDJOU 3.0 <noreply@djandjou.com>";

async function sendConfirmationEmail(email, name, token) {
  const link = `${process.env.API_URL}/api/auth/confirm/${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "✉️ Confirmez votre email — DJANDJOU 3.0",
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;
                  background:#0f0f1a;color:#f0f0ff;padding:40px;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#e91e63,#f59e0b);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          DJANDJOU 3.0
        </h1>
        <h2>Bonjour ${name} 👋</h2>
        <p style="color:#b0b0cc;line-height:1.6;">
          Merci de vous être inscrit ! Cliquez ci-dessous pour activer votre compte.
        </p>
        <a href="${link}"
           style="display:inline-block;padding:14px 32px;
                  background:linear-gradient(135deg,#e91e63,#f59e0b);
                  color:#fff;text-decoration:none;border-radius:12px;
                  font-weight:700;margin-top:16px;">
          ✓ Confirmer mon email
        </a>
        <p style="color:#6b6b8a;font-size:12px;margin-top:28px;">
          Ce lien expire dans 24 heures.
        </p>
      </div>
    `,
  });
}

async function sendWelcomeEmail(email, name) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "🎉 Bienvenue sur DJANDJOU 3.0 !",
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;
                  background:#0f0f1a;color:#f0f0ff;padding:40px;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#e91e63,#f59e0b);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          DJANDJOU 3.0
        </h1>
        <h2>🎉 Bienvenue ${name} !</h2>
        <p style="color:#b0b0cc;line-height:1.6;">
          Votre compte est actif. Commencez à découvrir des profils !
        </p>
        <p style="color:#6b6b8a;font-size:12px;margin-top:28px;">
          L'équipe DJANDJOU 3.0 ❤️
        </p>
      </div>
    `,
  });
}

module.exports = { sendConfirmationEmail, sendWelcomeEmail };