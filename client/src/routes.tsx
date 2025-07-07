import { Route } from "wouter";
import PaginaLogin from "@pages/login";
import PaginaCadastro from "@pages/cadastro";
import PaginaHome from "@pages/home";
import HomeRedirect from "./pages/index";

export function AppRoutes() {
  return (
    <>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={PaginaLogin} />
      <Route path="/cadastro" component={PaginaCadastro} />
      <Route path="/home" component={PaginaHome} />
      <Route>404 - Página não encontrada</Route>
    </>
  );
}
