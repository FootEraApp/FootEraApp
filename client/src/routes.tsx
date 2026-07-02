import { Route, Switch } from "wouter";
import { Private, PublicOnly } from "./auth.js";
import RequireAdmin from "./routes/RequireAdmin.js";
import { FLAGS } from "./config.js";
import { lazy, Suspense } from "react";

const AdminDashboard = lazy(() => import("./pages/admin-page.js"));
const AvaliarTreino = lazy(() => import("./pages/treino/avaliarTreino.js"));
const PaginaLogin = lazy(() => import("./pages/login.js"));
const PaginaCadastro = lazy(() => import("./pages/cadastro.js"));
const PaginaFeed = lazy(() => import("./pages/feed.js"));
const PaginaTreinos = lazy(() => import("./pages/treinos.js"));
const PaginaCreatePost = lazy(() => import("./pages/post/create.js"));
const PaginaExplorar = lazy(() => import("./pages/explorar.js"));
const PaginaCreateDesafios = lazy(() => import("./pages/admin/desafios/create.js"));
const PaginaCreateTreinos = lazy(() => import("./pages/admin/treinos/create.js"));
const PaginaCreateProfessores = lazy(() => import("./pages/admin/professores/create.js"));
const PaginaLoginAdmin = lazy(() => import("./pages/admin/login.js"));
const PaginaPerfil = lazy(() => import("./pages/perfil.js"));
const PaginaNovoTreino = lazy(() => import("./pages/novoTreino.js"));
const PaginaPostUnico = lazy(() => import("./pages/postUnico.js"));
const PaginaPerfilUnico = lazy(() => import("./pages/perfilUnico.js"));
const PaginaEditarPerfil = lazy(() => import("./pages/editarPerfil.js"));
const PaginaConfiguracoesPerfil = lazy(() => import("./pages/configuracoesPerfil.js"));
const PaginaPontuacaoPerfil = lazy(() => import("./pages/pontuacoesPerfil.js"));
const PaginaNotificacoes = lazy(() => import("./pages/notificacoes.js"));
const PaginaSubmissao = lazy(() => import("./pages/submissao.js"));
const PaginaMensagens = lazy(() => import("./pages/mensagens.js"));
const PaginaDesafios = lazy(() => import("./pages/desafios.js"));
const PaginaDesafioUnico = lazy(() => import("./pages/desafioUnico.js"));
const PaginaSubmissaoDesafioEmGrupo = lazy(() => import("./pages/submissaoDesafioEmGrupo.js"));
const PaginaEsqueciSenha = lazy(() => import("./pages/esqueciSenha.js"));
const PaginaResetarSenha = lazy(() => import("./pages/resetarSenha.js"));
const PaginaTraining = lazy(() => import("./pages/trainings.js"));
const PaginaMinhaRede = lazy(() => import("./pages/minhaRede.js"));
const PaginaPontuacaoDePerfil = lazy(() => import("./pages/perfilPontuacaoExplorar.js"));
const PaginaElenco = lazy(() => import("./pages/elenco.js"));
const PaginaGerenciarAtleta = lazy(() => import("./pages/GerenciarAtletas.js"));
const PaginaPerfilOlheiro = lazy(() => import("./components/perfil/PerfilOlheiro.js"));
const PaginaEventosClube = lazy(() => import("./pages/eventosClube.js"));
const PaginaNovoEventoClube = lazy(() => import("./pages/eventosClubeNovo.js"));
const PaginaEventoDetalhe = lazy(() => import("./pages/eventoDetalhe.js"));
const PaginaEventosEscola = lazy(() => import("./pages/eventosEscola.js"));
const PaginaNovoEventoEscola = lazy(() => import("./pages/eventosEscolaNovo.js"));
const PaginaTreinoUnico = lazy(() => import("./pages/TreinoUnico.js"));
const PaginaTermosEPrivacidade = lazy(() => import("./pages/TermosEPrivacidade.js"));
const PaginaOlheiros = lazy(() => import("./pages/olheiro/index.js"));
const PaginaConquistas = lazy(() => import("./pages/conquistas.js"));
const PaginaFormadores = lazy(() => import("./pages/formadores.js"));
const PaginaDesempenhoAtleta = lazy(() => import("./pages/olheiro/desempenho.js"));
const PaginaIndicarClube = lazy(() => import("./pages/olheiro/indicar.js"));
const PaginaTreinoLivreNovo = lazy(() => import("./pages/treinoLivreNovo.js"));
const PaginaTreinoLivresHistorico = lazy(() => import("./pages/treinoLivreHistorico.js"));
const PaginaCreateAdmin = lazy(() => import("./pages/createAdmin.js"));
const PaginaPagamentos = lazy(() => import("./pages/pagamentos/index.js"));
const PaginaJogosElenco = lazy(() => import("./pages/jogos-elenco.js"));
const PaginaGerenciarProfessores = lazy(() => import("./pages/GerenciarProfessores.js"));
const PaginaConvocarEvento = lazy(() => import("./pages/eventos/convocar.js"));
const PaginaVerificarEmail = lazy(() => import("./pages/verificar-email.js"));
const MetodologiaUnicaPage = lazy(() => import("./pages/metodologias/metodologia-unica.js"));
const AvaliarMetodologia = lazy(() => import("./pages/metodologias/avaliar.js"));
const TutorialPage = lazy(() => import("./pages/tutorial.js"));
const LandingPage = lazy(() => import("./pages/landingPage.js"));
const CadastroGoogleComplementar = lazy(() => import("./pages/cadastroGoogleComplementar.js"));
const ExercicioNovoPage = lazy(() => import("./pages/treino/exercicios/novo.js"));
const ExercicioEditarPage = lazy(() => import("./pages/treino/exercicios/editar/[id].js"));
const LearningCreatePage = lazy(() => import("./pages/learning/create.js"));
const LearningPage = lazy(() => import("./pages/learning/index.js"));
const FooteraContentLab = lazy(() => import("./pages/landingPageContentLab.js"));
const TreinoMetodologiaPage = lazy(() => import("./pages/treino/treino-metodologia.js"));
const CreatorProfile = lazy(() => import("./pages/creator/profile.js"));
const CreatorDashboard = lazy(() => import("./pages/creator/dashboard.js"));
const LearningLiveStudioPage = lazy(() => import("./pages/learning/live-studio.js"));
const LearningLivePage = lazy(() => import("./pages/learning/live.js"));
const CreatorEventosPage = lazy(() => import("./pages/creator/eventos.js"));
const CreatorNovoEventoPage = lazy(() => import("./pages/creator/eventos-novo.js"));
const MudarTipoPerfilPage = lazy(() => import("./pages/perfil/mudarTipo.js"));
const SalaCopaEventoPage = lazy(() => import("./pages/learning/evento/sala-copa.js"));
const LearningEventoAoVivoPage = lazy(() => import("./pages/learning/evento/eventoAoVivo.js"));

function RouteLoading() {
  return (
    <div className="min-h-screen bg-[#FEFBE9] flex items-center justify-center px-4">
      <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm text-green-900 font-semibold">
        Carregando...
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/login">
          <PublicOnly><PaginaLogin /></PublicOnly>
        </Route>
        <Route path="/cadastro/google/complementar">
          <CadastroGoogleComplementar />
        </Route>
        <Route path="/cadastro"><PaginaCadastro /></Route>
        <Route path="/verificar-email"><PaginaVerificarEmail /></Route> 
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
          <Private><PaginaCreateTreinos /></Private>
        </Route>
        <Route path="/admin/professores/create">
          <RequireAdmin><PaginaCreateProfessores /></RequireAdmin>
        </Route>
        <Route path="/admin/admins/create"><Private><PaginaCreateAdmin /></Private></Route> 
        <Route path="/admin">
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        </Route>

        <Route path="/olheiros/desempenho"><Private><PaginaDesempenhoAtleta /></Private></Route>
        <Route path="/olheiros/indicar"><Private><PaginaIndicarClube /></Private></Route>
        <Route path="/olheiros"><Private><PaginaOlheiros /></Private></Route>

        <Route path="/perfil-olheiro/:id">
          {({ id }: { id: string }) => <Private><PaginaPerfilOlheiro idDaUrl={id} /></Private>}
        </Route>

        <Route path="/perfil/mudar-tipo">
          <Private><MudarTipoPerfilPage /></Private>
        </Route>
        <Route path="/perfil/conquistas"><Private><PaginaConquistas /></Private></Route>
        <Route path="/perfil/GerenciarAtletas"><Private><PaginaGerenciarAtleta /></Private></Route>
        <Route path="/perfil/GerenciarProfessores"><Private><PaginaGerenciarProfessores /></Private></Route>
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

        <Route path="/eventos/convocar"><Private><PaginaConvocarEvento /></Private></Route> 

        <Route path="/eventos/clubes/:id/novo">
          {(params?: { id: string }) =>
            params ? <Private><PaginaNovoEventoClube clubeId={params.id} /></Private> : null}
        </Route>
        <Route path="/eventos/clubes/:id">
          {(params?: { id: string }) =>
            params ? <Private><PaginaEventosClube clubeId={params.id} /></Private> : null}
        </Route>

        <Route path="/eventos/escolas/:id/novo">
          {(params?: { id: string }) =>
            params ? <Private><PaginaNovoEventoEscola escolaId={params.id} /></Private> : null}
        </Route>
        <Route path="/eventos/escolas/:id">
          {(params?: { id: string }) =>
            params ? <Private><PaginaEventosEscola escolaId={params.id} /></Private> : null}
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
        <Route path="/treinos/avaliar"><Private><AvaliarTreino /></Private></Route> 
        <Route path="/treinos/livre/novo"><Private><PaginaTreinoLivreNovo /></Private></Route> 
        <Route path="/treinos/livre/historico"><Private><PaginaTreinoLivresHistorico /></Private></Route> 
        <Route path="/treinos/elenco"><Private><PaginaElenco /></Private></Route>
        <Route path="/treinos/elenco/jogos"><Private><PaginaJogosElenco/></Private></Route>
        <Route path="/treinos/novo"><Private><PaginaNovoTreino /></Private></Route>
        <Route path="/treinos/tutorial"><Private><TutorialPage /></Private></Route> 
        <Route path="/treinos/metodologia"><Private><TreinoMetodologiaPage /></Private></Route> 
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
        <Route path="/creator/eventos/novo">
          <Private><CreatorNovoEventoPage /></Private>
        </Route>
        <Route path="/creator/eventos">
          <Private><CreatorEventosPage /></Private>
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
              <Private><LearningLiveStudioPage /></Private>
            </Route>

            <Route path="/learning/live">
              <Private><LearningLivePage /></Private>
            </Route>

            <Route path="/learning/avaliar">
              <Private><AvaliarMetodologia /></Private>
            </Route>
            <Route path="/learning/evento/sala-copa"><Private><SalaCopaEventoPage /></Private></Route> 
            <Route path="/learning/evento/:aulaId">
              {() => <LearningEventoAoVivoPage />}
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
        <Route path="/submissao"><Private><PaginaSubmissao /></Private></Route>
        <Route path="/explorar"><Private><PaginaExplorar /></Private></Route>
        <Route path="/minha-rede"><Private><PaginaMinhaRede /></Private></Route>
        <Route path="/trainings"><Private><PaginaTraining /></Private></Route>
        <Route path="/configuracoes"><Private><PaginaConfiguracoesPerfil /></Private></Route>
        <Route path="/notificacoes"><Private><PaginaNotificacoes /></Private></Route>
        <Route path="/mensagens"><Private><PaginaMensagens /></Private></Route>
        {/*<Route path="/"><HomeRedirect /></Route>*/}
        {<Route path="/"><LandingPage /></Route>} 
        <Route><div style={{ padding: 16 }}>Página não encontrada</div></Route>
      </Switch>
    </Suspense>
  );
}