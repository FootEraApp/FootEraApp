import { test, expect } from "@playwright/test";

test.describe("FootEra - creator logado", () => {
  test("abre /creator/dashboard", async ({ page }) => {
    await page.goto("/creator/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/creator\/dashboard/);
    await expect(page.locator("body")).toContainText(
      /Creator|Dashboard|Metodologias|Eventos|FootEra|Learning/i
    );
  });

  test("abre /creator/profile", async ({ page }) => {
    await page.goto("/creator/profile", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/creator\/profile/);
    await expect(page.locator("body")).toContainText(
      /Perfil|Creator|Metodologias|Eventos|FootEra|Seguidores/i
    );
  });

  test("abre /creator/eventos", async ({ page }) => {
    await page.goto("/creator/eventos", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/creator\/eventos/);
    await expect(page.locator("body")).toContainText(
      /Eventos|Aula|Ao vivo|Replay|Creator|FootEra/i
    );
  });
});