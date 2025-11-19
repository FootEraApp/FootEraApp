describe("Cenário 1 — Posts e DMs", () => {
  it("cria um post e visualiza no feed", () => {
    cy.loginUi("atletaFree");

    const textoPost = `Post de teste automatizado (E2E) ${Date.now()}`;

    cy.visit("/post");

    cy.get('textarea, [data-testid="post-text"]').first().click().type(textoPost);
    cy.contains("button", /publicar|postar|enviar/i).click();

    cy.visit("/feed");
    cy.contains(new RegExp(textoPost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).should(
      "be.visible"
    );
  });

  it("envia uma DM para outro usuário", () => {
    cy.loginUi("atletaFree");

    cy.visit("/mensagens");

    cy.get('[data-testid="usuario-list-item"]').first().click();

    const msg = `Mensagem E2E ${Date.now()}`;

    cy.get('[data-testid="chat-input"]').type(msg);

    cy.contains("button", /enviar|mandar/i).click();

    cy.contains(msg).should("be.visible");
  });
});