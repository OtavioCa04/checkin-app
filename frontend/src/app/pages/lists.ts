import { Component, DestroyRef, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { VisitFilters } from "../models";
import { maxCharacters } from "../shared";
import { RouterLink } from "@angular/router";
import { Api, errorMessage } from "../api";
import { Usuario, Visita } from "../models";
import { Session } from "../session";
import { LocalDatePipe, roleLabel } from "../shared";

@Component({
  imports: [RouterLink, LocalDatePipe, ReactiveFormsModule],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">ACOMPANHAMENTO</span>
        <h1>Visitas</h1>
        <p class="muted">{{ scope }}</p>
      </div>
      @if (session.user?.perfil === "funcionario") {
        <a class="button primary" routerLink="/nova-visita">＋ Novo check-in</a>
      }
    </div>
    <section class="panel form-panel">
      <form
        [formGroup]="filtersForm"
        (ngSubmit)="applyFilters()"
        class="filters-form"
        novalidate
      >
        <div class="field">
          <label for="inicio">Check-in a partir de (local)</label
          ><input id="inicio" type="datetime-local" formControlName="inicio" />
        </div>
        <div class="field">
          <label for="fim">Check-in antes de (local)</label
          ><input id="fim" type="datetime-local" formControlName="fim" />
        </div>
        <div class="field">
          <label for="status-filter">Status</label
          ><select id="status-filter" formControlName="status">
            <option value="">Todos</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
          </select>
        </div>
        <div class="field">
          <label for="empresa-filter">Empresa contém</label
          ><input id="empresa-filter" formControlName="empresa" />
        </div>
        @if (session.user?.perfil === "admin") {
          <div class="field">
            <label for="funcionario-filter">ID do funcionário</label
            ><input
              id="funcionario-filter"
              type="number"
              min="1"
              step="1"
              formControlName="funcionario_id"
            />
          </div>
        }
        <div class="filter-actions">
          <button class="button primary compact" type="submit">
            Aplicar filtros</button
          ><button
            class="button secondary compact"
            type="button"
            (click)="clearFilters()"
          >
            Limpar
          </button>
        </div>
      </form>
      @if (filterError()) {
        <div class="alert" role="alert">{{ filterError() }}</div>
      }
      <small class="muted"
        >Início incluído; fim excluído. Horários locais convertidos para
        UTC.</small
      >
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>Registros de visitas</h2>
        <span class="muted">Página {{ offset() / limit + 1 }}</span>
      </div>
      @if (busy()) {
        <div class="state-card" role="status">Carregando registros…</div>
      } @else if (error()) {
        <div class="alert" role="alert">
          {{ error() }}
          <button class="text-link" (click)="load(offset())">
            Tentar novamente
          </button>
        </div>
      } @else if (!items().length) {
        <div class="state-card">
          <h3>Nenhuma visita nesta página</h3>
          <p>
            {{
              offset()
                ? "Volte à página anterior para consultar os registros."
                : "Os registros disponíveis para você aparecerão aqui."
            }}
          </p>
        </div>
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">
              Visitas disponíveis para o seu perfil
            </caption>
            <thead>
              <tr>
                <th>Empresa / assunto</th>
                <th>Contato</th>
                <th>Check-in local</th>
                <th>Status</th>
                <th><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (v of items(); track v.id) {
                <tr>
                  <td>
                    <strong>{{ v.empresa }}</strong
                    ><small>{{ v.assunto }}</small>
                  </td>
                  <td>{{ v.contato }}</td>
                  <td>{{ v.data_hora_checkin | localDate }}</td>
                  <td>
                    <span
                      class="status"
                      [class.done]="v.status === 'concluida'"
                      >{{
                        v.status === "concluida" ? "Concluída" : "Em andamento"
                      }}</span
                    >
                  </td>
                  <td>
                    <a
                      class="text-link"
                      [routerLink]="['/visitas', v.id]"
                      [queryParams]="route.snapshot.queryParams"
                      [attr.aria-label]="
                        'Ver visita ' + v.id + ' à empresa ' + v.empresa
                      "
                      >Ver detalhes ↗</a
                    >
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div class="pagination">
        <span>{{ items().length }} registros nesta página</span>
        <div>
          <button
            class="button secondary compact"
            [disabled]="busy() || offset() === 0"
            (click)="changePage(offset() - limit)"
          >
            ← Anterior</button
          ><button
            class="button secondary compact"
            [disabled]="
              busy() ||
              !!error() ||
              items().length < limit ||
              offset() + limit > 1000000
            "
            (click)="changePage(offset() + limit)"
          >
            Próxima →
          </button>
        </div>
      </div>
    </section>
  `,
})
export class VisitListPage {
  private readonly api = inject(Api);
  readonly session = inject(Session);
  readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly limit = 20;
  readonly offset = signal(0);
  readonly items = signal<Visita[]>([]);
  readonly busy = signal(true);
  readonly error = signal("");
  readonly filterError = signal("");
  readonly filtersForm = new FormGroup({
    inicio: new FormControl("", { nonNullable: true }),
    fim: new FormControl("", { nonNullable: true }),
    status: new FormControl("", { nonNullable: true }),
    empresa: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(180)],
    }),
    funcionario_id: new FormControl<number | null>(null),
  });
  private generation = 0;
  private filters: VisitFilters = {};
  get scope(): string {
    return this.session.user?.perfil === "funcionario"
      ? "Seus encontros em campo, em um só lugar."
      : this.session.user?.perfil === "responsavel"
        ? "Visitas atribuídas a você para acompanhamento."
        : "Todos os registros da equipe.";
  }
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.filters = {};
      for (const key of ["inicio", "fim", "status", "empresa"] as const) {
        const value = params.get(key);
        if (value) {
          this.filters[key] = value;
        }
      }
      const employee = params.get("funcionario_id");
      if (employee) {
        this.filters.funcionario_id = Number(employee);
      }
      this.filtersForm.reset({
        inicio: utcToLocal(params.get("inicio") ?? ""),
        fim: utcToLocal(params.get("fim") ?? ""),
        status: params.get("status") ?? "",
        empresa: params.get("empresa") ?? "",
        funcionario_id: employee ? Number(employee) : null,
      });
      const offset = Number(params.get("offset") ?? 0);
      void this.load(
        Number.isInteger(offset) && offset >= 0 && offset <= 1000000
          ? offset
          : 0,
      );
    });
    inject(DestroyRef).onDestroy(() => this.generation++);
  }
  applyFilters(): void {
    this.filterError.set("");
    if (this.filtersForm.invalid) {
      this.filterError.set("Empresa deve ter até 180 caracteres.");
      return;
    }
    const raw = this.filtersForm.getRawValue();
    const filters: VisitFilters = {};
    for (const key of ["inicio", "fim"] as const) {
      if (raw[key]) {
        const date = new Date(raw[key]);
        if (Number.isNaN(date.getTime())) {
          this.filterError.set("Período inválido.");
          return;
        }
        filters[key] = date.toISOString().replace(".000", "");
      }
    }
    if (filters.inicio && filters.fim && filters.inicio >= filters.fim) {
      this.filterError.set("O fim deve ser posterior ao início.");
      return;
    }
    if (raw.status) {
      filters.status = raw.status;
    }
    if (raw.empresa.trim()) {
      filters.empresa = raw.empresa.trim();
    }
    if (this.session.user?.perfil === "admin" && raw.funcionario_id !== null) {
      if (
        !Number.isInteger(raw.funcionario_id) ||
        raw.funcionario_id < 1 ||
        raw.funcionario_id > 4294967295
      ) {
        this.filterError.set("ID do funcionário inválido.");
        return;
      }
      filters.funcionario_id = raw.funcionario_id;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...filters, offset: 0 },
    });
  }
  clearFilters(): void {
    this.filterError.set("");
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
  changePage(offset: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.route.snapshot.queryParams, offset },
    });
  }
  async load(offset: number): Promise<void> {
    const generation = ++this.generation;
    this.busy.set(true);
    this.error.set("");
    try {
      const page = await this.api.visits(this.limit, offset, this.filters);
      if (generation === this.generation) {
        this.items.set(page.items);
        this.offset.set(offset);
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
      }
    } finally {
      if (generation === this.generation) {
        this.busy.set(false);
      }
    }
  }
}
export function utcToLocal(value: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}
export { UserListPage } from "./users";
