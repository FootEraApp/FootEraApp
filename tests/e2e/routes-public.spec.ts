import { test, expect } from "@playwright/test";

test.describe("FootEra - rotas públicas e proteção inicial", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("API health responde ok", async ({ request }) => {
    const response = await request.get(
      "http://localhost:3001/api/health"
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toEqual({ ok: true });
  });

  test(
    "rota inicial / redireciona para login sem token",
    async ({ page }) => {
      await page.goto("/", {
        waitUntil: "domcontentloaded",
      });

      await expect(page).toHaveURL(/\/login/);

      await expect(
        page.locator("body")
      ).toContainText(
        /Entrar|Bem-vindo à FootEra|Usuário ou e-mail/i
      );
    }
  );

  test(
    "feed pode ser acessado sem token",
    async ({ page }) => {
      await page.goto("/feed", {
        waitUntil: "domcontentloaded",
      });

      await expect(page).toHaveURL(/\/feed/);

      await expect(
        page.locator("body")
      ).toContainText(/Feed de Postagens/i);
    }
  );

  const publicRoutes = [
    {
      path: "/login",
      expectedText:
        /Entrar|Bem-vindo à FootEra|Usuário ou e-mail/i,
    },
    {
      path: "/cadastro",
      expectedText:
        /Cadastro|Cadastre|Bem-vindo|FootEra/i,
    },
    {
      path: "/esqueci-senha",
      expectedText:
        /senha|recuperar|e-mail|email/i,
    },
    {
      path: "/termos",
      expectedText:
        /Termos|Privacidade|Política|FootEra/i,
    },
    {
      path: "/admin/login",
      expectedText:
        /Admin|Entrar|Login|senha/i,
    },
    {
      path: "/content-lab",
      expectedText:
        /FootEra|Content|Lab|conteúdo/i,
    },
  ];

  for (const route of publicRoutes) {
    test(
      `abre rota pública ${route.path}`,
      async ({ page }) => {
        await page.goto(route.path, {
          waitUntil: "domcontentloaded",
        });

        await expect(page).toHaveURL(
          new RegExp(
            `${route.path.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )}(?:[/?#]|$)`
          )
        );

        await expect(
          page.locator("body")
        ).toContainText(route.expectedText);
      }
    );
  }

  const privateRoutes = [
    "/perfil",
    "/treinos",
    "/learning",
    "/creator/dashboard",
    "/creator/profile",
    "/creator/eventos",
    "/pagamentos",
  ];

  for (const route of privateRoutes) {
    test(
      `rota privada ${route} redireciona para login sem token`,
      async ({ page }) => {
        await page.goto(route, {
          waitUntil: "domcontentloaded",
        });

        await expect(page).toHaveURL(/\/login/);

        await expect(
          page.locator("body")
        ).toContainText(
          /Entrar|Usuário ou e-mail/i
        );
      }
    );
  }

  test(
    "rota inexistente mostra página não encontrada",
    async ({ page }) => {
      await page.goto(
        "/rota-que-nao-existe-footera-teste",
        {
          waitUntil: "domcontentloaded",
        }
      );

      await expect(
        page.locator("body")
      ).toContainText(
        /Página não encontrada/i
      );
    }
  );
});