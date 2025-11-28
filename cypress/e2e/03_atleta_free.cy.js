// cypress/e2e/03_atleta_free.cy.js

describe("Cenário 3 — Atleta Free", () => {
  it("atleta Free acessa apenas funcionalidades permitidas", () => {
    // 1) login pela API (salva token no localStorage)
    cy.loginApi("atletaFree");

    // 2) garantir que o app saiba que o usuário é atleta
    cy.window().then((win) => {
      // o Treinos usa tipoUsuario (lowercase é aceito pelo map)
      win.localStorage.setItem("tipoUsuario", "atleta");
      // se quiser reforçar, pode limpar qualquer legado:
      win.localStorage.removeItem("usuarioLogado");
    });

    // 3) Perfil abre normalmente logado
    cy.visit("/perfil");
    cy.location("pathname").should("eq", "/perfil");

    // 4) Treinos: atleta free consegue ver seus treinos
    cy.visit("/treinos");
    cy.contains(/meus treinos/i, { timeout: 20000 }).should("be.visible");

    // 5) Pagamentos: deve ver CTA de upgrade / Pro
    cy.visit("/pagamentos");
    cy.contains(/upgrade|pro|assine|seja pro/i, { timeout: 20000 }).should(
      "be.visible"
    );
  });
});
