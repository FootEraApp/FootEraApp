/// <reference types="cypress" />

describe("Cenário 9 — Escolinha", () => {
  it("escolinha cria evento/treino para elenco", () => {
    cy.loginUi("escolinha");

    const tituloEvento = "Evento E2E Escolinha";

    const fakeEvento = {
      id: "evento-fake-e2e",
      titulo: tituloEvento,
      tipo: "PENEIRA",
      status: "ABERTO",
      inicio: "2030-01-10T10:00:00Z",
    };

    cy.intercept("POST", "**/api/eventos/clubes/*", (req) => {
      expect(req.body).to.have.property("titulo", tituloEvento);

      req.reply({
        statusCode: 201,
        body: {
          id: fakeEvento.id,
          ...req.body,
        },
      });
    }).as("criarEvento");

    cy.intercept("GET", "**/api/eventos/clubes/*", {
      statusCode: 200,
      body: [fakeEvento],
    }).as("listarEventos");

    cy.visit("/eventos/clubes/123/novo");

    cy.contains(/novo evento \/ peneira/i).should("be.visible");

    cy.contains("label", /^t[ií]tulo\*/i)
      .parent()
      .find("input")
      .clear()
      .type(tituloEvento);

    cy.contains("label", /in[ií]cio\*/i)
      .parent()
      .find('input[type="datetime-local"]')
      .type("2030-01-10T10:00");

    const alertStub = cy.stub();
    cy.on("window:alert", alertStub);

    cy.contains("button", /salvar/i).click();

    cy.wait("@criarEvento");

    cy.wrap(alertStub).should(
      "have.been.calledWithMatch",
      /evento criado com sucesso/i
    );

    cy.url().should("include", "/eventos/clubes/123");

    cy.wait("@listarEventos");
    cy.contains(tituloEvento).should("be.visible");
  });
});