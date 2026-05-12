import { Route, Switch } from "wouter";
import { Private, PublicOnly } from "./auth.js";
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
import MetodologiaUnicaPage from "./pages/metodologias/metodologia-unica.js";
import AvaliarMetodologia from "./pages/metodologias/avaliar.js";
import TutorialPage from "./pages/tutorial.js";
import LandingPage from "./pages/landingPage.js"
import CadastroGoogleComplementar from "./pages/cadastroGoogleComplementar";
import ExercicioNovoPage from "./pages/treino/exercicios/novo.js";
import ExercicioEditarPage from "./pages/treino/exercicios/editar/[id].js";
import LearningCreatePage from "./pages/learning/create.js";
import LearningPage from "./pages/learning/index.js";
import FooteraContentLab from "./pages/landingPageContentLab.js";
import TreinoMetodologiaPage from "./pages/treino/treino-metodologia.js";
import CreatorProfile from "./pages/creator/profile.js";
import CreatorDashboard from "./pages/creator/dashboard.js";
import LearningLiveStudioPage from "./pages/learning/live-studio.js";
import LearningLivePage from "./pages/learning/live.js";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnly><PaginaLogin /></PublicOnly>
      </Route>
      <Route path="/cadastro/google/complementar">
        <CadastroGoogleComplementar />
      </Route>

      <Route path="/cadastro"><PaginaCadastro /></Route>
      <Route path="/verificar-email" component={PaginaVerificarEmail} />
      <Route path="/termos"><PaginaTermosEPrivacidade /></Route>

      <Route path="/content-lab"><FooteraContentLab /></Route>

      <Route path="/esqueci-senha">
        <PublicOnly><PaginaEsqueciSenha /></PublicOnly>
      </Route>
      <Route path="/resetar-senha">
        <PublicOnly><PaginaResetarSenha /></PublicOnly>
      </Route>

      <Route path="/admin/login"><PaginaLoginAdmin /></Route>
      {FLAGS.PAGAMENTOS_ENABLED ? (
        <Route path="/pagamentos">
          <Private><PaginaPagamentos /></Private>
        </Route>
      ) : (
        <Route path="/pagamentos">
          <Private>
            <div style={{ padding: 16 }}>
              Estamos reformulando a página de pagamentos no momento.
            </div>
          </Private>
        </Route>
      )}
      {FLAGS.DESAFIOS_ENABLED ? (
        <Route path="/admin/desafios/create">
          <RequireAdmin><PaginaCreateDesafios /></RequireAdmin>
        </Route>
      ) : (
        <Route path="/admin/desafios/create">
          <RequireAdmin><div style={{ padding: 16 }}>Desafios desativados por enquanto.</div></RequireAdmin>
        </Route>
      )}
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
      {FLAGS.FORMADORES_ENABLED ? (
        <Route path="/formadores">
          <Private><PaginaFormadores /></Private>
        </Route>
      ) : (
        <Route path="/formadores">
          <Private>
            <div className="min-h-screen bg-[#FFF8E6] flex items-center justify-center px-4">
              <div className="max-w-xl w-full bg-white rounded-2xl shadow-md border border-green-100 p-8 text-center">
                <div className="text-2xl font-bold text-green-900 mb-3">
                  FootEra Formadores
                </div>
                <p className="text-green-900/80 text-base">
                  Esta página está em manutenção no momento.
                </p>
                <p className="text-green-900/70 text-sm mt-2">
                  Em breve o módulo estará disponível novamente.
                </p>
              </div>
            </div>
          </Private>
        </Route>
      )}

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
      
      <Route path="/treinos/exercicios/novo"><Private><ExercicioNovoPage/></Private></Route>
      <Route path="/treinos/exercicios/editar/:id"><Private><ExercicioEditarPage/></Private></Route>
      <Route path="/treinos/avaliar" component={AvaliarTreino} />
      <Route path="/treinos/livre/novo" component={PaginaTreinoLivreNovo} />
      <Route path="/treinos/livre/historico" component={PaginaTreinoLivresHistorico} />
      <Route path="/treinos/elenco"><Private><PaginaElenco /></Private></Route>
      <Route path="/treinos/elenco/jogos"><Private><PaginaJogosElenco/></Private></Route>
      <Route path="/treinos/novo"><PaginaNovoTreino /></Route>
      <Route path="/treinos/tutorial" component={TutorialPage}/>
      <Route path="/treinos/metodologia" component={TreinoMetodologiaPage} />
      <Route path="/treinos/unico"><Private><PaginaTreinoUnico /></Private></Route>
      <Route path="/treinos"><Private><PaginaTreinos /></Private></Route>
      <Route path="/perfil/pontuacao"><Private><PaginaPontuacaoPerfil /></Private></Route>
      <Route path="/perfil/:id/pontuacao"><Private><PaginaPontuacaoDePerfil /></Private></Route>
      <Route path="/perfil/editar"><Private><PaginaEditarPerfil /></Private></Route>
      <Route path="/creator/profile">
        <Private><CreatorProfile /></Private>
      </Route>

      <Route path="/creator/dashboard">
        <Private><CreatorDashboard /></Private>
      </Route>
      <Route path="/perfil/:id"><Private><PaginaPerfilUnico /></Private></Route>
      <Route path="/perfil"><Private><PaginaPerfil /></Private></Route>
      <Route path="/post/:id"><Private><PaginaPostUnico /></Private></Route>
      <Route path="/post"><Private><PaginaCreatePost /></Private></Route>
      
      {FLAGS.LEARNING_ENABLED ? (
        <>
          <Route path="/metodologias/avaliar">
            <Private><AvaliarMetodologia /></Private>
          </Route>
          <Route path="/metodologias/:id">
            <Private><MetodologiaUnicaPage /></Private>
          </Route>
          <Route path="/learning/create">
            <Private><LearningCreatePage /></Private>
          </Route>

          <Route path="/learning/live-studio">
            <Private>< LearningLiveStudioPage/></Private>
          </Route>

          <Route path="/learning/live">
            <Private><LearningLivePage /></Private>
          </Route>

          <Route path="/learning/avaliar">
            <Private><AvaliarMetodologia /></Private>
          </Route>
          <Route path="/learning/:id">
            <Private><MetodologiaUnicaPage /></Private>
          </Route>
          <Route path="/learning">
            <Private><LearningPage /></Private>
          </Route>
        </>
      ) : (
        <>
          <Route path="/metodologias/avaliar">
            <Private><PaginaTreinos /></Private>
          </Route>
          <Route path="/metodologias/:id">
            <Private><PaginaTreinos /></Private>
          </Route>
          <Route path="/learning/create">
            <Private><PaginaTreinos /></Private>
          </Route>
          <Route path="/learning/:id">
            <Private><PaginaTreinos /></Private>
          </Route>
          <Route path="/learning/avaliar">
            <Private><PaginaTreinos /></Private>
          </Route>
          <Route path="/learning">
            <Private><PaginaTreinos /></Private>
          </Route>
        </>
      )}
      <Route path="/submissao"><PaginaSubmissao /></Route>
      <Route path="/explorar"><Private><PaginaExplorar /></Private></Route>
      <Route path="/minha-rede"><Private><PaginaMinhaRede /></Private></Route>
      <Route path="/trainings"><PaginaTraining /></Route>
      <Route path="/configuracoes"><PaginaConfiguracoesPerfil /></Route>
      <Route path="/notificacoes"><PaginaNotificacoes /></Route>
      <Route path="/mensagens"><PaginaMensagens /></Route>
      {/*<Route path="/"><HomeRedirect /></Route>*/}
      {<Route path="/"><LandingPage /></Route>} 
      <Route><div style={{ padding: 16 }}>Página não encontrada</div></Route>
    </Switch>
  );
}