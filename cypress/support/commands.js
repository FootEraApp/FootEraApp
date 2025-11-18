// cypress/support/commands.js

// Exemplo de objeto de usuários para testes (preencha com os logins reais do staging)
const TEST_USERS = {
  atletaFree: {
    email: "atleta.free@staging.footera.app.br",
    senha: "senha123",
  },
  atletaPro: {
    email: "atleta.pro@staging.footera.app.br",
    senha: "senha123",
  },
  professorFree: {
    email: "prof.free@staging.footera.app.br",
    senha: "senha123",
  },
  professorPro: {
    email: "prof.pro@staging.footera.app.br",
    senha: "senha123",
  },
  olheiroFree: {
    email: "scout.free@staging.footera.app.br",
    senha: "senha123",
  },
  olheiroPro: {
    email: "scout.pro@staging.footera.app.br",
    senha: "senha123",
  },
  escolinha: {
    email: "escolinha@staging.footera.app.br",
    senha: "senha123",
  },
};

Cypress.Commands.add("loginUi", (tipoUsuarioKey) => {
  const user = TEST_USERS[tipoUsuarioKey];
  if (!user) throw new Error(`Usuário de teste não configurado: ${tipoUsuarioKey}`);

  cy.visit("/login");

  // 🔧 AJUSTE OS SELECTORS ABAIXO CONFORME SUA TELA DE LOGIN
  cy.get('input[name="email"]').type(user.email);
  cy.get('input[name="senha"], input[type="password"]').type(user.senha);
  cy.get('button[type="submit"], button[data-testid="btn-login"]').click();

  // Espera cair na home/feed (ajuste a rota final se for diferente)
  cy.url().should("include", "/feed");
});

// helper pra forçar token no localStorage se você preferir logar via API
Cypress.Commands.add("setToken", (token) => {
  window.localStorage.setItem("token", token);
});

// Exemplo de login por API (AJUSTE a URL e o body da request)
Cypress.Commands.add("loginApi", (tipoUsuarioKey) => {
  const user = TEST_USERS[tipoUsuarioKey];
  if (!user) throw new Error(`Usuário de teste não configurado: ${tipoUsuarioKey}`);

  // 🔧 AJUSTE A ROTA DO LOGIN DA SUA API
  const apiBase = Cypress.env("API_BASE_URL") || "http://localhost:3001";
  cy.request("POST", `${apiBase}/api/login`, {
    email: user.email,
    senha: user.senha,
  }).then((res) => {
    const token = res.body?.token || res.body?.accessToken;
    if (!token) throw new Error("Token não retornado na resposta do login.");
    window.localStorage.setItem("token", token);
  });
});

Cypress.Commands.add("logoutUi", () => {
  // Se tiver botão de sair fixo, você pode clicar nele aqui
  cy.visit("/configuracoes");
  cy.contains("button", /sair/i).click();
});