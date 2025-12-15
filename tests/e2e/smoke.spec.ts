import { test, expect } from "@playwright/test";

test("abre a home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:5173/);
});
