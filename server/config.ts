import "dotenv/config";

export const SERVER = {
  PORT: process.env.PORT ?? "3001",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  CLIENT_BASE_URL: process.env.CLIENT_BASE_URL ?? "http://localhost:5173",
};