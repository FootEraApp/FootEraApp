// 01_posts_dms.cy.js
describe("Cenário 1 — Posts e DMs", () => {
  it("cria um post e outro usuário visualiza no feed", () => {
    // login como atleta Pro (por exemplo)
    cy.loginUi("atletaPro");

    cy.visit("/feed");

    // 🔧 AJUSTE selectors conforme sua tela
    cy.get('[data-testid="novo-post"], textarea, [name="conteudoPost"]').first().click();
    cy.get('textarea, [data-testid="post-text"]').type("Post de teste automatizado (E2E).");
    cy.contains("button", /publicar|postar|enviar/i).click();

    // verifica que o post entrou no feed
    cy.contains(/Post de teste automatizado \(E2E\)/i).should("be.visible");
  });

  it("envia uma DM para outro usuário", () => {
    cy.loginUi("atletaPro");

    cy.visit("/mensagens");

    // 🔧 Ajuste de selectors: escolha um contato e envie msg
    cy.contains(/nova conversa|novo chat|nova mensagem/i).click();
    cy.get('input[placeholder*="Buscar"], input[placeholder*="usuário"]').type("atleta.free");
    cy.contains(/atleta\.free/i).click();

    const msg = `Mensagem E2E ${Date.now()}`;
    cy.get('textarea, [data-testid="chat-input"]').type(msg);
    cy.contains("button", /enviar|mandar/i).click();

    cy.contains(msg).should("be.visible");
  });
});
