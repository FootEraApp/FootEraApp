import { Route, Switch } from "wouter";
import { Private, PublicOnly, HomeRedirect } from "./auth.js";
import RequireAdmin from "./routes/RequireAdmin.js";

import AdminDashboard from "./pages/admin-page.js";
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

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnly><PaginaLogin /></PublicOnly>
      </Route>
      <Route path="/cadastro"><PaginaCadastro /></Route>
      <Route path="/esqueci-senha">
        <PublicOnly><PaginaEsqueciSenha /></PublicOnly>
      </Route>
      <Route path="/resetar-senha">
        <PublicOnly><PaginaResetarSenha /></PublicOnly>
      </Route>

      <Route path="/admin/login"><PaginaLoginAdmin /></Route>

      <Route path="/admin/desafios/create">
        <RequireAdmin><PaginaCreateDesafios /></RequireAdmin>
      </Route>
      <Route path="/admin/exercicios/create">
        <RequireAdmin><PaginaCreateExercicios /></RequireAdmin>
      </Route>
      <Route path="/admin/treinos/create">
        <RequireAdmin><PaginaCreateTreinos /></RequireAdmin>
      </Route>
      <Route path="/admin/professores/create">
        <RequireAdmin><PaginaCreateProfessores /></RequireAdmin>
      </Route>
      <Route path="/admin">
        <RequireAdmin>
          <AdminDashboard />
        </RequireAdmin>
      </Route>

      <Route path="/feed/desafios"><Private><PaginaDesafios /></Private></Route>
      <Route path="/feed"><Private><PaginaFeed /></Private></Route>
      <Route path="/desafios/:id"><Private><PaginaDesafioUnico /></Private></Route>
      <Route path="/treinos/elenco"><Private><PaginaElenco /></Private></Route>
      <Route path="/treinos/novo"><PaginaNovoTreino /></Route>
      <Route path="/treinos"><Private><PaginaTreinos /></Private></Route>
      <Route path="/perfil/pontuacao"><Private><PaginaPontuacaoPerfil /></Private></Route>
      <Route path="/perfil/:id/pontuacao"><Private><PaginaPontuacaoDePerfil /></Private></Route>
      <Route path="/perfil/editar"><Private><PaginaEditarPerfil /></Private></Route>
      <Route path="/perfil/:id"><Private><PaginaPerfilUnico /></Private></Route>
      <Route path="/perfil"><Private><PaginaPerfil /></Private></Route>
      <Route path="/post/:id"><Private><PaginaPostUnico /></Private></Route>
      <Route path="/post"><Private><PaginaCreatePost /></Private></Route>
      <Route path="/submissao/grupo/:grupoId/:desafioId"><PaginaSubmissaoDesafioEmGrupo /></Route>
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