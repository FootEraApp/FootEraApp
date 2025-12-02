describe("Cenário 3 — Atleta Free", () => {
  it("atleta Free acessa apenas funcionalidades permitidas", () => {
    cy.loginApi("atletaFree");

    cy.window().then((win) => {
      win.localStorage.setItem("tipoUsuario", "atleta");
      win.localStorage.removeItem("usuarioLogado");
    });

    cy.visit("/perfil");
    cy.location("pathname").should("eq", "/perfil");

    cy.visit("/treinos");
    cy.contains(/meus treinos/i, { timeout: 20000 }).should("be.visible");

    cy.visit("/pagamentos");
    cy.contains(/upgrade|pro|assine|seja pro/i, { timeout: 20000 }).should(
      "be.visible"
    );
  });
});
