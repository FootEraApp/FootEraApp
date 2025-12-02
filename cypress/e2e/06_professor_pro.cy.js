describe("Cenário 6 — Professor Pro", () => {
  it("professor Pro cria treino completo pelo fluxo NovoTreino", () => {
    cy.loginUi("professorPro");

    cy.visit("/treinos");

    cy.contains("button", /meus treinos/i, { timeout: 20000 }).click();

    cy.contains(/criar novo treino/i, { timeout: 20000 })
      .should("be.visible")
      .click();

    cy.url({ timeout: 20000 }).should((url) => {
      expect(
        url.includes("/treinos/novo") || url.includes("/novoTreino")
      ).to.be.true;
    });

    cy.contains(/informações básicas/i, { timeout: 20000 }).should("be.visible");

    cy.get('input[placeholder="Título do Treino"]')
      .clear()
      .type("Treino E2E Pro");

    cy.get('textarea[placeholder="Descrição do Treino"]')
      .clear()
      .type("Treino de teste E2E para Professor Pro.");

    cy.contains("button", /próximo/i).click();

    cy.contains(/exercícios selecionados/i, { timeout: 20000 }).should(
      "be.visible"
    );
    cy.contains(/exercícios disponíveis/i).should("be.visible");

    cy.contains("button", /^Adicionar$/i)
      .first()
      .click();

    cy.contains("button", /próximo/i).click();

    cy.contains(/dicas para os atletas/i, { timeout: 20000 }).should(
      "be.visible"
    );

    cy.get('input[placeholder="Ex: Mantenha a postura correta"]')
      .clear()
      .type("Lembre-se de controlar a respiração durante todo o treino.");

    cy.contains("button", /\+ adicionar/i).click();

    cy.contains("button", /próximo/i).click();

    cy.contains(/selecionar atletas vinculados/i, { timeout: 20000 }).should(
      "be.visible"
    );

    cy.contains("button", /^15$/).click({ force: true });

    cy.window().then((win) => {
      cy.stub(win, "alert").as("alert");
    });

    cy.contains("button", /salvar treino/i)
      .scrollIntoView()
      .should("be.visible")
      .click();

    cy.get("@alert").should("have.been.called");

    cy.get("@alert")
      .its("firstCall.args.0")
      .should((msg) => {
        expect(String(msg).toLowerCase()).to.include("treino criado");
      });

      cy.visit("/treinos");
      cy.contains("button", /meus treinos/i).click();
      cy.contains(/treino e2e pro/i, { timeout: 20000 }).should("be.visible");
  });
});