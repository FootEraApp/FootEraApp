import { test, expect } from "@playwright/test";

test.describe("FootEra - admin logado", () => {
  test("abre /admin logado", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("body")).toContainText(
      /Admin|Dashboard|Usuários|Metodologias|FootEra/i
    );
  });

  test("admin consegue acessar criação de professor", async ({ page }) => {
    await page.goto("/admin/professores/create", {
      waitUntil: "domcontentloaded",
    });

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).toContainText(
      /Professor|Criar|Cadastro|Admin/i
    );
  });
});