describe("Cenário 9 — Escolinha", () => {
  it("escolinha cria evento/treino para elenco", () => {
    cy.loginUi("escolinha");

    cy.visit("/eventos/clubes/123/novo");
    cy.get('input[name="titulo"], input[name="nome"]').type("Evento E2E Escolinha");
    cy.get('input[name="data"], input[type="date"]').type("2030-01-10");
    cy.contains("button", /salvar|criar/i).click();

    cy.contains(/Evento E2E Escolinha/i).should("be.visible");
  });
});
