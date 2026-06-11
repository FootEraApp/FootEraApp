// server/services/googleTokenService.ts
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID || "";

const GOOGLE_AUDIENCES = [GOOGLE_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID].filter(Boolean);

const googleClient = new OAuth2Client();

export type GoogleTokenPayload = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

export async function validateGoogleCredential(
  credential: string
): Promise<GoogleTokenPayload> {
  if (!GOOGLE_AUDIENCES.length) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_ANDROID_CLIENT_ID não configurado no servidor.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_AUDIENCES,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Token Google inválido.");
  }

  if (!payload.sub || !payload.email) {
    throw new Error("Token Google sem sub/email.");
  }

  return {
    sub: payload.sub,
    email: String(payload.email).toLowerCase(),
    emailVerified: !!payload.email_verified,
    name: payload.name || "",
    picture: payload.picture || null,
  };
}