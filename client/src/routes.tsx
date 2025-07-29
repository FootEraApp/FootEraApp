import { Route } from "wouter";
import React from "react";
import PaginaLogin from "./pages/login";
import PaginaCadastro from "./pages/cadastro";
import HomeRedirect from "./pages/index";
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
      <Route path="/treinos/novo">
        <PaginaNovoTreino />
      </Route>
      <Route path="/post">
        <PaginaCreatePost />
      </Route>
      <Route path="/post/:id">
        <PaginaPostUnico />
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
      <Route path="/perfil">
        <PaginaPerfil />
      </Route>
      <Route path="/perfil/:id">
        <PaginaPerfilUnico />
      </Route>
      <Route path="/perfil/editar">
        <PaginaEditarPerfil />
      </Route>
      <Route path="/perfil/configuracoes">
        <PaginaConfiguracoesPerfil />
      </Route>
    </>
  );
}
