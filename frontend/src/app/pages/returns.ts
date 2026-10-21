import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Api, errorMessage } from "../api";
import { Retorno } from "../models";
import { Session } from "../session";
import { dayLabel, localDay, returnSituation } from "../customer-shared";
import { maxCharacters, nonBlank, LocalDatePipe } from "../shared";
import { toUtc } from "../agenda-dates";
import { warnBeforeUnload } from "../unsaved";

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">ACOMPANHAMENTO</span>
        <h1>Próximos retornos</h1>
        <p class="muted">
          Pendências criadas ao concluir visitas. Datas de retorno representam
          um dia, sem conversão de fuso.
        </p>
      </div>
    </div>
    <form
      [formGroup]="filters"
      (ngSubmit)="apply()"
      class="panel form-panel agenda-filters"
    >
      <div class="field">
        <label for="returns-start">De (incluído)</label
        ><input id="returns-start" type="date" formControlName="inicio" />
      </div>
      <div class="field">
        <label for="returns-end">Até (excluído)</label
        ><input id="returns-end" type="date" formControlName="fim" />
      </div>
      <div class="field">
        <label for="returns-status">Situação</label
        ><select id="returns-status" formControlName="status">
          <option value="">Todas</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
          <option value="hoje">Hoje</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      @if (session.user?.perfil === "admin") {
        <div class="field">
          <label for="returns-user">Funcionário (ID)</label
          ><input
            id="returns-user"
            type="number"
            min="1"
            formControlName="funcionario_id"
          />
        </div>
      }
      <button type="submit" class="button secondary">Aplicar filtros</button>
    </form>
    @if (error()) {
      <div class="alert" role="alert">
        {{ error() }}
        <button type="button" class="text-link" (click)="load()">
          Tentar novamente
        </button>
      </div>
    }
    @if (loading()) {
      <p role="status">Carregando retornos…</p>
    } @else if (!items().length) {
      <div class="panel form-panel">
        Nenhum retorno neste período e situação.
      </div>
    } @else {
      @for (item of items(); track item.id) {
        <article class="panel agenda-card">
          <div>
            <span
              class="status"
              [class.agenda-late]="situation(item) === 'atrasado'"
              >{{ labels[situation(item)] }}</span
            >
            <h2>{{ item.empresa }}</h2>
            <p>
              <strong>{{ day(item.data_prevista) }}</strong> ·
              {{ item.contato }}
            </p>
            <p>{{ item.proximo_passo || item.resumo_resultado }}</p>
            <p class="muted">
              {{ item.funcionario_nome }} · {{ item.responsavel_nome }} · Visita
              #{{ item.visita_id }}
            </p>
          </div>
          <a
            class="button secondary"
            [routerLink]="['/retornos', item.id]"
            [queryParams]="params()"
            >Acompanhar →</a
          >
        </article>
      }
      <div class="pagination">
        <button
          type="button"
          class="button secondary"
          [disabled]="!offset()"
          (click)="page(-1)"
        >
          Anterior</button
        ><span>Página {{ offset() / 20 + 1 }}</span
        ><button
          type="button"
          class="button secondary"
          [disabled]="items().length < 20"
          (click)="page(1)"
        >
          Próxima
        </button>
      </div>
    }
  `,
})
export class ReturnsPage {
  readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private dead = false;
  private generation = 0;
  readonly items = signal<Retorno[]>([]);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly offset = signal(0);
  readonly today = signal(localDay());
  readonly day = dayLabel;
  readonly labels: Record<string, string> = {
    pendente: "Pendente",
    atrasado: "Atrasado",
    hoje: "Hoje",
    realizado: "Realizado",
    cancelado: "Cancelado",
  };
  readonly filters = new FormGroup({
    inicio: new FormControl("", { nonNullable: true }),
    fim: new FormControl("", { nonNullable: true }),
    status: new FormControl("pendente", { nonNullable: true }),
    funcionario_id: new FormControl<number | null>(null),
  });
  constructor() {
    const timer = window.setInterval(() => this.today.set(localDay()), 30000);
    inject(DestroyRef).onDestroy(() => {
      this.dead = true;
      this.generation++;
      window.clearInterval(timer);
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.reset({
        inicio: p.get("inicio") || "",
        fim: p.get("fim") || "",
        status: p.get("status") ?? "pendente",
        funcionario_id: p.get("funcionario_id")
          ? Number(p.get("funcionario_id"))
          : null,
      });
      const offset = Number(p.get("offset") || 0);
      this.offset.set(Number.isSafeInteger(offset) && offset >= 0 ? offset : 0);
      void this.load();
    });
  }
  situation(item: Retorno): string {
    return returnSituation(item, this.today());
  }
  params() {
    const f = this.filters.getRawValue();
    return {
      ...(f.inicio ? { inicio: f.inicio } : {}),
      ...(f.fim ? { fim: f.fim } : {}),
      status: f.status,
      ...(this.session.user?.perfil === "admin" && f.funcionario_id
        ? { funcionario_id: Number(f.funcionario_id) }
        : {}),
      offset: this.offset(),
    };
  }
  apply(): void {
    this.offset.set(0);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.params(),
    });
  }
  page(direction: number): void {
    this.offset.update((n) => Math.max(0, n + 20 * direction));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.params(),
    });
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set("");
    try {
      const p = this.params();
      if (p.inicio && p.fim && p.inicio >= p.fim)
        throw new Error("O fim deve ser posterior ao início.");
      const { offset, status, ...rest } = p;
      const result = await this.api.returns(20, offset, {
        ...rest,
        ...(status ? { status } : {}),
        referencia: this.today(),
      });
      if (!this.dead && generation === this.generation)
        this.items.set(result.items);
    } catch (e) {
      if (!this.dead && generation === this.generation)
        this.error.set(
          e instanceof Error && !("status" in e) ? e.message : errorMessage(e),
        );
    } finally {
      if (!this.dead && generation === this.generation) this.loading.set(false);
    }
  }
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, LocalDatePipe],
  template: `
    <a class="back-link" routerLink="/retornos" [queryParams]="backParams()"
      >← Voltar aos retornos</a
    >
    @if (loading()) {
      <p role="status">Carregando retorno…</p>
    }
    @if (error()) {
      <div class="alert" role="alert">
        {{ error() }}
        <button
          type="button"
          class="text-link"
          [disabled]="saving()"
          (click)="refresh()"
        >
          Atualizar retorno
        </button>
      </div>
    }
    @if (message()) {
      <div class="notice" role="status">{{ message() }}</div>
    }
    @if (item(); as r) {
      <div class="page-heading">
        <div>
          <span class="eyebrow">RETORNO #{{ r.id }}</span>
          <h1>{{ r.empresa }}</h1>
          <p>{{ r.status }} · Previsto para {{ day(r.data_prevista) }}</p>
        </div>
      </div>
      <section class="panel form-panel">
        <dl class="details">
          <dt>Contato</dt>
          <dd>{{ r.contato }}</dd>
          <dt>Origem</dt>
          <dd>
            <a
              class="text-link"
              [routerLink]="['/visitas', r.visita_id]"
              [queryParams]="visitParams()"
              >Visita #{{ r.visita_id }}</a
            >
          </dd>
          <dt>Cliente cadastrado</dt>
          <dd>
            @if (r.cliente_id) {
              <a class="text-link" [routerLink]="['/clientes', r.cliente_id]"
                >Cliente #{{ r.cliente_id }}</a
              >
            } @else {
              Registro em texto
            }
          </dd>
          <dt>Funcionário</dt>
          <dd>{{ r.funcionario_nome }}</dd>
          <dt>Responsável</dt>
          <dd>{{ r.responsavel_nome }}</dd>
          <dt>Resumo do resultado</dt>
          <dd class="description">{{ r.resumo_resultado }}</dd>
          <dt>Próximo passo</dt>
          <dd class="description">{{ r.proximo_passo || "—" }}</dd>
        </dl>
        @if (r.status !== "pendente") {
          <div class="notice">
            {{ r.status === "realizado" ? "Realizado" : "Cancelado" }} por
            {{ r.encerrado_por_nome }} (#{{ r.encerrado_por }}), em
            {{ r.encerrado_em | localDate }}.
            <p>{{ r.observacao }}</p>
          </div>
        }
        @if (r.agendamento_id) {
          <p class="notice">
            Agendamento #{{ r.agendamento_id }} já gerado.
            <a routerLink="/agenda">Consultar agenda</a>. Gerar ou concluir uma
            visita não encerra automaticamente este retorno.
          </p>
        }
      </section>
      @if (canManage()) {
        <section class="panel form-panel">
          <h2>Encerrar acompanhamento</h2>
          <p class="muted">A visita original permanece imutável.</p>
          <form [formGroup]="finishForm" (ngSubmit)="finish()" novalidate>
            <fieldset [disabled]="saving()">
              <div class="field">
                <label for="return-status">Situação *</label
                ><select id="return-status" formControlName="status">
                  <option value="realizado">Realizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div class="field">
                <label for="return-note"
                  >Observação * (até 1000 caracteres)</label
                ><textarea
                  id="return-note"
                  formControlName="observacao"
                  rows="3"
                ></textarea>
              </div>
            </fieldset>
            @if (finishForm.touched && finishForm.invalid) {
              <p class="field-error" role="alert">
                Preencha a observação e selecione a situação.
              </p>
            }
            <button type="submit" class="button primary" [disabled]="saving()">
              {{ saving() ? "Salvando…" : "Confirmar encerramento" }}
            </button>
          </form>
        </section>
        @if (!r.agendamento_id) {
          <section class="panel form-panel">
            <h2>Gerar agendamento</h2>
            <p class="muted">
              Ação explícita: cria um único agendamento com os dados da visita.
              O retorno continuará pendente.
            </p>
            <form (submit)="schedule($event)" novalidate>
              <fieldset [disabled]="saving()">
                <div class="field">
                  <label for="return-schedule-date"
                    >Data e hora prevista * (fuso local)</label
                  ><input
                    id="return-schedule-date"
                    type="datetime-local"
                    [formControl]="date"
                  />
                </div>
              </fieldset>
              <button
                type="submit"
                class="button secondary"
                [disabled]="saving()"
              >
                Gerar agendamento
              </button>
            </form>
          </section>
        }
      }
    }
  `,
})
export class ReturnDetailPage {
  refresh(): void {
    if (
      this.saving() ||
      (this.hasUnsavedChanges() &&
        !window.confirm(
          "Descartar alterações locais e consultar o estado atual do retorno?",
        ))
    )
      return;
    void this.load();
  }
  readonly id = input.required<string>();
  readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private dead = false;
  private generation = 0;
  readonly item = signal<Retorno | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal("");
  readonly message = signal("");
  readonly day = dayLabel;
  readonly finishForm = new FormGroup({
    status: new FormControl<"realizado" | "cancelado">("realizado", {
      nonNullable: true,
      validators: Validators.required,
    }),
    observacao: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(1000)],
    }),
  });
  readonly date = new FormControl("", {
    nonNullable: true,
    validators: Validators.required,
  });
  constructor() {
    warnBeforeUnload(this);
    inject(DestroyRef).onDestroy(() => {
      this.dead = true;
      this.generation++;
    });
    effect(() => {
      this.id();
      untracked(() => void this.load());
    });
  }
  backParams() {
    return this.route.snapshot.queryParams;
  }
  visitParams() {
    return { ...this.backParams(), origem_retorno: this.id() };
  }
  hasUnsavedChanges(): boolean {
    return this.saving() || this.finishForm.dirty || this.date.dirty;
  }
  canManage(): boolean {
    const r = this.item(),
      u = this.session.user;
    return (
      !!r &&
      r.status === "pendente" &&
      (u?.perfil === "admin" ||
        (u?.perfil === "funcionario" && u.id === Number(r.usuario_id)))
    );
  }
  private active(generation: number, id: number): boolean {
    return (
      !this.dead && generation === this.generation && id === Number(this.id())
    );
  }
  async load(): Promise<void> {
    const generation = ++this.generation,
      id = Number(this.id());
    this.loading.set(true);
    this.error.set("");
    this.item.set(null);
    this.message.set("");
    this.saving.set(false);
    this.finishForm.reset();
    this.date.reset();
    try {
      const result = await this.api.followup(id);
      if (this.active(generation, id)) this.item.set(result);
    } catch (e) {
      if (this.active(generation, id)) this.error.set(errorMessage(e));
    } finally {
      if (this.active(generation, id)) this.loading.set(false);
    }
  }
  async finish(): Promise<void> {
    this.finishForm.markAllAsTouched();
    if (
      !this.canManage() ||
      this.finishForm.invalid ||
      this.saving() ||
      !window.confirm("Confirmar encerramento deste retorno?")
    )
      return;
    const generation = this.generation,
      id = Number(this.id());
    this.saving.set(true);
    this.error.set("");
    try {
      const f = this.finishForm.getRawValue();
      const result = await this.api.finishReturn(id, f.status, f.observacao);
      if (!this.active(generation, id)) return;
      this.item.set(result);
      this.finishForm.markAsPristine();
      this.date.markAsPristine();
      this.message.set("Retorno encerrado.");
    } catch (e) {
      if (this.active(generation, id)) this.error.set(errorMessage(e));
    } finally {
      if (this.active(generation, id)) this.saving.set(false);
    }
  }
  async schedule(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canManage() || this.item()?.agendamento_id || this.saving())
      return;
    let date: string;
    try {
      date = toUtc(this.date.value);
      if (new Date(date).getTime() <= Date.now())
        throw new Error("Escolha uma data e hora futura.");
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    if (!window.confirm("Gerar um agendamento e manter o retorno pendente?"))
      return;
    const generation = this.generation,
      id = Number(this.id());
    this.saving.set(true);
    this.error.set("");
    try {
      const agenda = await this.api.scheduleReturn(id, date);
      if (!this.active(generation, id)) return;
      this.item.update((r) =>
        r ? { ...r, agendamento_id: Number(agenda.id) } : r,
      );
      this.date.markAsPristine();
      this.message.set("Agendamento gerado. Retorno continua pendente.");
    } catch (e) {
      if (this.active(generation, id)) this.error.set(errorMessage(e));
    } finally {
      if (this.active(generation, id)) this.saving.set(false);
    }
  }
}
