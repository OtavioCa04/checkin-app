import { Routes } from "@angular/router";
import { protectedGuard, roleGuard, superadminGuard } from "./auth";
import { unsavedGuard } from "./unsaved";
export const routes: Routes = [
  {
    path: "login",
    title: "Entrar · Na Rua",
    loadComponent: () => import("./pages/login").then((m) => m.LoginPage),
  },
  {
    path: "",
    canActivate: [protectedGuard],
    children: [
      {
        path: "clientes",
        title: "Clientes · Na Rua",
        canDeactivate: [unsavedGuard],
        loadComponent: () =>
          import("./pages/clients").then((m) => m.ClientsPage),
      },
      {
        path: "clientes/:id",
        title: "Cliente · Na Rua",
        canDeactivate: [unsavedGuard],
        loadComponent: () =>
          import("./pages/clients").then((m) => m.ClientDetailPage),
      },
      {
        path: "retornos",
        title: "Retornos · Na Rua",
        loadComponent: () =>
          import("./pages/returns").then((m) => m.ReturnsPage),
      },
      {
        path: "retornos/:id",
        title: "Retorno · Na Rua",
        canDeactivate: [unsavedGuard],
        loadComponent: () =>
          import("./pages/returns").then((m) => m.ReturnDetailPage),
      },
      {
        path: "agenda",
        title: "Agenda · Na Rua",
        canDeactivate: [unsavedGuard],
        loadComponent: () => import("./pages/agenda").then((m) => m.AgendaPage),
      },
      {
        path: "",
        title: "Visão geral · Na Rua",
        loadComponent: () => import("./pages/home").then((m) => m.HomePage),
      },
      {
        path: "visitas",
        title: "Visitas · Na Rua",
        loadComponent: () =>
          import("./pages/lists").then((m) => m.VisitListPage),
      },
      {
        path: "nova-visita",
        canActivate: [roleGuard("funcionario", "admin")],
        canDeactivate: [unsavedGuard],
        title: "Novo check-in · Na Rua",
        loadComponent: () => import("./pages/create").then((m) => m.CreatePage),
      },
      {
        path: "visitas/:id",
        canDeactivate: [unsavedGuard],
        title: "Detalhes da visita · Na Rua",
        loadComponent: () => import("./pages/detail").then((m) => m.DetailPage),
      },
      {
        path: "usuarios",
        canActivate: [roleGuard("admin")],
        canDeactivate: [unsavedGuard],
        title: "Usuários · Na Rua",
        loadComponent: () =>
          import("./pages/lists").then((m) => m.UserListPage),
      },
      {
        path: "empresas",
        canActivate: [superadminGuard],
        canDeactivate: [unsavedGuard],
        title: "Empresas · Na Rua",
        loadComponent: () =>
          import("./pages/companies").then((m) => m.CompaniesPage),
      },
      {
        path: "acesso-negado",
        title: "Acesso restrito · Na Rua",
        loadComponent: () => import("./pages/denied").then((m) => m.DeniedPage),
      },
    ],
  },
  {
    path: "**",
    title: "Página não encontrada · Na Rua",
    loadComponent: () => import("./pages/denied").then((m) => m.NotFoundPage),
  },
];
