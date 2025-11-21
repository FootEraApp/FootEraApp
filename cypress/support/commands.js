const TEST_USERS = {
  atletaFree: {
    nomeDeUsuario: "atleta_free", 
    senha: "senha123",
  },
  atletaPro: {
    nomeDeUsuario: "atleta_pro",
    senha: "senha123",
  },
  professorFree: {
    nomeDeUsuario: "prof_free",
    senha: "senha123",
  },
  professorPro: {
    nomeDeUsuario: "prof_pro",
    senha: "senha123",
  },
  olheiroFree: {
    nomeDeUsuario: "scout_free",
    senha: "senha123",
  },
  olheiroPro: {
    nomeDeUsuario: "scout_pro",
    senha: "senha123",
  },
  escolinha: {
    nomeDeUsuario: "escolinha_01",
    senha: "senha123",
  },
};

Cypress.Commands.add("loginUi", (tipoUsuarioKey) => {
  const user = TEST_USERS[tipoUsuarioKey];
  if (!user) throw new Error(`Usuário de teste não configurado: ${tipoUsuarioKey}`);

  cy.visit("/login", {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    },
    timeout: 120000,
  });

  cy.url().should("include", "/login");

  cy.get('input[name="nomeDeUsuario"]').should("be.visible");
  cy.get('input[name="senha"], input[type="password"]').should("be.visible");

  cy.get('input[name="nomeDeUsuario"]').first().type(user.nomeDeUsuario);
  cy.get('input[name="senha"], input[type="password"], input[placeholder*="senha" i]')
    .first()
    .type(user.senha);

    cy.get('button[type="submit"], button[data-testid="btn-login"]')
        .first()
        .click();

    cy.url({ timeout: 60000 }).should((url) => {
        expect(url).to.not.match(/\/login\/?$/);
    });

});

Cypress.Commands.add("setToken", (token) => {
  window.localStorage.setItem("token", token);
});

Cypress.Commands.add("loginApi", (tipoUsuarioKey) => {
  const user = TEST_USERS[tipoUsuarioKey];
  if (!user) throw new Error(`Usuário de teste não configurado: ${tipoUsuarioKey}`);

  const apiBase = Cypress.env("API_BASE_URL") || "http://localhost:3001";

  cy.request("POST", `${apiBase}/api/auth/login`, {
    nomeDeUsuario: user.nomeDeUsuario,
    senha: user.senha,
  }).then((res) => {
    const token = res.body?.token || res.body?.accessToken;
    if (!token) throw new Error("Token não retornado na resposta do login.");
    window.localStorage.setItem("token", token);
  });
});


Cypress.Commands.add("logoutUi", () => {
  cy.visit("/configuracoes");
  cy.contains("button", /sair/i).click();
});