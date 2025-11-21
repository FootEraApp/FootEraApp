// cypress/e2e/01_posts_dms.cy.js
describe("Cenário 1 — Posts e DMs", () => {
  it("cria um post e visualiza no feed", () => {
    cy.loginUi("atletaFree");

    const textoPost = `Post de teste automatizado (E2E) ${Date.now()}`;

    // vamos espiar criação e carregamento do feed
    cy.intercept("POST", /\/api\/feed\/post(\/)?$/).as("createPost");
    // ou, se quiser em string mesmo:
    cy.intercept("POST", "**/api/feed/post*").as("createPost");

    cy.visit("/post");

    cy.get('textarea, [data-testid="post-text"]')
    .first()
    .click()
    .type(textoPost);

    // botão de publicar/postar/enviar
    cy.contains("button", /publicar|postar|enviar/i).click();

    // 🔹 espera o POST de criação concluir
    cy.wait("@createPost")
    .its("response.statusCode")
    .should("be.oneOf", [200, 201]);

    // só depois vai para o feed
    cy.visit("/feed");
    cy.wait("@getFeed");

    // clica na aba "Meus" e espera novo carregamento do feed
    cy.contains("button", "Meus").click();
    cy.wait("@getFeed");

    const textoRegex = new RegExp(
      textoPost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

    cy.contains(textoRegex, { timeout: 20000 }).should("be.visible");
  });

   it("envia uma DM para outro usuário", () => {
  cy.loginUi("atletaFree");

  cy.intercept("GET", "**/api/mensagem/conversas").as("getConversas");
  cy.intercept("GET", "**/api/seguidores/mutuos").as("getMutuos");

  cy.visit("/mensagens");

  cy.wait("@getConversas");
  cy.wait("@getMutuos");

  // em mobile o botão de conversas aparece (md:hidden)
  cy.get("button[title='Conversas']").then(($btn) => {
    if ($btn.is(":visible")) {
      cy.wrap($btn).click();
    }
  });

  // 👉 quebra a cadeia aqui
  cy.get('[data-testid="usuario-list-item"]:visible', { timeout: 20000 })
    .should("have.length.greaterThan", 0);

  cy.get('[data-testid="usuario-list-item"]:visible')
    .first()
    .click();

  const msg = `Mensagem E2E ${Date.now()}`;

  cy.get('[data-testid="chat-input"]').type(msg);
  cy.get('button[title="Enviar"]').click();
  cy.contains(msg).should("be.visible");
});
});