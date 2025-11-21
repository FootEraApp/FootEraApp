describe("Cenário 5 — Professor Free", () => {
  it("professor Free tem limitações de criação ou volume", () => {
    cy.loginUi("professorFree");

    cy.visit("/treinos");
    cy.contains(/novo treino/i).click();

    cy.contains(/plano pro|atualize seu plano|limite atingido/i).should("be.visible");
  });
});
