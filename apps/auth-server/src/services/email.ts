import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  DEFAULT_EMAIL_LOCALE,
  type EmailLocale,
  resolvePreferredEmailLocale,
  toIntlLocale,
} from "./locale.js";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailLocaleMessages {
  genericUser: string;
  verification: {
    subject: string;
    title: string;
    greeting: (name: string) => string;
    intro: string;
    cta: string;
    fallback: string;
    text: (url: string) => string;
  };
  reset: {
    subject: string;
    title: string;
    greeting: (name: string) => string;
    intro: string;
    cta: string;
    ignore: string;
    text: (url: string) => string;
  };
  travel: {
    subject: string;
    title: string;
    greeting: (name: string) => string;
    intro: string;
    tokenLabel: string;
    validFor: (minutes: number) => string;
    expiresAt: (value: string) => string;
    accessFor: (days: number) => string;
    issuedFrom: string;
    cta: string;
    security: string;
    textIntro: string;
    textToken: (token: string) => string;
    textExpires: (value: string) => string;
    textValidity: (minutes: number) => string;
    textAccessDuration: (days: number) => string;
    textOpenApp: (url: string) => string;
  };
}

const RESEND_API_URL = "https://api.resend.com/emails";

export const isEmailDeliveryEnabled = (): boolean =>
  Boolean(env.resendApiKey && env.resendFromEmail);

export const sendEmail = async (params: SendEmailParams): Promise<boolean> => {
  if (!isEmailDeliveryEnabled()) {
    logger.warn("Email delivery disabled. Configure RESEND_API_KEY and RESEND_FROM_EMAIL.");
    return false;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(env.resendReplyToEmail ? { reply_to: env.resendReplyToEmail } : {}),
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      logger.error("Failed to send email with Resend", {
        status: response.status,
        details,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Resend email request failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildAppRouteLink = (route: string, params: URLSearchParams): string => {
  const desktopBase = env.desktopAppUrl?.trim();
  const query = params.toString();

  if (desktopBase) {
    const normalized = desktopBase.replace(/\/+$/, "");
    if (normalized.endsWith("://")) {
      return `${normalized}${route}${query ? `?${query}` : ""}`;
    }
    return `${normalized}/${route}${query ? `?${query}` : ""}`;
  }

  return `${env.appBaseUrl}/#/${route}${query ? `?${query}` : ""}`;
};

const toAppConfirmEmailUrl = (originalUrl: string): string => {
  try {
    const parsed = new URL(originalUrl);
    let token = parsed.searchParams.get("token");

    if (!token) {
      const segments = parsed.pathname.split("/").filter((segment) => segment.length > 0);
      token = segments.length > 0 ? (segments[segments.length - 1] ?? null) : null;
    }

    if (!token) {
      return originalUrl;
    }

    return buildAppRouteLink("confirm-email", new URLSearchParams({ token: String(token) }));
  } catch {
    return originalUrl;
  }
};

const toAppResetUrl = (originalUrl: string): string => {
  try {
    const parsed = new URL(originalUrl);
    let token = parsed.searchParams.get("token");

    if (!token) {
      const segments = parsed.pathname.split("/").filter((segment) => segment.length > 0);
      token = segments.length > 0 ? (segments[segments.length - 1] ?? null) : null;
    }

    if (!token) {
      return originalUrl;
    }

    return buildAppRouteLink("reset-password", new URLSearchParams({ token: String(token) }));
  } catch {
    return originalUrl;
  }
};

const LOGO_SVG = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="6" fill="#1a1a2e"/><text x="6" y="17" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#fff" letter-spacing="0.5">KŌ</text><text x="6" y="33" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#fff" letter-spacing="0.5">MA</text><circle cx="32" cy="10" r="4" fill="#a855f7"/></svg>`;

const buildEmailButton = (label: string, href: string): string => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 24px;">
    <tr>
      <td align="center" bgcolor="#7c3aed" style="background-color:#7c3aed;border:1px solid #a855f7;border-radius:12px;">
        <a
          href="${href}"
          style="display:block;padding:14px 32px;font-size:15px;font-weight:700;line-height:1.2;color:#ffffff !important;text-decoration:none;border-radius:12px;letter-spacing:0.3px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;"
        >${label}</a>
      </td>
    </tr>
  </table>
`;

const buildHtmlDocument = (body: string, footerExtra?: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <title>KŌMA Studio</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0a0a0f;">
    <tr><td align="center" style="padding:40px 16px 0;">

      <!-- Top accent line -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="height:2px;background-color:#7c3aed;border-radius:1px;"></td></tr>
      </table>

      <!-- Logo -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding:28px 0 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="vertical-align:middle;padding-right:12px;">
                ${LOGO_SVG}
              </td>
              <td style="vertical-align:middle;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:2px;">KŌMA</span>
                <span style="font-size:13px;font-weight:600;color:#a0a0b8;letter-spacing:3px;margin-left:6px;">STUDIO</span>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <!-- Main card -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="background-color:#141420;border:1px solid #2a2a3d;border-radius:16px;padding:40px 36px;">
          ${body}
        </td></tr>
      </table>

      <!-- Footer -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding:32px 0 8px;">
          ${LOGO_SVG}
        </td></tr>
        <tr><td align="center" style="padding:12px 0 4px;font-size:12px;color:#6b6b80;">
          &copy; ${new Date().getFullYear()} KŌMA Studio. All rights reserved.
        </td></tr>
        ${footerExtra ? `<tr><td align="center" style="padding:8px 0;font-size:12px;color:#6b6b80;">${footerExtra}</td></tr>` : ""}
        <tr><td style="height:40px;"></td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>
`;

const MESSAGES: Partial<Record<EmailLocale, EmailLocaleMessages>> = {
  en: {
    genericUser: "user",
    verification: {
      subject: "Confirm your email - KŌMA Studio",
      title: "Confirm your email",
      greeting: (name) => `Hello, ${name}.`,
      intro: "Click the button below to confirm your email and unlock all account actions.",
      cta: "Confirm email",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      text: (url) => `Confirm your email: ${url}`,
    },
    reset: {
      subject: "Reset your password - KŌMA Studio",
      title: "Reset password",
      greeting: (name) => `Hello, ${name}.`,
      intro: "We received a request to reset your password. Click the button below to continue.",
      cta: "Reset password",
      ignore: "If you did not request this, you can ignore this email.",
      text: (url) => `Reset your password: ${url}`,
    },
    travel: {
      subject: "Travel token - KŌMA Studio",
      title: "Authorize a temporary computer",
      greeting: (name) => `Hello, ${name}.`,
      intro: "Use the code below at KŌMA Studio login to authorize a secondary computer.",
      tokenLabel: "Travel token",
      validFor: (minutes) => `Code valid for ${minutes} minutes.`,
      expiresAt: (value) => `Expires at ${value}.`,
      accessFor: (days) => `The authorized computer can be used for ${days} days.`,
      issuedFrom: "On the main PC, this code was issued in <strong>Settings &gt; Travel access</strong>.",
      cta: "Open KŌMA Studio at login",
      security: "For security reasons, do not share this code with third parties.",
      textIntro: "Authorize a temporary computer in KŌMA Studio.",
      textToken: (token) => `Travel token: ${token}`,
      textExpires: (value) => `Expires at: ${value}`,
      textValidity: (minutes) => `Code validity: ${minutes} minutes`,
      textAccessDuration: (days) => `Temporary access duration: ${days} days`,
      textOpenApp: (url) => `Open app: ${url}`,
    },
  },
  "pt-br": {
    genericUser: "usuario",
    verification: {
      subject: "Confirme seu email - KŌMA Studio",
      title: "Confirme seu email",
      greeting: (name) => `Ola, ${name}.`,
      intro: "Clique no botao abaixo para confirmar seu email e liberar todas as acoes da conta.",
      cta: "Confirmar email",
      fallback: "Se o botao nao funcionar, copie e cole este link no navegador:",
      text: (url) => `Confirme seu email: ${url}`,
    },
    reset: {
      subject: "Redefinicao de senha - KŌMA Studio",
      title: "Redefinir senha",
      greeting: (name) => `Ola, ${name}.`,
      intro: "Recebemos um pedido para redefinir sua senha. Clique no botao abaixo para continuar.",
      cta: "Redefinir senha",
      ignore: "Se voce nao solicitou isso, ignore este email.",
      text: (url) => `Redefina sua senha: ${url}`,
    },
    travel: {
      subject: "Token de viagem - KŌMA Studio",
      title: "Autorize um computador temporario",
      greeting: (name) => `Ola, ${name}.`,
      intro: "Use o codigo abaixo no login do KŌMA Studio para autorizar um computador secundario.",
      tokenLabel: "Token de viagem",
      validFor: (minutes) => `Codigo valido por ${minutes} minutos.`,
      expiresAt: (value) => `Expira em ${value}.`,
      accessFor: (days) => `O computador autorizado podera ser usado por ${days} dias.`,
      issuedFrom: "No PC principal, este codigo foi emitido na secao <strong>Configuracoes &gt; Acesso em viagem</strong>.",
      cta: "Abrir KŌMA Studio no login",
      security: "Por seguranca, nao compartilhe este codigo com terceiros.",
      textIntro: "Autorize um computador temporario no KŌMA Studio.",
      textToken: (token) => `Token de viagem: ${token}`,
      textExpires: (value) => `Expira em: ${value}`,
      textValidity: (minutes) => `Validade do codigo: ${minutes} minutos`,
      textAccessDuration: (days) => `Duracao do acesso temporario: ${days} dias`,
      textOpenApp: (url) => `Abrir app: ${url}`,
    },
  },
  pt: {
    genericUser: "utilizador",
    verification: {
      subject: "Confirme o seu email - KŌMA Studio",
      title: "Confirme o seu email",
      greeting: (name) => `Olá, ${name}.`,
      intro: "Clique no botão abaixo para confirmar o seu email e desbloquear todas as ações da conta.",
      cta: "Confirmar email",
      fallback: "Se o botão não funcionar, copie e cole este link no navegador:",
      text: (url) => `Confirme o seu email: ${url}`,
    },
    reset: {
      subject: "Redefinição de palavra-passe - KŌMA Studio",
      title: "Redefinir palavra-passe",
      greeting: (name) => `Olá, ${name}.`,
      intro: "Recebemos um pedido para redefinir a sua palavra-passe. Clique no botão abaixo para continuar.",
      cta: "Redefinir palavra-passe",
      ignore: "Se não pediu isto, pode ignorar este email.",
      text: (url) => `Redefina a sua palavra-passe: ${url}`,
    },
    travel: {
      subject: "Token de viagem - KŌMA Studio",
      title: "Autorizar um computador temporário",
      greeting: (name) => `Olá, ${name}.`,
      intro: "Utilize o código abaixo no login do KŌMA Studio para autorizar um computador secundário.",
      tokenLabel: "Token de viagem",
      validFor: (minutes) => `Código válido por ${minutes} minutos.`,
      expiresAt: (value) => `Expira em ${value}.`,
      accessFor: (days) => `O computador autorizado poderá ser usado durante ${days} dias.`,
      issuedFrom: "No PC principal, este código foi emitido na secção <strong>Definições &gt; Acesso em viagem</strong>.",
      cta: "Abrir KŌMA Studio no login",
      security: "Por segurança, não partilhe este código com terceiros.",
      textIntro: "Autorize um computador temporário no KŌMA Studio.",
      textToken: (token) => `Token de viagem: ${token}`,
      textExpires: (value) => `Expira em: ${value}`,
      textValidity: (minutes) => `Validade do código: ${minutes} minutos`,
      textAccessDuration: (days) => `Duração do acesso temporário: ${days} dias`,
      textOpenApp: (url) => `Abrir app: ${url}`,
    },
  },
  de: {
    genericUser: "Benutzer",
    verification: {
      subject: "Bestätige deine E-Mail - KŌMA Studio",
      title: "Bestätige deine E-Mail",
      greeting: (name) => `Hallo, ${name}.`,
      intro: "Klicke auf die Schaltfläche unten, um deine E-Mail zu bestätigen und alle Kontofunktionen freizuschalten.",
      cta: "E-Mail bestätigen",
      fallback: "Falls die Schaltfläche nicht funktioniert, kopiere diesen Link in deinen Browser:",
      text: (url) => `Bestätige deine E-Mail: ${url}`,
    },
    reset: {
      subject: "Passwort zurücksetzen - KŌMA Studio",
      title: "Passwort zurücksetzen",
      greeting: (name) => `Hallo, ${name}.`,
      intro: "Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke unten, um fortzufahren.",
      cta: "Passwort zurücksetzen",
      ignore: "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
      text: (url) => `Setze dein Passwort zurück: ${url}`,
    },
    travel: {
      subject: "Reise-Token - KŌMA Studio",
      title: "Temporären Computer autorisieren",
      greeting: (name) => `Hallo, ${name}.`,
      intro: "Verwende den untenstehenden Code beim Login von KŌMA Studio, um einen zweiten Computer zu autorisieren.",
      tokenLabel: "Reise-Token",
      validFor: (minutes) => `Code gültig für ${minutes} Minuten.`,
      expiresAt: (value) => `Läuft ab am ${value}.`,
      accessFor: (days) => `Der autorisierte Computer kann ${days} Tage verwendet werden.`,
      issuedFrom: "Auf dem Haupt-PC wurde dieser Code im Bereich <strong>Einstellungen &gt; Reisezugang</strong> erstellt.",
      cta: "KŌMA Studio beim Login öffnen",
      security: "Teile diesen Code aus Sicherheitsgründen nicht mit Dritten.",
      textIntro: "Autorisieren Sie einen temporären Computer in KŌMA Studio.",
      textToken: (token) => `Reise-Token: ${token}`,
      textExpires: (value) => `Läuft ab: ${value}`,
      textValidity: (minutes) => `Gültigkeit des Codes: ${minutes} Minuten`,
      textAccessDuration: (days) => `Dauer des temporären Zugriffs: ${days} Tage`,
      textOpenApp: (url) => `App öffnen: ${url}`,
    },
  },
  es: {
    genericUser: "usuario",
    verification: {
      subject: "Confirma tu correo electrónico - KŌMA Studio",
      title: "Confirma tu correo electrónico",
      greeting: (name) => `Hola, ${name}.`,
      intro: "Haz clic en el botón de abajo para confirmar tu correo electrónico y habilitar todas las acciones de la cuenta.",
      cta: "Confirmar correo",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      text: (url) => `Confirma tu correo: ${url}`,
    },
    reset: {
      subject: "Restablecer contraseña - KŌMA Studio",
      title: "Restablecer contraseña",
      greeting: (name) => `Hola, ${name}.`,
      intro: "Recibimos una solicitud para restablecer tu contraseña. Haz clic abajo para continuar.",
      cta: "Restablecer contraseña",
      ignore: "Si no solicitaste esto, puedes ignorar este correo.",
      text: (url) => `Restablece tu contraseña: ${url}`,
    },
    travel: {
      subject: "Token de viaje - KŌMA Studio",
      title: "Autorizar un equipo temporal",
      greeting: (name) => `Hola, ${name}.`,
      intro: "Usa el código de abajo al iniciar sesión en KŌMA Studio para autorizar un equipo secundario.",
      tokenLabel: "Token de viaje",
      validFor: (minutes) => `Código válido durante ${minutes} minutos.`,
      expiresAt: (value) => `Caduca en ${value}.`,
      accessFor: (days) => `El equipo autorizado podrá usarse durante ${days} días.`,
      issuedFrom: "En el PC principal, este código se emitió en <strong>Configuración &gt; Acceso en viaje</strong>.",
      cta: "Abrir KŌMA Studio en el inicio de sesión",
      security: "Por seguridad, no compartas este código con terceros.",
      textIntro: "Autoriza un equipo temporal en KŌMA Studio.",
      textToken: (token) => `Token de viaje: ${token}`,
      textExpires: (value) => `Caduca en: ${value}`,
      textValidity: (minutes) => `Validez del código: ${minutes} minutos`,
      textAccessDuration: (days) => `Duración del acceso temporal: ${days} días`,
      textOpenApp: (url) => `Abrir app: ${url}`,
    },
  },
  fr: {
    genericUser: "utilisateur",
    verification: {
      subject: "Confirmez votre e-mail - KŌMA Studio",
      title: "Confirmez votre e-mail",
      greeting: (name) => `Bonjour, ${name}.`,
      intro: "Cliquez sur le bouton ci-dessous pour confirmer votre e-mail et débloquer toutes les actions du compte.",
      cta: "Confirmer l’e-mail",
      fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
      text: (url) => `Confirmez votre e-mail : ${url}`,
    },
    reset: {
      subject: "Réinitialiser le mot de passe - KŌMA Studio",
      title: "Réinitialiser le mot de passe",
      greeting: (name) => `Bonjour, ${name}.`,
      intro: "Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez ci-dessous pour continuer.",
      cta: "Réinitialiser le mot de passe",
      ignore: "Si vous n’avez pas demandé cela, vous pouvez ignorer cet e-mail.",
      text: (url) => `Réinitialisez votre mot de passe : ${url}`,
    },
    travel: {
      subject: "Jeton de voyage - KŌMA Studio",
      title: "Autoriser un ordinateur temporaire",
      greeting: (name) => `Bonjour, ${name}.`,
      intro: "Utilisez le code ci-dessous lors de la connexion à KŌMA Studio pour autoriser un ordinateur secondaire.",
      tokenLabel: "Jeton de voyage",
      validFor: (minutes) => `Code valable pendant ${minutes} minutes.`,
      expiresAt: (value) => `Expire le ${value}.`,
      accessFor: (days) => `L’ordinateur autorisé pourra être utilisé pendant ${days} jours.`,
      issuedFrom: "Sur le PC principal, ce code a été émis dans <strong>Paramètres &gt; Accès en voyage</strong>.",
      cta: "Ouvrir KŌMA Studio à la connexion",
      security: "Pour des raisons de sécurité, ne partagez pas ce code avec des tiers.",
      textIntro: "Autorisez un ordinateur temporaire dans KŌMA Studio.",
      textToken: (token) => `Jeton de voyage : ${token}`,
      textExpires: (value) => `Expire le : ${value}`,
      textValidity: (minutes) => `Validité du code : ${minutes} minutes`,
      textAccessDuration: (days) => `Durée de l’accès temporaire : ${days} jours`,
      textOpenApp: (url) => `Ouvrir l’app : ${url}`,
    },
  },
  hi: {
    genericUser: "उपयोगकर्ता",
    verification: {
      subject: "अपना ईमेल पुष्टि करें - KŌMA Studio",
      title: "अपना ईमेल पुष्टि करें",
      greeting: (name) => `नमस्ते, ${name}.`,
      intro: "अपना ईमेल पुष्टि करने और खाते की सभी सुविधाएँ सक्रिय करने के लिए नीचे दिए गए बटन पर क्लिक करें।",
      cta: "ईमेल पुष्टि करें",
      fallback: "यदि बटन काम न करे, तो यह लिंक अपने ब्राउज़र में कॉपी-पेस्ट करें:",
      text: (url) => `अपना ईमेल पुष्टि करें: ${url}`,
    },
    reset: {
      subject: "पासवर्ड रीसेट करें - KŌMA Studio",
      title: "पासवर्ड रीसेट करें",
      greeting: (name) => `नमस्ते, ${name}.`,
      intro: "हमें आपका पासवर्ड रीसेट करने का अनुरोध मिला है। आगे बढ़ने के लिए नीचे क्लिक करें।",
      cta: "पासवर्ड रीसेट करें",
      ignore: "यदि आपने यह अनुरोध नहीं किया है, तो इस ईमेल को नज़रअंदाज़ करें।",
      text: (url) => `अपना पासवर्ड रीसेट करें: ${url}`,
    },
    travel: {
      subject: "ट्रैवल टोकन - KŌMA Studio",
      title: "एक अस्थायी कंप्यूटर को अधिकृत करें",
      greeting: (name) => `नमस्ते, ${name}.`,
      intro: "द्वितीयक कंप्यूटर को अधिकृत करने के लिए KŌMA Studio लॉगिन में नीचे दिया गया कोड उपयोग करें।",
      tokenLabel: "ट्रैवल टोकन",
      validFor: (minutes) => `कोड ${minutes} मिनट तक मान्य है।`,
      expiresAt: (value) => `समाप्ति समय: ${value}.`,
      accessFor: (days) => `अधिकृत कंप्यूटर का उपयोग ${days} दिनों तक किया जा सकेगा।`,
      issuedFrom: "मुख्य पीसी पर यह कोड <strong>सेटिंग्स &gt; ट्रैवल एक्सेस</strong> में जारी किया गया था।",
      cta: "लॉगिन पर KŌMA Studio खोलें",
      security: "सुरक्षा कारणों से, यह कोड किसी और के साथ साझा न करें।",
      textIntro: "KŌMA Studio में एक अस्थायी कंप्यूटर को अधिकृत करें।",
      textToken: (token) => `ट्रैवल टोकन: ${token}`,
      textExpires: (value) => `समाप्ति: ${value}`,
      textValidity: (minutes) => `कोड वैधता: ${minutes} मिनट`,
      textAccessDuration: (days) => `अस्थायी पहुँच अवधि: ${days} दिन`,
      textOpenApp: (url) => `ऐप खोलें: ${url}`,
    },
  },
  it: {
    genericUser: "utente",
    verification: {
      subject: "Conferma la tua email - KŌMA Studio",
      title: "Conferma la tua email",
      greeting: (name) => `Ciao, ${name}.`,
      intro: "Fai clic sul pulsante qui sotto per confermare la tua email e sbloccare tutte le azioni dell’account.",
      cta: "Conferma email",
      fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
      text: (url) => `Conferma la tua email: ${url}`,
    },
    reset: {
      subject: "Reimposta password - KŌMA Studio",
      title: "Reimposta password",
      greeting: (name) => `Ciao, ${name}.`,
      intro: "Abbiamo ricevuto una richiesta di reimpostazione della tua password. Fai clic qui sotto per continuare.",
      cta: "Reimposta password",
      ignore: "Se non hai richiesto questa operazione, puoi ignorare questa email.",
      text: (url) => `Reimposta la tua password: ${url}`,
    },
    travel: {
      subject: "Token di viaggio - KŌMA Studio",
      title: "Autorizza un computer temporaneo",
      greeting: (name) => `Ciao, ${name}.`,
      intro: "Usa il codice qui sotto al login di KŌMA Studio per autorizzare un computer secondario.",
      tokenLabel: "Token di viaggio",
      validFor: (minutes) => `Codice valido per ${minutes} minuti.`,
      expiresAt: (value) => `Scade il ${value}.`,
      accessFor: (days) => `Il computer autorizzato potrà essere usato per ${days} giorni.`,
      issuedFrom: "Sul PC principale, questo codice è stato emesso nella sezione <strong>Impostazioni &gt; Accesso in viaggio</strong>.",
      cta: "Apri KŌMA Studio al login",
      security: "Per motivi di sicurezza, non condividere questo codice con terzi.",
      textIntro: "Autorizza un computer temporaneo in KŌMA Studio.",
      textToken: (token) => `Token di viaggio: ${token}`,
      textExpires: (value) => `Scade il: ${value}`,
      textValidity: (minutes) => `Validità del codice: ${minutes} minuti`,
      textAccessDuration: (days) => `Durata dell’accesso temporaneo: ${days} giorni`,
      textOpenApp: (url) => `Apri app: ${url}`,
    },
  },
  ja: {
    genericUser: "ユーザー",
    verification: {
      subject: "メールアドレスを確認してください - KŌMA Studio",
      title: "メールアドレスを確認してください",
      greeting: (name) => `こんにちは、${name} さん。`,
      intro: "下のボタンをクリックしてメールアドレスを確認し、アカウントのすべての機能を有効にしてください。",
      cta: "メールを確認する",
      fallback: "ボタンが動作しない場合は、以下のリンクをブラウザにコピーしてください:",
      text: (url) => `メールアドレスを確認してください: ${url}`,
    },
    reset: {
      subject: "パスワードの再設定 - KŌMA Studio",
      title: "パスワードを再設定する",
      greeting: (name) => `こんにちは、${name} さん。`,
      intro: "パスワード再設定のリクエストを受け付けました。続行するには下のボタンをクリックしてください。",
      cta: "パスワードを再設定する",
      ignore: "この操作に心当たりがない場合は、このメールを無視してください。",
      text: (url) => `パスワードを再設定してください: ${url}`,
    },
    travel: {
      subject: "トラベルトークン - KŌMA Studio",
      title: "一時的なコンピューターを認証する",
      greeting: (name) => `こんにちは、${name} さん。`,
      intro: "KŌMA Studio のログイン時に以下のコードを使用して、別のコンピューターを認証してください。",
      tokenLabel: "トラベルトークン",
      validFor: (minutes) => `コードの有効期限は ${minutes} 分です。`,
      expiresAt: (value) => `${value} に期限切れになります。`,
      accessFor: (days) => `認証されたコンピューターは ${days} 日間使用できます。`,
      issuedFrom: "このコードはメインPCの <strong>設定 &gt; 旅行アクセス</strong> で発行されました。",
      cta: "ログイン画面で KŌMA Studio を開く",
      security: "セキュリティのため、このコードを第三者と共有しないでください。",
      textIntro: "KŌMA Studio で一時的なコンピューターを認証してください。",
      textToken: (token) => `トラベルトークン: ${token}`,
      textExpires: (value) => `有効期限: ${value}`,
      textValidity: (minutes) => `コード有効時間: ${minutes} 分`,
      textAccessDuration: (days) => `一時アクセス期間: ${days} 日`,
      textOpenApp: (url) => `アプリを開く: ${url}`,
    },
  },
  ko: {
    genericUser: "사용자",
    verification: {
      subject: "이메일을 확인하세요 - KŌMA Studio",
      title: "이메일을 확인하세요",
      greeting: (name) => `안녕하세요, ${name}님.`,
      intro: "아래 버튼을 클릭하여 이메일을 확인하고 계정의 모든 기능을 활성화하세요.",
      cta: "이메일 확인",
      fallback: "버튼이 작동하지 않으면 아래 링크를 브라우저에 복사해 붙여넣으세요:",
      text: (url) => `이메일을 확인하세요: ${url}`,
    },
    reset: {
      subject: "비밀번호 재설정 - KŌMA Studio",
      title: "비밀번호 재설정",
      greeting: (name) => `안녕하세요, ${name}님.`,
      intro: "비밀번호 재설정 요청이 접수되었습니다. 계속하려면 아래 버튼을 클릭하세요.",
      cta: "비밀번호 재설정",
      ignore: "직접 요청하지 않았다면 이 이메일을 무시해도 됩니다.",
      text: (url) => `비밀번호를 재설정하세요: ${url}`,
    },
    travel: {
      subject: "여행 토큰 - KŌMA Studio",
      title: "임시 컴퓨터 승인",
      greeting: (name) => `안녕하세요, ${name}님.`,
      intro: "보조 컴퓨터를 승인하려면 KŌMA Studio 로그인에서 아래 코드를 사용하세요.",
      tokenLabel: "여행 토큰",
      validFor: (minutes) => `코드는 ${minutes}분 동안 유효합니다.`,
      expiresAt: (value) => `${value}에 만료됩니다.`,
      accessFor: (days) => `승인된 컴퓨터는 ${days}일 동안 사용할 수 있습니다.`,
      issuedFrom: "이 코드는 메인 PC의 <strong>설정 &gt; 여행 액세스</strong>에서 발급되었습니다.",
      cta: "로그인에서 KŌMA Studio 열기",
      security: "보안을 위해 이 코드를 다른 사람과 공유하지 마세요.",
      textIntro: "KŌMA Studio에서 임시 컴퓨터를 승인하세요.",
      textToken: (token) => `여행 토큰: ${token}`,
      textExpires: (value) => `만료: ${value}`,
      textValidity: (minutes) => `코드 유효 시간: ${minutes}분`,
      textAccessDuration: (days) => `임시 액세스 기간: ${days}일`,
      textOpenApp: (url) => `앱 열기: ${url}`,
    },
  },
  ru: {
    genericUser: "пользователь",
    verification: {
      subject: "Подтвердите ваш email - KŌMA Studio",
      title: "Подтвердите ваш email",
      greeting: (name) => `Здравствуйте, ${name}.`,
      intro: "Нажмите кнопку ниже, чтобы подтвердить email и разблокировать все действия аккаунта.",
      cta: "Подтвердить email",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      text: (url) => `Подтвердите ваш email: ${url}`,
    },
    reset: {
      subject: "Сброс пароля - KŌMA Studio",
      title: "Сбросить пароль",
      greeting: (name) => `Здравствуйте, ${name}.`,
      intro: "Мы получили запрос на сброс вашего пароля. Нажмите кнопку ниже, чтобы продолжить.",
      cta: "Сбросить пароль",
      ignore: "Если вы не запрашивали это, просто проигнорируйте письмо.",
      text: (url) => `Сбросьте пароль: ${url}`,
    },
    travel: {
      subject: "Токен поездки - KŌMA Studio",
      title: "Авторизовать временный компьютер",
      greeting: (name) => `Здравствуйте, ${name}.`,
      intro: "Используйте код ниже при входе в KŌMA Studio, чтобы авторизовать дополнительный компьютер.",
      tokenLabel: "Токен поездки",
      validFor: (minutes) => `Код действителен ${minutes} минут.`,
      expiresAt: (value) => `Истекает: ${value}.`,
      accessFor: (days) => `Авторизованный компьютер можно использовать ${days} дней.`,
      issuedFrom: "На основном ПК этот код был создан в разделе <strong>Настройки &gt; Доступ в поездке</strong>.",
      cta: "Открыть KŌMA Studio на экране входа",
      security: "Из соображений безопасности не передавайте этот код третьим лицам.",
      textIntro: "Авторизуйте временный компьютер в KŌMA Studio.",
      textToken: (token) => `Токен поездки: ${token}`,
      textExpires: (value) => `Истекает: ${value}`,
      textValidity: (minutes) => `Срок действия кода: ${minutes} минут`,
      textAccessDuration: (days) => `Длительность временного доступа: ${days} дней`,
      textOpenApp: (url) => `Открыть приложение: ${url}`,
    },
  },
  zh: {
    genericUser: "用户",
    verification: {
      subject: "请确认您的邮箱 - KŌMA Studio",
      title: "请确认您的邮箱",
      greeting: (name) => `你好，${name}。`,
      intro: "点击下方按钮以确认您的邮箱并启用账户的全部功能。",
      cta: "确认邮箱",
      fallback: "如果按钮无法使用，请将此链接复制到浏览器中打开：",
      text: (url) => `确认您的邮箱：${url}`,
    },
    reset: {
      subject: "重置密码 - KŌMA Studio",
      title: "重置密码",
      greeting: (name) => `你好，${name}。`,
      intro: "我们收到了一次密码重置请求。点击下方按钮继续。",
      cta: "重置密码",
      ignore: "如果这不是您的操作，请忽略此邮件。",
      text: (url) => `重置您的密码：${url}`,
    },
    travel: {
      subject: "旅行令牌 - KŌMA Studio",
      title: "授权临时电脑",
      greeting: (name) => `你好，${name}。`,
      intro: "在 KŌMA Studio 登录时使用下面的代码来授权一台辅助电脑。",
      tokenLabel: "旅行令牌",
      validFor: (minutes) => `代码在 ${minutes} 分钟内有效。`,
      expiresAt: (value) => `过期时间：${value}。`,
      accessFor: (days) => `授权后的电脑可使用 ${days} 天。`,
      issuedFrom: "该代码已在主电脑的 <strong>设置 &gt; 旅行访问</strong> 中生成。",
      cta: "在登录页打开 KŌMA Studio",
      security: "出于安全原因，请不要将此代码分享给第三方。",
      textIntro: "在 KŌMA Studio 中授权一台临时电脑。",
      textToken: (token) => `旅行令牌：${token}`,
      textExpires: (value) => `过期时间：${value}`,
      textValidity: (minutes) => `代码有效期：${minutes} 分钟`,
      textAccessDuration: (days) => `临时访问时长：${days} 天`,
      textOpenApp: (url) => `打开应用：${url}`,
    },
  },
  ar: {
    genericUser: "المستخدم",
    verification: {
      subject: "أكد بريدك الإلكتروني - KŌMA Studio",
      title: "أكد بريدك الإلكتروني",
      greeting: (name) => `مرحبًا، ${name}.`,
      intro: "انقر على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل كل إمكانيات الحساب.",
      cta: "تأكيد البريد الإلكتروني",
      fallback: "إذا لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفح:",
      text: (url) => `أكد بريدك الإلكتروني: ${url}`,
    },
    reset: {
      subject: "إعادة تعيين كلمة المرور - KŌMA Studio",
      title: "إعادة تعيين كلمة المرور",
      greeting: (name) => `مرحبًا، ${name}.`,
      intro: "تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك. انقر على الزر أدناه للمتابعة.",
      cta: "إعادة تعيين كلمة المرور",
      ignore: "إذا لم تطلب هذا، يمكنك تجاهل هذا البريد الإلكتروني.",
      text: (url) => `أعد تعيين كلمة المرور: ${url}`,
    },
    travel: {
      subject: "رمز وصول مؤقت - KŌMA Studio",
      title: "اسمح لجهاز مؤقت",
      greeting: (name) => `مرحبًا، ${name}.`,
      intro: "استخدم الرمز أدناه في تسجيل دخول KŌMA Studio للسماح لجهاز ثانوي.",
      tokenLabel: "رمز الوصول المؤقت",
      validFor: (minutes) => `الرمز صالح لمدة ${minutes} دقيقة.`,
      expiresAt: (value) => `تنتهي الصلاحية في ${value}.`,
      accessFor: (days) => `سيبقى الجهاز المصرح به صالحًا لمدة ${days} يوم.`,
      issuedFrom: "تم إصدار هذا الرمز من القسم <strong>الإعدادات &gt; الوصول أثناء السفر</strong> على الجهاز الرئيسي.",
      cta: "فتح KŌMA Studio عند تسجيل الدخول",
      security: "لأسباب أمنية، لا تشارك هذا الرمز مع أطراف ثالثة.",
      textIntro: "اسمح لجهاز مؤقت في KŌMA Studio.",
      textToken: (token) => `رمز الوصول المؤقت: ${token}`,
      textExpires: (value) => `تنتهي الصلاحية في: ${value}`,
      textValidity: (minutes) => `صلاحية الرمز: ${minutes} دقيقة`,
      textAccessDuration: (days) => `مدة الوصول المؤقت: ${days} يوم`,
      textOpenApp: (url) => `فتح التطبيق: ${url}`,
    },
  },
};

const resolveMessages = (locale?: EmailLocale | null): EmailLocaleMessages =>
  MESSAGES[locale ?? DEFAULT_EMAIL_LOCALE] ?? MESSAGES[DEFAULT_EMAIL_LOCALE]!;

export const sendVerificationEmail = async ({
  email,
  verificationUrl,
  userName,
  locale,
}: {
  email: string;
  verificationUrl: string;
  userName?: string;
  locale?: EmailLocale | null;
}): Promise<boolean> => {
  const finalUrl = toAppConfirmEmailUrl(verificationUrl);
  const resolvedLocale = resolvePreferredEmailLocale({ userLocale: locale ?? null });
  const messages = resolveMessages(resolvedLocale);
  const safeName = userName ? escapeHtml(userName) : messages.genericUser;

  return sendEmail({
    to: email,
    subject: messages.verification.subject,
    html: buildHtmlDocument(`
      <h2 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff;">${messages.verification.title}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#d0d0e0;line-height:1.6;">${messages.verification.greeting(safeName)}</p>
      <p style="margin:0 0 28px;font-size:15px;color:#d0d0e0;line-height:1.6;">${messages.verification.intro}</p>
      ${buildEmailButton(messages.verification.cta, finalUrl)}
      <p style="margin:0 0 8px;font-size:13px;color:#6b6b80;line-height:1.5;">${messages.verification.fallback}</p>
      <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${finalUrl}" style="color:#a855f7;text-decoration:underline;">${finalUrl}</a></p>
    `),
    text: messages.verification.text(finalUrl),
  });
};

export const sendPasswordResetEmail = async ({
  email,
  resetUrl,
  userName,
  locale,
}: {
  email: string;
  resetUrl: string;
  userName?: string;
  locale?: EmailLocale | null;
}): Promise<boolean> => {
  const finalResetUrl = toAppResetUrl(resetUrl);
  const resolvedLocale = resolvePreferredEmailLocale({ userLocale: locale ?? null });
  const messages = resolveMessages(resolvedLocale);
  const safeName = userName ? escapeHtml(userName) : messages.genericUser;

  return sendEmail({
    to: email,
    subject: messages.reset.subject,
    html: buildHtmlDocument(`
      <h2 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff;">${messages.reset.title}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#d0d0e0;line-height:1.6;">${messages.reset.greeting(safeName)}</p>
      <p style="margin:0 0 28px;font-size:15px;color:#d0d0e0;line-height:1.6;">${messages.reset.intro}</p>
      ${buildEmailButton(messages.reset.cta, finalResetUrl)}
      <p style="margin:0;font-size:13px;color:#6b6b80;line-height:1.5;">${messages.reset.ignore}</p>
    `),
    text: messages.reset.text(finalResetUrl),
  });
};

export const sendDesktopTravelTokenEmail = async ({
  email,
  token,
  expiresAt,
  travelDays,
  userName,
  locale,
}: {
  email: string;
  token: string;
  expiresAt: Date;
  travelDays: number;
  userName?: string;
  locale?: EmailLocale | null;
}): Promise<boolean> => {
  const resolvedLocale = resolvePreferredEmailLocale({ userLocale: locale ?? null });
  const messages = resolveMessages(resolvedLocale);
  const safeName = userName ? escapeHtml(userName) : messages.genericUser;
  const expiresAtLabel = expiresAt.toLocaleString(toIntlLocale(resolvedLocale), {
    dateStyle: "short",
    timeStyle: "short",
  });
  const remainingMinutes = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 60_000));
  const deepLinkUrl = buildAppRouteLink("login", new URLSearchParams({ travel: "1" }));

  return sendEmail({
    to: email,
    subject: messages.travel.subject,
    html: buildHtmlDocument(`
      <h2 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff;">${messages.travel.title}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#d0d0e0;line-height:1.6;">${messages.travel.greeting(safeName)}</p>
      <p style="margin:0 0 24px;font-size:15px;color:#d0d0e0;line-height:1.6;">${messages.travel.intro}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
        <tr><td style="padding:22px 24px;border-radius:12px;background-color:#0a0a14;border:1px solid #7c3aed44;text-align:center;">
          <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a855f7;margin-bottom:10px;">${messages.travel.tokenLabel}</div>
          <div style="font-size:30px;font-weight:700;letter-spacing:0.18em;color:#ffffff;">${escapeHtml(token)}</div>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
        <tr><td style="padding:0 0 6px;font-size:14px;color:#9090a8;line-height:1.5;">&#8226; ${messages.travel.validFor(remainingMinutes)}</td></tr>
        <tr><td style="padding:0 0 6px;font-size:14px;color:#9090a8;line-height:1.5;">&#8226; ${messages.travel.expiresAt(expiresAtLabel)}</td></tr>
        <tr><td style="padding:0 0 6px;font-size:14px;color:#9090a8;line-height:1.5;">&#8226; ${messages.travel.accessFor(travelDays)}</td></tr>
      </table>
      <p style="margin:0 0 24px;font-size:14px;color:#9090a8;line-height:1.5;">${messages.travel.issuedFrom}</p>
      ${buildEmailButton(messages.travel.cta, deepLinkUrl)}
      <p style="margin:0;font-size:13px;color:#6b6b80;line-height:1.5;">${messages.travel.security}</p>
    `),
    text: [
      messages.travel.textIntro,
      messages.travel.textToken(token),
      messages.travel.textExpires(expiresAtLabel),
      messages.travel.textValidity(remainingMinutes),
      messages.travel.textAccessDuration(travelDays),
      messages.travel.textOpenApp(deepLinkUrl),
    ].join("\n"),
  });
};
