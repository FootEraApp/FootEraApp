describe("Cenário 8 — Olheiro Pro", () => {
  it("olheiro Pro usa filtros avançados e vê detalhes de desempenho", () => {
    cy.loginUi("olheiroPro");

    cy.visit("/olheiros/desempenho");
    cy.contains(/desempenho do atleta|estatísticas/i).should("be.visible");

    cy.contains(/filtros/i).click();
    cy.contains(/posição/i).click();
    cy.contains(/atacante/i).click();
    cy.contains(/aplicar/i).click();

    cy.contains(/resultados/i).should("be.visible");
  });
});
