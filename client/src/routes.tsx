import { Route } from "wouter";
import PaginaLogin from "./pages/login";
import PaginaCadastro from "./pages/cadastro";
import HomeRedirect from "./pages/index";
import PaginaFeed from "./pages/feed";
import PaginaTreinos from "./pages/treinos";
import PaginaCreate from "./pages/post/create";
import ShowPostPage from "./pages/post/showPost";
import PostagemIndividual from "./pages/post/postagemIndividual";
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
        <ShowPostPage />
      </Route>

    </>
  );
}
