// 03_atleta_free.cy.js
describe("Cenário 3 — Atleta Free", () => {
  it("atleta Free acessa apenas funcionalidades permitidas", () => {
    cy.loginUi("atletaFree");
    cy.visit("/perfil");

    // Pode ver treino, desafios básicos, etc. (ajuste conforme seu escopo)
    cy.visit("/treinos");
    cy.contains(/meus treinos/i).should("be.visible");

    // Exemplo: tentar acessar algo Pro e esperar bloqueio
    cy.visit("/pagamentos"); // ou uma rota Pro-only
    cy.contains(/upgrade|pro|assine/i).should("be.visible");
  });
});