import { test, expect } from "@playwright/test";

test("abre a home", async ({ page }) => {
  await page.goto("/");
  // só valida que carregou alguma coisa (bem smoke mesmo)
  await expect(page).toHaveURL(/localhost:5173/);
});
