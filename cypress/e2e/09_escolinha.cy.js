/// <reference types="cypress" />

// 09_escolinha.cy.js

describe("Cenário 9 — Escolinha", () => {
  it("escolinha cria evento/treino para elenco", () => {
    cy.loginUi("escolinha");

    cy.visit("/eventos/clubes/123/novo");

    // garante que carregou a página de criação
    cy.contains(/novo evento \/ peneira/i).should("be.visible");

    // preenche título pegando o input logo abaixo do label "Título"
    cy.contains("label", /^t[ií]tulo\*/i)
      .parent()
      .find("input")
      .clear()
      .type("Evento E2E Escolinha");

    // preenche o início pegando o input logo abaixo do label "Início"
    cy.contains("label", /in[ií]cio\*/i)
      .parent()
      .find('input[type="datetime-local"]')
      .type("2030-01-10T10:00");

    // opcional: interceptar o alert de sucesso
    cy.on("window:alert", (msg) => {
      expect(msg).to.match(/evento criado com sucesso/i);
    });

    // clica em salvar
    cy.contains("button", /salvar/i).click();

    // depois de salvar, você continua checando se o título aparece
    // (na página de listagem /eventos/clubes/123)
    cy.contains(/Evento E2E Escolinha/i).should("be.visible");
  });
});
