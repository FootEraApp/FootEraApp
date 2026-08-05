import { test as setup, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const authDir = path.join(process.cwd(), "tests", "e2e", ".auth");

type E2ERole =
  | "atleta"
  | "professor"
  | "clube"
  | "escola"
  | "olheiro";

type LoginConfig = {
  role: E2ERole;
  userEnv: string;
  passEnv: string;
  storageFile: string;
  expectedTipo: string;
};

const configs: LoginConfig[] = [
  {
    role: "atleta",
    userEnv: "E2E_ATLETA_USER",
    passEnv: "E2E_ATLETA_PASS",
    storageFile: "atleta.json",
    expectedTipo: "atleta",
  },
  {
    role: "professor",
    userEnv: "E2E_PROFESSOR_USER",
    passEnv: "E2E_PROFESSOR_PASS",
    storageFile: "professor.json",
    expectedTipo: "professor",
  },
  {
    role: "clube",
    userEnv: "E2E_CLUBE_USER",
    passEnv: "E2E_CLUBE_PASS",
    storageFile: "clube.json",
    expectedTipo: "clube",
  },
  {
    role: "escola",
    userEnv: "E2E_ESCOLA_USER",
    passEnv: "E2E_ESCOLA_PASS",
    storageFile: "escola.json",
    expectedTipo: "escolinha",
  },
  {
    role: "olheiro",
    userEnv: "E2E_OLHEIRO_USER",
    passEnv: "E2E_OLHEIRO_PASS",
    storageFile: "olheiro.json",
    expectedTipo: "olheiro",
  },
];

async function loginAndSaveState(page: Page, config: LoginConfig) {
  fs.mkdirSync(authDir, { recursive: true });

  const user = process.env[config.userEnv];
  const pass = process.env[config.passEnv];

  if (!user || !pass) {
    throw new Error(
      `Defina ${config.userEnv} e ${config.passEnv} antes de rodar os testes de ${config.role}.`
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

  await expect(page).toHaveURL(/\/perfil/, { timeout: 60_000 });

  await page.evaluate((expectedTipo) => {
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
      "";

    const plano =
      localStorage.getItem("plano") ||
      sessionStorage.getItem("plano") ||
      "FREE";

    const tipoUsuario =
      localStorage.getItem("tipoUsuario") ||
      sessionStorage.getItem("tipoUsuario") ||
      expectedTipo;

    if (token) localStorage.setItem("token", token);
    if (usuarioId) localStorage.setItem("usuarioId", usuarioId);
    if (nomeUsuario) localStorage.setItem("nomeUsuario", nomeUsuario);

    localStorage.setItem("tipoUsuario", tipoUsuario || expectedTipo);
    localStorage.setItem("usuarioTipoRaw", tipoUsuario || expectedTipo);
    localStorage.setItem("plano", plano);
  }, config.expectedTipo);

  await expect
    .poll(
      async () => {
        return await page.evaluate(() => ({
          token: !!localStorage.getItem("token"),
          tipoUsuario: localStorage.getItem("tipoUsuario"),
          usuarioId: !!localStorage.getItem("usuarioId"),
        }));
      },
      { timeout: 10_000 }
    )
    .toMatchObject({
      token: true,
      usuarioId: true,
    });

  await page.context().storageState({
    path: path.join(authDir, config.storageFile),
  });
}

for (const config of configs) {
  setup(`login ${config.role} (salva sessão)`, async ({ page }) => {
    await loginAndSaveState(page, config);
  });
}