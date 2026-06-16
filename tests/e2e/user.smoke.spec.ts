import { test, expect } from "@playwright/test";

test.describe("FootEra - usuário logado", () => {
  test("abre /perfil logado", async ({ page }) => {
    await page.goto("/perfil", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/perfil/);
    await expect(page.locator("body")).toContainText(
      /Perfil|FootEra|Editar|Treinos|Conquistas|Seguidores|Publicações/i
    );
  });

  test("abre /feed logado", async ({ page }) => {
    await page.goto("/feed", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/feed/);
    await expect(page.locator("body")).toContainText(
      /Feed|FootEra|Publicar|Post|Explorar|Treinos/i
    );
  });

  test("abre /explorar logado", async ({ page }) => {
    await page.goto("/explorar", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/explorar/);
    await expect(page.locator("body")).toContainText(
      /Explorar|Atletas|Escolas|Clubes|Profissionais|Outros/i
    );
  });

  test("abre /treinos logado", async ({ page }) => {
    await page.goto("/treinos", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/treinos/);
    await expect(page.locator("body")).toContainText(
      /Treinos|FootEra|Exercícios|Atleta|Professor|metodologia/i
    );
  });

  test("abre /learning logado", async ({ page }) => {
    await page.goto("/learning", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/learning/);
    await expect(page.locator("body")).toContainText(
      /Learning|Metodologia|Aulas|Eventos|FootEra|Treinos/i
    );
  });

  test("abre /pagamentos logado", async ({ page }) => {
    await page.goto("/pagamentos", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/pagamentos/);
    await expect(page.locator("body")).toContainText(
      /Pagamento|Pagamentos|Assinatura|Plano|Metodologia|FootEra/i
    );
  });
});