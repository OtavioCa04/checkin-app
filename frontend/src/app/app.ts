import { Component, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { Session } from "./session";
import { Auth } from "./auth";
import { roleLabel } from "./shared";
@Component({
  selector: "app-root",
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a href="#conteudo" class="skip-link">Pular para o conteúdo</a>
    @if (session.current(); as login) {
      <div class="app-layout">
        <aside class="sidebar" aria-label="Navegação principal">
          <a routerLink="/" class="brand"
            ><span class="brand-mark" aria-hidden="true">↗</span
            ><span>em campo<small>GESTÃO DE VISITAS</small></span></a
          >
          <span class="nav-caption">ESPAÇO DE TRABALHO</span>
          <nav>
            <a routerLink="/clientes" routerLinkActive="active"
              ><span aria-hidden="true">♧</span> Clientes</a
            >
            <a routerLink="/retornos" routerLinkActive="active"
              ><span aria-hidden="true">↻</span> Retornos</a
            >
            <a routerLink="/agenda" routerLinkActive="active"
              ><span aria-hidden="true">▦</span> Agenda</a
            >
            <a
              routerLink="/"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              ><span aria-hidden="true">⌂</span> Visão geral</a
            >
            <a routerLink="/visitas" routerLinkActive="active"
              ><span aria-hidden="true">▤</span> Visitas</a
            >
            @if (login.usuario.perfil === "funcionario") {
              <a routerLink="/nova-visita" routerLinkActive="active"
                ><span aria-hidden="true">＋</span> Novo check-in</a
              >
            }
            @if (login.usuario.perfil === "admin") {
              <a routerLink="/usuarios" routerLinkActive="active"
                ><span aria-hidden="true">♧</span> Usuários</a
              >
            }
          </nav>
          <div class="sidebar-note">
            <span class="live-dot"></span> Seu trabalho, registrado.
            <p>Acompanhe cada visita do início à conclusão.</p>
          </div>
          <div class="account">
            <span class="avatar">{{
              login.usuario.nome.slice(0, 1).toUpperCase()
            }}</span>
            <div>
              <strong>{{ login.usuario.nome }}</strong
              ><small>{{ labels[login.usuario.perfil] }}</small>
            </div>
          </div>
          <button class="logout" [disabled]="leaving()" (click)="logout()">
            {{ leaving() ? "Encerrando…" : "Sair da conta" }}
            <span aria-hidden="true">↗</span>
          </button>
        </aside>
        <main id="conteudo" class="workspace" tabindex="-1">
          <header class="topbar">
            <span>REGISTRO E ACOMPANHAMENTO</span
            ><span class="profile-badge">{{
              labels[login.usuario.perfil]
            }}</span>
          </header>
          <div class="page-content"><router-outlet /></div>
          <footer>Em campo <span>•</span> Registro de visitas externas</footer>
        </main>
      </div>
    } @else {
      <main id="conteudo" tabindex="-1"><router-outlet /></main>
    }
  `,
})
export class App {
  readonly session = inject(Session);
  readonly auth = inject(Auth);
  readonly labels = roleLabel;
  readonly leaving = signal(false);
  async logout(): Promise<void> {
    if (this.leaving()) {
      return;
    }
    this.leaving.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.leaving.set(false);
    }
  }
}
