// 06_professor_pro.cy.js
describe("Cenário 6 — Professor Pro", () => {
  it("professor Pro cria treino completo e agenda para atletas", () => {
    cy.loginUi("professorPro");

    cy.visit("/treinos");
    cy.contains(/novo treino/i).click();
    cy.url().should("include", "/treinos/novo");

    // 🔧 Preencha o mínimo do fluxo (Etapa 1–4) com selectors reais
    cy.get('input[name="titulo"], input[name="nome"]').type("Treino E2E Pro");
    cy.contains(/próximo/i).click();

    // etc... (Etapa 2, 3, 4)
    // No final:
    cy.contains(/salvar treino|concluir/i).click();
    cy.contains(/Treino E2E Pro/i).should("be.visible"); // no admin ou na lista
  });
});
