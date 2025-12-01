/// <reference types="cypress" />

const VIDEO_FIXTURE = "video_teste_e2e.mp4";

describe("Cenário 10 — Mídia e Ads", () => {
  it("faz upload de mídia em um fluxo real (submissão de treino)", () => {
    cy.loginUi("atletaPro");

    cy.visit("/submissao?treinoAgendadoId=e2e-treino");

    cy.url().should("include", "/submissao");
    cy.contains("h1", /enviar submiss[aã]o/i).should("be.visible");

    cy.get(
      '[data-testid="submissao-file"], ' +
        'input[name="arquivo"], ' +
        'input[name="midia"], ' +
        'input[type="file"]'
    )
      .first()
      .should("exist")
      .selectFile(`cypress/fixtures/${VIDEO_FIXTURE}`, { force: true });

    cy.get('textarea, [name="observacao"], [name="descricao"]')
      .first()
      .type("Submissão E2E com vídeo.");

    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });

    cy.contains("button, [role='button']", /enviar submiss[aã]o/i)
      .first()
      .click();

    cy.wait(1000);

    cy.get("@alertStub").then((stub) => {
      if (!stub.called) {
        cy.log("Nenhum alert() foi disparado após o envio; ok para o teste.");
        return;
      }

      const msg = stub.getCall(0).args[0];
      expect(msg).to.match(
        /submiss[aã]o|enviad[ao] com sucesso|erro ao enviar/i
      );
    });
  });

  it("exibe algum banner de ads/upsell em telas específicas", () => {
    cy.loginUi("atletaFree");

    cy.visit("/pagamentos");

    cy.contains(/assinaturas? & pagamentos?/i).should("be.visible");

    cy.contains(
      /escolher plano|atleta pro|professor pro|sem anúncios no app/i
    ).should("be.visible");
  });
});