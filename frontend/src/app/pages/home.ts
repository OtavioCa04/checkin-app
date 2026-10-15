import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Session } from "../session";
import { Api, errorMessage } from "../api";
import { Visita } from "../models";
import { LocalDatePipe } from "../shared";
@Component({
  imports: [RouterLink, LocalDatePipe],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">SEU DIA EM CAMPO</span>
        <h1>Olá, {{ session.user?.nome?.split(" ")?.[0] }}.</h1>
        <p class="muted">{{ scope }}</p>
      </div>
      @if (session.user?.perfil === "funcionario") {
        <a class="button primary" routerLink="/nova-visita">＋ Novo check-in</a>
      }
    </div>
    <section class="welcome-banner">
      <div>
        <span class="eyebrow">CADA ENCONTRO CONTA</span>
        <h2>O próximo passo começa<br />com uma boa visita.</h2>
        <p>
          Consulte os registros, acompanhe os detalhes<br />e mantenha suas
          visitas em dia.
        </p>
        <a routerLink="/visitas" class="button light"
          >Explorar visitas <span>→</span></a
        >
      </div>
      <div class="banner-art" aria-hidden="true">
        <div class="orbit"><span>↗</span></div>
        <small>CONEXÕES QUE MOVEM</small>
      </div>
    </section>
    <div class="section-heading">
      <h2>Visitas mais recentes</h2>
      <a routerLink="/visitas" class="text-link">Ver todas →</a>
    </div>
    @if (busy()) {
      <div class="state-card" role="status">Carregando suas visitas…</div>
    } @else if (error()) {
      <div class="alert" role="alert">
        {{ error() }}
        <button class="text-link" (click)="load()">Tentar novamente</button>
      </div>
    } @else if (!visits().length) {
      <div class="state-card">
        <span class="empty-icon" aria-hidden="true">↗</span>
        <h3>Seu espaço está pronto</h3>
        <p>Nenhuma visita disponível para seu perfil.</p>
        @if (session.user?.perfil === "funcionario") {
          <a routerLink="/nova-visita" class="button secondary"
            >Registrar primeira visita</a
          >
        }
      </div>
    } @else {
      <div class="recent-grid">
        @for (visit of visits(); track visit.id) {
          <a class="visit-card" [routerLink]="['/visitas', visit.id]"
            ><div class="card-top">
              <span class="record-number">VISITA #{{ visit.id }}</span
              ><span
                class="status"
                [class.done]="visit.status === 'concluida'"
                >{{
                  visit.status === "concluida" ? "Concluída" : "Em andamento"
                }}</span
              >
            </div>
            <h3>{{ visit.empresa }}</h3>
            <p>{{ visit.assunto }}</p>
            <div class="card-bottom">
              <span>{{ visit.data_hora_checkin | localDate }}</span
              ><span aria-hidden="true">↗</span>
            </div></a
          >
        }
      </div>
    }
  `,
})
export class HomePage {
  readonly session = inject(Session);
  private readonly api = inject(Api);
  readonly visits = signal<Visita[]>([]);
  readonly busy = signal(true);
  readonly error = signal("");
  get scope(): string {
    return this.session.user?.perfil === "funcionario"
      ? "Aqui estão os registros das suas visitas externas."
      : this.session.user?.perfil === "responsavel"
        ? "Acompanhe as visitas atribuídas a você."
        : "Acompanhe as visitas de toda a equipe.";
  }
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.busy.set(true);
    this.error.set("");
    try {
      this.visits.set((await this.api.visits(3, 0)).items);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
