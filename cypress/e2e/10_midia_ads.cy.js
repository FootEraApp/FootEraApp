/// <reference types="cypress" />

// 10_midia_e_ads.cy.js

describe("Cenário 10 — Mídia e Ads", () => {
  it("faz upload de mídia em um fluxo real (post ou desafio)", () => {
    cy.loginUi("atletaPro");

    // abre a tela de submissão
    cy.visit("/submissao");

    // garante que carregou (título ou alguma frase da página)
    cy.contains(/submiss[aã]o/i).should("be.visible");

    const fileName = "video_teste_e2e.mp4";

    // input de arquivo (qualquer file input da tela)
    cy.get('input[type="file"]')
      .first()
      .selectFile(`cypress/fixtures/${fileName}`, { force: true });

    // campo de observação/comentário
    cy.get('textarea, [name="observacao"]')
      .first()
      .type("Submissão E2E com vídeo.");

    // botão de envio (Enviar, Enviar submissão, etc.)
    cy.contains("button, [role='button']", /enviar|submeter/i)
      .first()
      .click();

    // feedback de sucesso (toast, mensagem na tela, etc.)
    cy.contains(/enviado com sucesso|submiss[aã]o registrada|salva com sucesso/i)
      .should("be.visible");
  });

  it("exibe algum banner de ads/upsell em telas específicas", () => {
    cy.loginUi("atletaFree");

    // tela de planos/pagamentos
    cy.visit("/pagamentos");

    // qualquer texto de upsell / plano Pro
    cy.contains(/plano pro|assine|benef[ií]cios|upgrade/i).should("be.visible");
  });
});
