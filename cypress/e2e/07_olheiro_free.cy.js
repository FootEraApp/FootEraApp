/// <reference types="cypress" />

describe("Cenário 7 — Olheiro Free", () => {
  it("olheiro Free consegue abrir os filtros avançados na busca de atletas", () => {
    cy.loginUi("olheiroFree");

    cy.visit("/explorar");

    cy.contains(/^Explorar$/i).should("be.visible");
    cy.get('[data-testid="explorar-search"]').should("be.visible");

    cy.get('button[aria-label="Abrir filtros"], button[title="Filtros"]')
      .should("be.visible")
      .first()
      .click();

    cy.contains(/Categoria/i).should("be.visible");
  });

  it("olheiro Free consegue ver profissionais mas não tem filtros na aba Profissionais", () => {
    cy.loginUi("olheiroFree");
    cy.visit("/explorar");

    cy.contains(/Profissionais/i).click();

    cy.contains(/Professores e Olheiros/i).should("be.visible");

    cy.get('button[aria-label="Abrir filtros"], button[title="Filtros"]').should(
      "not.exist"
    );
  });
});
