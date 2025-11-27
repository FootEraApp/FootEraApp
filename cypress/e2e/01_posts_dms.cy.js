describe("Cenário 1 — Posts e DMs", () => {
  it("cria um post e visualiza no feed", () => {
    cy.loginUi("atletaFree");

    const textoPost = `Post de teste automatizado (E2E) ${Date.now()}`;

    cy.intercept("POST", "**/api/post*").as("createPost");

    cy.intercept("GET", "**/api/feed*").as("getFeed");

    cy.visit("/post");

    cy.get('textarea, [data-testid="post-text"]')
      .first()
      .should("be.visible")
      .click()
      .type(textoPost);

    cy.contains("button", /publicar|postar|enviar/i)
      .should("be.enabled")
      .click();

    cy.wait("@createPost", { timeout: 15000 })
      .its("response.statusCode")
      .should("be.oneOf", [200, 201]);

    cy.visit("/feed");

    cy.wait("@getFeed", { timeout: 15000 });

    cy.contains("button", /Meus/i).click();
    cy.wait("@getFeed", { timeout: 15000 });

    const textoEscapado = textoPost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const textoRegex = new RegExp(textoEscapado, "i");

    cy.contains(textoRegex, { timeout: 20000 }).should("be.visible");
  });

  it("envia uma DM para outro usuário", () => {
    cy.loginUi("atletaFree");

    cy.intercept("GET", "**/api/mensagem/conversas").as("getConversas");
    cy.intercept("GET", "**/api/seguidores/mutuos").as("getMutuos");

    cy.visit("/mensagens");

    cy.wait("@getConversas");
    cy.wait("@getMutuos");

    cy.get("button[title='Conversas']").then(($btn) => {
      if ($btn.is(":visible")) {
        cy.wrap($btn).click();
      }
    });

    cy.get('[data-testid="usuario-list-item"]:visible', { timeout: 20000 })
      .should("have.length.greaterThan", 0)
      .first()
      .click();

    const msg = `Mensagem E2E ${Date.now()}`;

    cy.get('[data-testid="chat-input"]').type(msg);
    cy.get('button[title="Enviar"]').click();
    cy.contains(msg).should("be.visible");
  });
});
