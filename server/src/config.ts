export const SERVER_CONFIG = {
   BASE_URL:
    process.env.BACKEND_URL ||
    process.env.API_BASE_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://api.footera.app.br"
      : "http://localhost:3001"),
  JWT_SECRET: process.env.JWT_SECRET || "defaultsecret",
};