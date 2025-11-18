// 05_professor_free.cy.js
describe("Cenário 5 — Professor Free", () => {
  it("professor Free tem limitações de criação ou volume", () => {
    cy.loginUi("professorFree");

    cy.visit("/treinos");
    // Tenta criar algo que pode estar limitado
    cy.contains(/novo treino/i).click();

    // Exemplo: aparece banner de upgrade ou limite
    cy.contains(/plano pro|atualize seu plano|limite atingido/i).should("be.visible");
  });
});
