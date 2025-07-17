import { Route } from "wouter";
import PaginaLogin from "./pages/login";
import PaginaCadastro from "./pages/cadastro";
import HomeRedirect from "./pages/index";
import PaginaFeed from "./pages/feed";
import PaginaTreinos from "./pages/treinos";
import PaginaCreate from "./pages/post/create";
import PaginaMostrarPost from "./pages/post/showPost";
import PostagemIndividual from "./pages/post/postagemIndividual";
import PaginaExplorar from "./pages/explorar";
import PaginaAdmin from "./pages/admin-page";
export function AppRoutes() {
  return (
    <>
      <Route path="/">
        <HomeRedirect />
      </Route>
      <Route path="/login">
        <PaginaLogin />
      </Route>
      <Route path="/cadastro">
        <PaginaCadastro />
      </Route>
      <Route path="/feed">
        <PaginaFeed />
      </Route>
      <Route path="/treinos">
        <PaginaTreinos />
      </Route>
      <Route path="/post">
        <PaginaCreate />
      </Route>
      <Route path="/postagens/:id">
        <PostagemIndividual />
      </Route>
      <Route path="/posts">
        <PaginaMostrarPost />
      </Route>
      <Route path="/explorar">
        <PaginaExplorar />
      </Route>
      <Route path="/admin">
        <PaginaAdmin />
      </Route>

    </>
  );
}
