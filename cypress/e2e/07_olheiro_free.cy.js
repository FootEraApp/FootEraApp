// 07_olheiro_free.cy.js
describe("Cenário 7 — Olheiro Free", () => {
  it("olheiro Free tem limitações em filtros ou detalhes", () => {
    cy.loginUi("olheiroFree");

    cy.visit("/olheiros");
    cy.contains(/buscar atletas|explorar atletas/i).should("be.visible");

    // tentar usar filtro avançado que só Pro pode
    cy.contains(/filtros avançados|mais filtros/i).click();
    cy.contains(/disponível no plano pro|atualize/i).should("be.visible");
  });
});
