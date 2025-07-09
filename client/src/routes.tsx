import { Route } from "wouter";
import PaginaLogin from "./pages/login";
import PaginaCadastro from "./pages/cadastro";
import HomeRedirect from "./pages/index";
import PaginaFeed from "./pages/feed";

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
    </>
  );
}
