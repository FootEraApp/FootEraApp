describe("Cenário 3 — Atleta Free", () => {
  it("atleta Free acessa apenas funcionalidades permitidas", () => {
    cy.loginUi("atletaFree");
    cy.visit("/perfil");

    cy.visit("/treinos");
    cy.contains(/meus treinos/i).should("be.visible");

    cy.visit("/pagamentos");
    cy.contains(/upgrade|pro|assine/i).should("be.visible");
  });
});