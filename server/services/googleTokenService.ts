// server/services/googleTokenService.ts
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID não configurado no servidor.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
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