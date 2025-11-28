/// <reference types="cypress" />

// 08_olheiro_pro.cy.js

describe("Cenário 8 — Olheiro Pro", () => {
  it("olheiro Pro usa filtros avançados na aba Atletas e vê detalhes de desempenho", () => {
    cy.loginUi("olheiroPro");

    // abre /explorar
    cy.visit("/explorar");

    // garante que carregou a página
    cy.contains(/^Explorar$/i).should("be.visible");
    cy.get('[data-testid="explorar-search"]').should("be.visible");

    // garante que está na aba Atletas
    cy.contains(/^Atletas$/i).click();

    // clica no botão de filtros:
    // - mobile: button[aria-label="Abrir filtros"]
    // - desktop: button[title="Filtros"]
    cy.get('button[aria-label="Abrir filtros"], button[title="Filtros"]')
      .first()
      .click({ force: true });

    // garante que o painel de filtros abriu:
    cy.contains(/^Filtros$/i).should("be.visible");
    cy.contains(/Categoria/i).should("be.visible");
    cy.contains(/Posição/i).should("be.visible");
    cy.contains(/Vínculo do Atleta/i).should("be.visible");
    cy.contains(/Pontuação/i).should("be.visible");

    // botão de aplicar filtros
    cy.contains(/^Aplicar$/i).should("exist").click({ force: true });

    // depois de aplicar filtros, os blocos de desempenho continuam visíveis
    cy.contains(/Atletas em Destaque/i).should("be.visible");
    cy.contains(/Top da semana/i).should("be.visible");
    cy.contains(/Líderes por categoria/i).should("be.visible");
  });
});
