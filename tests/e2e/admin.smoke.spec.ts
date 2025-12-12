import { test, expect } from "@playwright/test";

test("abre /admin logado", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/);
});
