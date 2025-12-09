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

Cypress.Commands.add("loginUi", (userKey) => {
  cy.session(userKey, () => {
    cy.visit("/login");
    cy.get("[data-test=email]").type(Cypress.env(`${userKey}_email`));
    cy.get("[data-test=senha]").type(Cypress.env(`${userKey}_senha`));
    cy.get("[data-test=login-btn]").click();

    cy.window().then((win) => {
      const token =
        win.localStorage.getItem("token") ||
        win.sessionStorage.getItem("token");

      console.log("TOKEN APÓS LOGIN:", token);
      expect(token, "token após login").to.be.a("string");
    });
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