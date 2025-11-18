// 10_midia_ads.cy.js
describe("Cenário 10 — Mídia e Ads", () => {
  it("faz upload de mídia em um fluxo real (post ou desafio)", () => {
    cy.loginUi("atletaPro");
    cy.visit("/submissao"); // ou /submissao/desafio, conforme seu fluxo

    // 🔧 precisa ter um input type="file" com algum data-testid ou name previsível
    const fileName = "video_teste_e2e.mp4"; // coloque na pasta cypress/fixtures
    cy.get('input[type="file"]').selectFile(`cypress/fixtures/${fileName}`, { force: true });

    cy.get('textarea, [name="observacao"]').type("Submissão E2E com vídeo.");
    cy.contains(/enviar/i).click();

    cy.contains(/enviado com sucesso|submissão registrada/i).should("be.visible");
  });

  it("exibe algum banner de ads/upsell em telas específicas", () => {
    cy.loginUi("atletaFree");
    cy.visit("/pagamentos"); // ou outra tela onde aparece upsell/ads

    cy.contains(/plano pro|assine|benefícios/i).should("be.visible");
  });
});