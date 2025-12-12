import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const authDir = path.join(process.cwd(), "tests", "e2e", ".auth");
const adminState = path.join(authDir, "admin.json");

setup("login admin (salva sessão)", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  // evita o auto-redirect do useEffect do login
  await page.addInitScript(() => {
    // @ts-ignore
    window.Cypress = true;
  });

  const user = process.env.E2E_ADMIN_USER!;
  const pass = process.env.E2E_ADMIN_PASS!;

  await page.goto("/login");

  await page.fill('input[name="nomeDeUsuario"]', user);
  await page.fill('input[name="senha"]', pass);

  await page.getByRole("button", { name: "Entrar" }).click();

  // como admin, seu login manda pra /admin
  await expect(page).toHaveURL(/\/admin/);

  await page.context().storageState({ path: adminState });
});
