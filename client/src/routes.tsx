import { Route, Switch } from "wouter";
import { Private, PublicOnly, HomeRedirect } from "./auth";
import PaginaLogin from "./pages/login";
import PaginaCadastro from "./pages/cadastro";
import PaginaFeed from "./pages/feed";
import PaginaTreinos from "./pages/treinos";
import PaginaCreatePost from "./pages/post/create";
import PaginaMostrarPost from "./pages/post/showPost";
import PaginaExplorar from "./pages/explorar";
import PaginaAdmin from "./pages/admin-page";
import PaginaCreateDesafios from "./pages/admin/desafios/create";
import PaginaCreateExercicios from "./pages/admin/exercicios/create";
import PaginaCreateTreinos from "./pages/admin/treinos/create";
import PaginaCreateProfessores from "./pages/admin/professores/create";
import PaginaLoginAdmin from "./pages/admin/login";
import PaginaPerfil from "./pages/perfil";
import PaginaNovoTreino from "./pages/novoTreino";
import PaginaPostUnico from "./pages/postUnico";
import PaginaPerfilUnico from "./pages/perfilUnico";
import PaginaEditarPerfil from "./pages/editarPerfil";
import PaginaConfiguracoesPerfil from "./pages/configuracoesPerfil";
import PaginaPontuacaoPerfil from "./pages/pontuacoesPerfil";
import PaginaNotificacoes from "./pages/notificacoes";
import PaginaSubmissao from "./pages/submissao";
import PaginaMensagens from "./pages/mensagens";
import PaginaEsqueciSenha from "./pages/esqueciSenha";
import PaginaResetarSenha from "./pages/resetarSenha";

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
