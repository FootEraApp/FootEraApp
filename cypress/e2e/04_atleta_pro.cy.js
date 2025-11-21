describe("Cenário 4 — Atleta Pro", () => {
  it("atleta Pro consegue acessar features exclusivas", () => {
    cy.loginUi("atletaPro");

    cy.visit("/treinos");
    cy.contains(/agendar novo treino/i).click();

    cy.url().should("include", "/treinos/novo");
  });
});
