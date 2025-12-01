describe("Cenário 5 — Professor Free", () => {
  it("professor Free acessa a tela de criação de treino", () => {
    cy.loginUi("professorFree");

    cy.visit("/treinos");

    cy.contains("button", /meus treinos/i).click();

    cy.contains(/criar novo treino/i, { timeout: 20000 })
      .should("be.visible")
      .click();

    cy.contains(/informações básicas/i, { timeout: 20000 }).should("be.visible");

    cy.get('input[placeholder="Título do Treino"]')
      .clear()
      .type("Treino Cypress Free");

    cy.get('textarea[placeholder="Descrição do Treino"]')
      .clear()
      .type("Descrição do treino para teste do professor Free.");

    cy.contains("button", /próximo/i).click();

    cy.contains(/exercícios selecionados/i, { timeout: 20000 }).should("be.visible");
    cy.contains(/exercícios disponíveis/i).should("be.visible");

    cy.contains("button", /^Adicionar$/i)
      .first()
      .click();

    cy.contains("button", /próximo/i).click();

    cy.contains(/dicas para os atletas/i, { timeout: 20000 }).should("be.visible");

    cy.contains("button", /próximo/i).click();

    cy.contains(/selecionar atletas vinculados/i, { timeout: 20000 }).should(
      "be.visible"
    );

    cy.contains("button", /salvar treino/i)
      .scrollIntoView()
      .should("be.visible");
  });
});