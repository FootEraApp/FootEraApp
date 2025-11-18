// 04_atleta_pro.cy.js
describe("Cenário 4 — Atleta Pro", () => {
  it("atleta Pro consegue acessar features exclusivas", () => {
    cy.loginUi("atletaPro");

    // Exemplo: acessar uma feature Pro
    cy.visit("/treinos");
    cy.contains(/agendar novo treino/i).click();

    // Se o Free não puder usar isso, o Pro deve conseguir
    cy.url().should("include", "/treinos/novo");
  });
});
