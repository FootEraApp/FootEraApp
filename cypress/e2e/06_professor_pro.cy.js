// cypress/e2e/06_professor_pro.cy.js

describe("Cenário 6 — Professor Pro", () => {
  it("professor Pro cria treino completo pelo fluxo NovoTreino", () => {
    // login helper já existente
    cy.loginUi("professorPro");

    // abre a página de treinos
    cy.visit("/treinos");

    // garante que está na aba "Meus Treinos"
    cy.contains("button", /meus treinos/i, { timeout: 20000 }).click();

    // abre o fluxo de criação (botão "Criar novo treino")
    cy.contains(/criar novo treino/i, { timeout: 20000 })
      .should("be.visible")
      .click();

    // aceita /treinos/novo OU /novoTreino
    cy.url({ timeout: 20000 }).should((url) => {
      expect(
        url.includes("/treinos/novo") || url.includes("/novoTreino")
      ).to.be.true;
    });

    // ===== ETAPA 1 – Informações Básicas =====
    cy.contains(/informações básicas/i, { timeout: 20000 }).should("be.visible");

    cy.get('input[placeholder="Título do Treino"]')
      .clear()
      .type("Treino E2E Pro");

    cy.get('textarea[placeholder="Descrição do Treino"]')
      .clear()
      .type("Treino de teste E2E para Professor Pro.");

    cy.contains("button", /próximo/i).click();

    // ===== ETAPA 2 – Exercícios =====
    cy.contains(/exercícios selecionados/i, { timeout: 20000 }).should(
      "be.visible"
    );
    cy.contains(/exercícios disponíveis/i).should("be.visible");

    // adiciona o primeiro exercício da lista
    cy.contains("button", /^Adicionar$/i)
      .first()
      .click();

    cy.contains("button", /próximo/i).click();

    // ===== ETAPA 3 – Dicas =====
    cy.contains(/dicas para os atletas/i, { timeout: 20000 }).should(
      "be.visible"
    );

    cy.get('input[placeholder="Ex: Mantenha a postura correta"]')
      .clear()
      .type("Lembre-se de controlar a respiração durante todo o treino.");

    cy.contains("button", /\+ adicionar/i).click();

    cy.contains("button", /próximo/i).click();

    // ===== ETAPA 4 – Atletas & Agendamento =====
    cy.contains(/selecionar atletas vinculados/i, { timeout: 20000 }).should(
      "be.visible"
    );

    // marca um dia qualquer no calendário para criar datas de agendamento
    // (15 funciona em qualquer mês)
    cy.contains("button", /^15$/).click({ force: true });

    // stub do alert ANTES de clicar em "Salvar Treino"
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alert");
    });

    // salva o treino
    cy.contains("button", /salvar treino/i)
      .scrollIntoView()
      .should("be.visible")
      .click();

    // ===== VERIFICAÇÕES =====
    // garante que algum alerta foi disparado
    cy.get("@alert").should("have.been.called");

    // confere que a mensagem fala que o treino foi criado
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