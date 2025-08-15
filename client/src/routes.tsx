import { Route, Switch } from "wouter";
import { Private, PublicOnly, HomeRedirect } from "./auth.js";
import PaginaLogin from "./pages/login.js";
import PaginaCadastro from "./pages/cadastro.js";
import PaginaFeed from "./pages/feed.js";
import PaginaTreinos from "./pages/treinos.js";
import PaginaCreatePost from "./pages/post/create.js";
import PaginaMostrarPost from "./pages/post/showPost.js";
import PaginaExplorar from "./pages/explorar.js";
import PaginaAdmin from "./pages/admin-page.js";
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
import PaginaEsqueciSenha from "./pages/esqueciSenha.js";
import PaginaResetarSenha from "./pages/resetarSenha.js";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnly><PaginaLogin /></PublicOnly>
      </Route>
      <Route path="/cadastro">
        <PaginaCadastro />
      </Route>
      <Route path="/treinos/novo">
        <PaginaNovoTreino />
      </Route>
      <Route path="/posts">
        <PaginaMostrarPost />
      </Route>
      <Route path="/admin">
        <PaginaAdmin />
      </Route>
      <Route path="/admin/desafios/create">
        <PaginaCreateDesafios />
      </Route>
      <Route path="/admin/exercicios/create">
        <PaginaCreateExercicios />
      </Route>
      <Route path="/admin/treinos/create">
        <PaginaCreateTreinos />
      </Route>
      <Route path="/admin/professores/create">
        <PaginaCreateProfessores />
      </Route>
      <Route path="/admin/login">
        <PaginaLoginAdmin />
      </Route>
      <Route path="/perfil/editar">
        <PaginaEditarPerfil />
      </Route>
      <Route path="/perfil/configuracoes">
        <PaginaConfiguracoesPerfil />
      </Route>
      <Route path="/perfil/pontuacao">
        <PaginaPontuacaoPerfil />
      </Route>
      <Route path="/notificacoes">
        <PaginaNotificacoes />
      </Route>
      <Route path="/submissao">
        <PaginaSubmissao />
      </Route>
      <Route path="/mensagens">
        <PaginaMensagens />
      </Route>
      <Route path="/esqueci-senha">
        <PublicOnly><PaginaEsqueciSenha /></PublicOnly>
      </Route>
      <Route path="/resetar-senha">
        <PublicOnly><PaginaResetarSenha /></PublicOnly>
      </Route>

      <Route path="/feed">
        <Private>< PaginaFeed /></Private>
      </Route>
      <Route path="/treinos">
        <Private><PaginaTreinos /></Private>
      </Route>
      <Route path="/perfil">
        <Private><PaginaPerfil /></Private>
      </Route>
      <Route path="/perfil/:id">
        <Private><PaginaPerfilUnico /></Private>
      </Route>
      <Route path="/post">
        <Private><PaginaCreatePost /></Private>
      </Route>
      <Route path="/explorar">
        <Private><PaginaExplorar /></Private>
      </Route>
      <Route path="/post/:id">
        <Private><PaginaPostUnico /></Private>
      </Route>

      <Route path="/">
        <HomeRedirect />
      </Route>
      <Route><div style={{ padding: 16 }}>Página não encontrada</div></Route>
    </Switch>
  );
}
