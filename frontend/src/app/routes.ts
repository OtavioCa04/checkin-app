import { Routes } from "@angular/router";
import { protectedGuard, roleGuard } from "./auth";
import { unsavedGuard } from "./unsaved";
export const routes: Routes = [
  {
    path: "login",
    title: "Entrar · Em campo",
    loadComponent: () => import("./pages/login").then((m) => m.LoginPage),
  },
  {
    path: "",
    canActivate: [protectedGuard],
    children: [
      {
        path: "agenda",
        title: "Agenda · Em campo",
        canDeactivate: [unsavedGuard],
        loadComponent: () => import("./pages/agenda").then((m) => m.AgendaPage),
      },
      {
        path: "",
        title: "Visão geral · Em campo",
        loadComponent: () => import("./pages/home").then((m) => m.HomePage),
      },
      {
        path: "visitas",
        title: "Visitas · Em campo",
        loadComponent: () =>
          import("./pages/lists").then((m) => m.VisitListPage),
      },
      {
        path: "nova-visita",
        canActivate: [roleGuard("funcionario")],
        canDeactivate: [unsavedGuard],
        title: "Novo check-in · Em campo",
        loadComponent: () => import("./pages/create").then((m) => m.CreatePage),
      },
      {
        path: "visitas/:id",
        canDeactivate: [unsavedGuard],
        title: "Detalhes da visita · Em campo",
        loadComponent: () => import("./pages/detail").then((m) => m.DetailPage),
      },
      {
        path: "usuarios",
        canActivate: [roleGuard("admin")],
        canDeactivate: [unsavedGuard],
        title: "Usuários · Em campo",
        loadComponent: () =>
          import("./pages/lists").then((m) => m.UserListPage),
      },
      {
        path: "acesso-negado",
        title: "Acesso restrito · Em campo",
        loadComponent: () => import("./pages/denied").then((m) => m.DeniedPage),
      },
    ],
  },
  {
    path: "**",
    title: "Página não encontrada · Em campo",
    loadComponent: () => import("./pages/denied").then((m) => m.NotFoundPage),
  },
];
