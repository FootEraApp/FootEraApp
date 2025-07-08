import { Route } from "wouter";
import PaginaLogin from "./pages/login";
import PaginaCadastro from "./pages/cadastro";
import HomeRedirect from "./pages/index";

export function AppRoutes() {
  return (
    <>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={PaginaLogin} />
      <Route path="/cadastro" component={PaginaCadastro} />
    </>
  );
}
