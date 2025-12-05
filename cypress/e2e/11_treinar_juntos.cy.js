const ATLETA_FREE_USUARIO_ID = "6afca748-dbff-47ed-9219-8e44bde8a9b7";

describe("Botão Treinar Juntos no profile", () => {
  const baseUrl = Cypress.env("API_BASE_URL") || "http://localhost:3001";

  function getAuthFromWindow() {
    return cy.window().then((win) => {
      const token =
        win.localStorage.getItem("token") ||
        win.sessionStorage.getItem("token");

      const tipoUsuarioId =
        (win.Storage &&
          (win.Storage.tipoUsuarioId || win.Storage.professorId)) ||
        win.localStorage.getItem("tipoUsuarioId") ||
        win.sessionStorage.getItem("tipoUsuarioId");

      expect(token, "token deve existir").to.be.a("string");
      expect(tipoUsuarioId, "tipoUsuarioId deve existir").to.be.a("string");

      return { token, tipoUsuarioId };
    });
  }

  beforeEach(() => {
    cy.loginUi("professorFree");
    getAuthFromWindow(); // garante token/tipoUsuarioId
  });

  it("mostra 'Já treino junto' quando há vínculo ativo (professor com atleta vinculado)", () => {
    cy.visit(`/perfil/${ATLETA_FREE_USUARIO_ID}`);

    // debug opcional
    cy.get("button").then(($btns) => {
      const textos = [...$btns].map((b) => b.innerText);
      // eslint-disable-next-line no-console
      console.log("Botoes na tela:", textos);
    });

    cy.contains("button", /j[aá] treino junto/i, { timeout: 20000 }).should(
      "be.visible"
    );
  });

  it("vincula e depois desvincula, tirando da lista de vinculados e registrando no histórico", () => {
    cy.visit(`/perfil/${ATLETA_FREE_USUARIO_ID}`);

    // 1) Se estiver em 'Treinar juntos', cria o vínculo
    cy.contains("button", /treinar juntos|j[aá] treino junto|desvinculado/i, {
      timeout: 20000,
    })
      .should("be.visible")
      .then(($btn) => {
        const texto = ($btn.text() || "").toLowerCase();

        if (texto.includes("treinar juntos")) {
          cy.wrap($btn).click();
          cy.contains("button", /j[aá] treino junto/i, {
            timeout: 20000,
          }).should("be.visible");
        }
      });

    // 2) Usa token + tipoUsuarioId pra falar com a API
    getAuthFromWindow().then(({ token, tipoUsuarioId }) => {
      // 2a) Confere que atleta_free está na lista de vinculados ANTES de desvincular
      cy.request({
        method: "GET",
        url: `${baseUrl}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(
          tipoUsuarioId
        )}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => {
        expect(res.status).to.eq(200);
        const lista = Array.isArray(res.body) ? res.body : [];

        const temAtleta = lista.some(
          (a) =>
            (a.usuario && a.usuario.nomeDeUsuario === "atleta_free") ||
            a.nomeDeUsuario === "atleta_free"
        );

        expect(
          temAtleta,
          "atleta_free deve estar vinculado antes de desvincular"
        ).to.be.true;
      });

      // 3) Desvincula pela UI
      cy.contains("button", /j[aá] treino junto/i, {
        timeout: 20000,
      }).click();
      cy.contains(/sim/i).click();

      // 4) Botão vira 'Desvinculado'
      cy.contains("button", /desvinculado/i, {
        timeout: 20000,
      }).should("be.visible");

      // 5) Confere que saiu da lista de vinculados
      cy.request({
        method: "GET",
        url: `${baseUrl}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(
          tipoUsuarioId
        )}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((res2) => {
        expect(res2.status).to.eq(200);
        const lista2 = Array.isArray(res2.body) ? res2.body : [];

        const aindaTem = lista2.some(
          (a) =>
            (a.usuario && a.usuario.nomeDeUsuario === "atleta_free") ||
            a.nomeDeUsuario === "atleta_free"
        );

        expect(
          aindaTem,
          "atleta_free não deve mais estar na lista de vinculados"
        ).to.be.false;
      });

      // 6) Confere que entrou um registro no histórico de atletas do professor
      cy.request({
        method: "GET",
        url: `${baseUrl}/api/professores/${encodeURIComponent(
          tipoUsuarioId
        )}/historico-atletas?atletaNomeUsuario=atleta_free`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        failOnStatusCode: false,
      }).then((res3) => {
        expect(
          [200, 304],
          "Rota de histórico deve responder com sucesso"
        ).to.include(res3.status);

        const historico = Array.isArray(res3.body) ? res3.body : [];

        const registro = historico.find((h) => {
          const nomeUser =
            (h.atleta &&
              h.atleta.usuario &&
              h.atleta.usuario.nomeDeUsuario) ||
            h.atletaNomeUsuario ||
            "";
          return nomeUser === "atleta_free";
        });

        expect(
          registro,
          "deve existir registro no histórico para atleta_free após o desvínculo"
        ).to.exist;

        const dataFim =
          registro.dataFim ||
          registro.encerradoEm ||
          registro.fimVinculo ||
          null;

        expect(
          dataFim,
          "registro histórico deve ter data de fim / encerramento preenchida"
        ).to.exist;
      });
    });
  });
});