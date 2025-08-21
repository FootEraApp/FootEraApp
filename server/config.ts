import "dotenv/config";

export const SERVER = {
  PORT: process.env.PORT ?? "3001",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  CLIENT_BASE_URL: process.env.CLIENT_BASE_URL ?? "http://localhost:5173",
};

export const APP = {
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173", 
  BACKEND_URL : process.env.BACKEND_URL  || "http://localhost:3001",
};
