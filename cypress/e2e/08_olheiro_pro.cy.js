/// <reference types="cypress" />

describe("Cenário 8 — Olheiro Pro", () => {
  it("olheiro Pro usa filtros avançados na aba Atletas e vê detalhes de desempenho", () => {
    cy.loginUi("olheiroPro");

    cy.visit("/explorar");

    cy.contains(/^Explorar$/i).should("be.visible");
    cy.get('[data-testid="explorar-search"]').should("be.visible");

    cy.contains(/^Atletas$/i).click();

    cy.get('button[aria-label="Abrir filtros"], button[title="Filtros"]')
      .first()
      .click({ force: true });

    cy.contains(/^Filtros$/i).should("be.visible");
    cy.contains(/Categoria/i).should("be.visible");
    cy.contains(/Posição/i).should("be.visible");
    cy.contains(/Vínculo do Atleta/i).should("be.visible");
    cy.contains(/Pontuação/i).should("be.visible");

    cy.contains(/^Aplicar$/i).should("exist").click({ force: true });

    cy.contains(/Atletas em Destaque/i).should("be.visible");
    cy.contains(/Top da semana/i).should("be.visible");
    cy.contains(/Líderes por categoria/i).should("be.visible");
  });
});