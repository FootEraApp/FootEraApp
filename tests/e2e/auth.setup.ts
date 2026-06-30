import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const authDir = path.join(process.cwd(), "tests", "e2e", ".auth");
const adminState = path.join(authDir, "admin.json");

setup("login admin (salva sessão)", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  const user = process.env.E2E_ADMIN_USER;
  const pass = process.env.E2E_ADMIN_PASS;

  if (!user || !pass) {
    throw new Error(
      "Defina E2E_ADMIN_USER e E2E_ADMIN_PASS antes de rodar os testes admin."
    );
  }

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    // @ts-ignore
    window.Cypress = true;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }
  });

  await page.goto("/login", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  const userInput = page.locator('input[name="nomeDeUsuario"]');
  const passInput = page.locator('input[name="senha"]');
  const rememberInput = page.locator("#lembrarDeMim");

  await expect(userInput).toBeVisible({ timeout: 60_000 });
  await expect(passInput).toBeVisible({ timeout: 60_000 });

  await userInput.fill(user);
  await passInput.fill(pass);

  await rememberInput.check();
  await page.getByRole("button", { name: /^Entrar$/i }).click();

  await expect(page).toHaveURL(/\/admin/, { timeout: 60_000 });

  await page.evaluate(() => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const usuarioId =
      localStorage.getItem("usuarioId") ||
      sessionStorage.getItem("usuarioId") ||
      "";

    const nomeUsuario =
      localStorage.getItem("nomeUsuario") ||
      sessionStorage.getItem("nomeUsuario") ||
      "admin";

    const plano =
      localStorage.getItem("plano") ||
      sessionStorage.getItem("plano") ||
      "FREE";

    if (token) localStorage.setItem("token", token);
    if (usuarioId) localStorage.setItem("usuarioId", usuarioId);

    localStorage.setItem("tipoUsuario", "admin");
    localStorage.setItem("usuarioTipoRaw", "admin");
    localStorage.setItem("nomeUsuario", nomeUsuario);
    localStorage.setItem("plano", plano);
  });

  await expect
    .poll(async () => {
      return await page.evaluate(() => localStorage.getItem("token"));
    }, { timeout: 10_000 })
    .toBeTruthy();

  await page.context().storageState({ path: adminState });
});