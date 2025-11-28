// cypress/e2e/05_professor_free.cy.js

describe("Cenário 5 — Professor Free", () => {
  it("professor Free acessa a tela de criação de treino", () => {
    // login helper já existente no projeto
    cy.loginUi("professorFree");

    // vai para a listagem de treinos
    cy.visit("/treinos");

    // garante que está na aba "Meus Treinos" (por segurança)
    cy.contains("button", /meus treinos/i).click();

    // abre o fluxo de criação (botão "Criar novo treino")
    cy.contains(/criar novo treino/i, { timeout: 20000 })
      .should("be.visible")
      .click();

    // ===== ETAPA 1 – Informações Básicas =====
    cy.contains(/informações básicas/i, { timeout: 20000 }).should("be.visible");

    cy.get('input[placeholder="Título do Treino"]')
      .clear()
      .type("Treino Cypress Free");

    cy.get('textarea[placeholder="Descrição do Treino"]')
      .clear()
      .type("Descrição do treino para teste do professor Free.");

    // avança para etapa 2
    cy.contains("button", /próximo/i).click();

    // ===== ETAPA 2 – Exercícios =====
    cy.contains(/exercícios selecionados/i, { timeout: 20000 }).should("be.visible");
    cy.contains(/exercícios disponíveis/i).should("be.visible");

    // adiciona o primeiro exercício da lista disponível
    cy.contains("button", /^Adicionar$/i)
      .first()
      .click();

    // avança para etapa 3
    cy.contains("button", /próximo/i).click();

    // ===== ETAPA 3 – Dicas =====
    cy.contains(/dicas para os atletas/i, { timeout: 20000 }).should("be.visible");

    // (opcional) poderia adicionar uma dica aqui, mas não é necessário para o teste
    // só avançar
    cy.contains("button", /próximo/i).click();

    // ===== ETAPA 4 – Atletas =====
    cy.contains(/selecionar atletas vinculados/i, { timeout: 20000 }).should(
      "be.visible"
    );

    // aqui o foco do cenário é só acessar a tela e chegar até o botão salvar
    // então não precisamos selecionar atletas de fato

    // garante que o botão "Salvar Treino" está renderizado na etapa 4
    cy.contains("button", /salvar treino/i)
      .scrollIntoView()
      .should("be.visible");
  });
});
