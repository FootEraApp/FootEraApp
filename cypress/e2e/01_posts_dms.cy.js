describe("Cenário 1 — Posts e DMs", () => {
  it("cria um post e outro usuário visualiza no feed", () => {
    cy.loginUi("atletaPro");

    cy.visit("/feed");

    cy.get('[data-testid="novo-post"], textarea, [name="conteudoPost"]').first().click();
    cy.get('textarea, [data-testid="post-text"]').type("Post de teste automatizado (E2E).");
    cy.contains("button", /publicar|postar|enviar/i).click();

    cy.contains(/Post de teste automatizado \(E2E\)/i).should("be.visible");
  });

  it("envia uma DM para outro usuário", () => {
    cy.loginUi("atletaPro");

    cy.visit("/mensagens");

    cy.contains(/nova conversa|novo chat|nova mensagem/i).click();
    cy.get('input[placeholder*="Buscar"], input[placeholder*="usuário"]').type("atleta.free");
    cy.contains(/atleta\.free/i).click();

    const msg = `Mensagem E2E ${Date.now()}`;
    cy.get('textarea, [data-testid="chat-input"]').type(msg);
    cy.contains("button", /enviar|mandar/i).click();

    cy.contains(msg).should("be.visible");
  });
});
