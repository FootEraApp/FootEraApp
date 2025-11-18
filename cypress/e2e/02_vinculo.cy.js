// 02_vinculo.cy.js
describe("Cenário 2 — Vínculo de atleta com clube/escolinha/professor", () => {
  it("atleta solicita vínculo e escolinha aprova", () => {
    // 1) atleta Free entra e pede vínculo
    cy.loginUi("atletaFree");
    cy.visit("/perfil");

    // 🔧 selector do botão "Pedir vínculo"
    cy.contains(/vínculo|vincular|conectar escolinha|clube/i).click();
    cy.get('input[placeholder*="buscar"], input[placeholder*="escolinha"]').type("Escolinha Teste");
    cy.contains(/Escolinha Teste/i).click();
    cy.contains("button", /enviar pedido|solicitar/i).click();

    cy.contains(/pedido enviado/i).should("be.visible");

    // 2) escolinha aprova
    cy.logoutUi();
    cy.loginUi("escolinha");
    cy.visit("/perfil/GerenciarAtletas");

    cy.contains(/Solicitações de vínculo/i).click();
    cy.contains(/atleta\.free/i)
      .parents("tr, li, div")
      .within(() => {
        cy.contains(/aceitar|aprovar/i).click();
      });

    cy.contains(/vínculo aprovado|vínculo ativo/i).should("be.visible");
  });
});