/// <reference types="cypress" />

// 07_olheiro_free.cy.js
// Cenários para o usuário "olheiroFree" na tela /explorar

describe("Cenário 7 — Olheiro Free", () => {
  it("olheiro Free consegue abrir os filtros avançados na busca de atletas", () => {
    // login como olheiro free
    cy.loginUi("olheiroFree");

    // abre a tela de explorar
    cy.visit("/explorar");

    // garante que está na página certa
    cy.contains(/^Explorar$/i).should("be.visible");
    cy.get('[data-testid="explorar-search"]').should("be.visible");

    // clica no funil de filtros:
    // - no mobile: button[aria-label="Abrir filtros"]
    // - no desktop: button[title="Filtros"] com texto "Filtros"
    cy.get('button[aria-label="Abrir filtros"], button[title="Filtros"]')
      .should("be.visible")
      .first()
      .click();

    // Ao abrir os filtros, o painel de filtros deve aparecer normalmente
    // Ajuste o texto/regex abaixo se no seu bottom sheet o título/label for outro,
    // por exemplo "Filtros", "Filtros avançados" etc.
    cy.contains(/Categoria/i).should("be.visible");
  });

  it("olheiro Free consegue ver profissionais mas não tem filtros na aba Profissionais", () => {
    cy.loginUi("olheiroFree");
    cy.visit("/explorar");

    // muda para a aba 'Profissionais'
    cy.contains(/Profissionais/i).click();

    // título da seção de profissionais
    cy.contains(/Professores e Olheiros/i).should("be.visible");

    // na aba profissionais não deve aparecer o botão de filtros (funil)
    cy.get('button[aria-label="Abrir filtros"], button[title="Filtros"]').should(
      "not.exist"
    );
  });
});
