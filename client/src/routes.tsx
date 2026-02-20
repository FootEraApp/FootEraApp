import { Route, Switch } from "wouter";
import { Private, PublicOnly, HomeRedirect } from "./auth.js";
import RequireAdmin from "./routes/RequireAdmin.js";
import { FLAGS } from "./config.js";

import AdminDashboard from "./pages/admin-page.js";
import AvaliarTreino from "./pages/treino/avaliarTreino.js";
import PaginaLogin from "./pages/login.js";
import PaginaCadastro from "./pages/cadastro.js";
import PaginaFeed from "./pages/feed.js";
import PaginaTreinos from "./pages/treinos.js";
import PaginaCreatePost from "./pages/post/create.js";
import PaginaExplorar from "./pages/explorar.js";
import PaginaCreateDesafios from "./pages/admin/desafios/create.js";
import PaginaCreateExercicios from "./pages/admin/exercicios/create.js";
import PaginaCreateTreinos from "./pages/admin/treinos/create.js";
import PaginaCreateProfessores from "./pages/admin/professores/create.js";
import PaginaLoginAdmin from "./pages/admin/login.js";
import PaginaPerfil from "./pages/perfil.js";
import PaginaNovoTreino from "./pages/novoTreino.js";
import PaginaPostUnico from "./pages/postUnico.js";
import PaginaPerfilUnico from "./pages/perfilUnico.js";
import PaginaEditarPerfil from "./pages/editarPerfil.js";
import PaginaConfiguracoesPerfil from "./pages/configuracoesPerfil.js";
import PaginaPontuacaoPerfil from "./pages/pontuacoesPerfil.js";
import PaginaNotificacoes from "./pages/notificacoes.js";
import PaginaSubmissao from "./pages/submissao.js";
import PaginaMensagens from "./pages/mensagens.js";
import PaginaDesafios from "./pages/desafios.js";
import PaginaDesafioUnico from "./pages/desafioUnico.js";
import PaginaSubmissaoDesafioEmGrupo from "./pages/submissaoDesafioEmGrupo.js";
import PaginaEsqueciSenha from "./pages/esqueciSenha.js";
import PaginaResetarSenha from "./pages/resetarSenha.js";
import PaginaTraining from "./pages/trainings.js";
import PaginaMinhaRede from "./pages/minhaRede.js";
import PaginaPontuacaoDePerfil from "./pages/perfilPontuacaoExplorar.js";
import PaginaElenco from "./pages/elenco.js";
import PaginaGerenciarAtleta from "./pages/GerenciarAtletas.js"
import PaginaPerfilOlheiro from "./components/perfil/PerfilOlheiro.js";
import PaginaEventosClube from "./pages/eventosClube.js";
import PaginaNovoEventoClube from "./pages/eventosClubeNovo.js";
import PaginaEventoDetalhe from "./pages/eventoDetalhe.js";
import PaginaEventosEscola from "./pages/eventosEscola.js";
import PaginaNovoEventoEscola from "./pages/eventosEscolaNovo.js";
import PaginaTreinoUnico from "./pages/TreinoUnico.js";
import PaginaTermosEPrivacidade from "./pages/TermosEPrivacidade.js"
import PaginaOlheiros from "./pages/olheiro/index.js";
import PaginaConquistas from "./pages/conquistas.js";
import PaginaFormadores from "./pages/formadores.js";
import PaginaDesempenhoAtleta from "./pages/olheiro/desempenho.js";
import PaginaIndicarClube from "./pages/olheiro/indicar.js";
import PaginaTreinoLivreNovo from "./pages/treinoLivreNovo.js";
import PaginaTreinoLivresHistorico from "./pages/treinoLivreHistorico.js"
import PaginaCreateAdmin from "./pages/createAdmin.js";
import PaginaPagamentos from "./pages/pagamentos/index.js";
import PaginaJogosElenco from "./pages/jogos-elenco.js";
import PaginaGerenciarProfessores from "./pages/GerenciarProfessores.js"
import PaginaConvocarEvento from "./pages/eventos/convocar.js";
import PaginaVerificarEmail from "./pages/verificar-email.js";
import CriarMetodologia from "./pages/metodologias/create.js";
import MinhasMetodologias from "./pages/metodologias/minhas.js";
import MetodologiaUnicaPage from "./pages/metodologias/metodologia-unica.js";
import AvaliarMetodologia from "./pages/metodologias/avaliar.js";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnly><PaginaLogin /></PublicOnly>
      </Route>
      <Route path="/cadastro"><PaginaCadastro /></Route>

      <Route path="/verificar-email" component={PaginaVerificarEmail} />

      <Route path="/termos"><PaginaTermosEPrivacidade /></Route>
      <Route path="/esqueci-senha">
        <PublicOnly><PaginaEsqueciSenha /></PublicOnly>
      </Route>
      <Route path="/resetar-senha">
        <PublicOnly><PaginaResetarSenha /></PublicOnly>
      </Route>

      <Route path="/admin/login"><PaginaLoginAdmin /></Route>
      <Route path="/pagamentos"><PaginaPagamentos /></Route>

      {FLAGS.DESAFIOS_ENABLED ? (
        <Route path="/admin/desafios/create">
          <RequireAdmin><PaginaCreateDesafios /></RequireAdmin>
        </Route>
      ) : (
        <Route path="/admin/desafios/create">
          <RequireAdmin><div style={{ padding: 16 }}>Desafios desativados por enquanto.</div></RequireAdmin>
        </Route>
      )}

      <Route path="/admin/exercicios/create">
        <RequireAdmin><PaginaCreateExercicios /></RequireAdmin>
      </Route>
      <Route path="/admin/treinos/create">
        <PaginaCreateTreinos />
      </Route>
      <Route path="/admin/professores/create">
        <RequireAdmin><PaginaCreateProfessores /></RequireAdmin>
      </Route>
      <Route path="/admin/admins/create" component={PaginaCreateAdmin} />
      <Route path="/admin">
        <RequireAdmin>
          <AdminDashboard />
        </RequireAdmin>
      </Route>

      <Route path="/olheiros/desempenho"><PaginaDesempenhoAtleta /></Route>
      <Route path="/olheiros/indicar"><PaginaIndicarClube /></Route>
      <Route path="/olheiros"><PaginaOlheiros /></Route>

      <Route path="/perfil-olheiro/:id">
        {({ id }: { id: string }) => <PaginaPerfilOlheiro idDaUrl={id} />}
      </Route>

      <Route path="/perfil/conquistas"><PaginaConquistas /></Route>
      <Route path="/perfil/GerenciarAtletas"><PaginaGerenciarAtleta /></Route>
      <Route path="/perfil/GerenciarProfessores"><PaginaGerenciarProfessores /></Route>
      <Route path="/formadores" component={PaginaFormadores} />

      <Route path="/eventos/convocar" component={PaginaConvocarEvento} />

      <Route path="/eventos/clubes/:id/novo">
        {(params?: { id: string }) =>
          params ? <PaginaNovoEventoClube clubeId={params.id} /> : null}
      </Route>
      <Route path="/eventos/clubes/:id">
        {(params?: { id: string }) =>
          params ? <PaginaEventosClube clubeId={params.id} /> : null}
      </Route>

      <Route path="/eventos/escolas/:id/novo">
        {(params?: { id: string }) =>
          params ? <PaginaNovoEventoEscola escolaId={params.id} /> : null}
      </Route>
      <Route path="/eventos/escolas/:id">
        {(params?: { id: string }) =>
          params ? <PaginaEventosEscola escolaId={params.id} /> : null}
      </Route>

      <Route path="/eventos/:id">
        {(params?: { id: string }) =>
          params ? <PaginaEventoDetalhe eventoId={params.id} /> : null}
      </Route>

      {FLAGS.DESAFIOS_ENABLED ? (
        <>
          <Route path="/desafios"><Private><PaginaDesafios /></Private></Route>
          <Route path="/desafios/:id"><Private><PaginaDesafioUnico /></Private></Route>
          <Route path="/submissao/grupo/:desafioEmGrupoId/:desafioId">
            <Private><PaginaSubmissaoDesafioEmGrupo /></Private>
          </Route>
        </>
      ) : (
        <>
          <Route path="/desafios"><Private><PaginaFeed /></Private></Route>
          <Route path="/desafios/:id"><Private><PaginaTreinos /></Private></Route>
          <Route path="/submissao/grupo/:desafioEmGrupoId/:desafioId">
            <Private><PaginaMensagens /></Private>
          </Route>
        </>
      )}

      <Route path="/feed"><Private><PaginaFeed /></Private></Route>
      
      <Route path="/treinos/avaliar" component={AvaliarTreino} />
      <Route path="/treinos/livre/novo" component={PaginaTreinoLivreNovo} />
      <Route path="/treinos/livre/historico" component={PaginaTreinoLivresHistorico} />
      <Route path="/treinos/elenco"><Private><PaginaElenco /></Private></Route>
      <Route path="/treinos/elenco/jogos"><Private><PaginaJogosElenco/></Private></Route>
      <Route path="/treinos/novo"><PaginaNovoTreino /></Route>
      <Route path="/treinos/unico"><Private><PaginaTreinoUnico /></Private></Route>
      <Route path="/treinos/Criar-Metodologia"><CriarMetodologia/></Route>
      <Route path="/treinos/Minhas-Metodologias"><MinhasMetodologias/></Route>
      <Route path="/treinos"><Private><PaginaTreinos /></Private></Route>
      <Route path="/perfil/pontuacao"><Private><PaginaPontuacaoPerfil /></Private></Route>
      <Route path="/perfil/:id/pontuacao"><Private><PaginaPontuacaoDePerfil /></Private></Route>
      <Route path="/perfil/editar"><Private><PaginaEditarPerfil /></Private></Route>
      <Route path="/perfil/:id"><Private><PaginaPerfilUnico /></Private></Route>
      <Route path="/perfil"><Private><PaginaPerfil /></Private></Route>
      <Route path="/post/:id"><Private><PaginaPostUnico /></Private></Route>
      <Route path="/post"><Private><PaginaCreatePost /></Private></Route>
      <Route path="/metodologias/avaliar" component={AvaliarMetodologia} />
      <Route path="/metodologias/:id"><MetodologiaUnicaPage/></Route>
      <Route path="/submissao"><PaginaSubmissao /></Route>
      <Route path="/explorar"><Private><PaginaExplorar /></Private></Route>
      <Route path="/minha-rede"><Private><PaginaMinhaRede /></Private></Route>
      <Route path="/trainings"><PaginaTraining /></Route>
      <Route path="/configuracoes"><PaginaConfiguracoesPerfil /></Route>
      <Route path="/notificacoes"><PaginaNotificacoes /></Route>
      <Route path="/mensagens"><PaginaMensagens /></Route>
      <Route path="/"><HomeRedirect /></Route>
      <Route><div style={{ padding: 16 }}>Página não encontrada</div></Route>
    </Switch>
  );
}