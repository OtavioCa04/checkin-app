import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Api, errorMessage, fieldErrors } from "../api";
import { Agendamento, AgendaOptions, ClienteSelection } from "../models";
import { CustomerPicker } from "../customer-picker";
import { Session } from "../session";
import { LocalDatePipe, maxCharacters, nonBlank, utcDate } from "../shared";
import { agendaRange, agendaStatus, localInput, toUtc } from "../agenda-dates";
import { warnBeforeUnload } from "../unsaved";

@Component({
  imports: [ReactiveFormsModule, RouterLink, LocalDatePipe, CustomerPicker],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">PLANEJAMENTO EM CAMPO</span>
        <h1>Agenda de visitas</h1>
        <p class="muted">
          Organize o próximo encontro e acompanhe os horários previstos.
        </p>
      </div>
      @if (canCreate()) {
        <button
          type="button"
          class="button primary"
          [disabled]="saving() || !!editor()"
          (click)="newItem()"
        >
          ＋ Agendar visita
        </button>
      }
    </div>
    @if (message()) {
      <div class="notice" role="status">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert" role="alert">{{ error() }}</div>
    }
    <form
      [formGroup]="filters"
      (ngSubmit)="apply()"
      class="panel form-panel agenda-filters"
    >
      <div class="field">
        <label for="agenda-view">Visualização</label
        ><select id="agenda-view" formControlName="modo">
          <option value="dia">Dia</option>
          <option value="semana">Semana (segunda a domingo)</option>
          <option value="periodo">Período livre</option>
        </select>
      </div>
      @if (filters.controls.modo.value !== "periodo") {
        <div class="field">
          <label for="agenda-day">Dia de referência</label
          ><input id="agenda-day" type="date" formControlName="dia" />
        </div>
      } @else {
        <div class="field">
          <label for="agenda-from">De (incluído)</label
          ><input
            id="agenda-from"
            type="datetime-local"
            formControlName="inicio"
          />
        </div>
        <div class="field">
          <label for="agenda-to">Até (excluído)</label
          ><input id="agenda-to" type="datetime-local" formControlName="fim" />
        </div>
      }
      <div class="field">
        <label for="agenda-status">Situação</label
        ><select id="agenda-status" formControlName="status">
          <option value="">Todas</option>
          <option value="pendente">Pendente (inclui atrasados)</option>
          <option value="atrasado">Atrasado</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      @if (session.user?.perfil === "admin") {
        <div class="field">
          <label for="agenda-employee">Funcionário</label
          ><select id="agenda-employee" formControlName="funcionario_id">
            <option [ngValue]="null">Todos</option>
            @for (u of options().funcionarios; track u.id) {
              <option [ngValue]="u.id">{{ u.nome }}</option>
            }
          </select>
        </div>
      }
      <button type="submit" class="button secondary" [disabled]="saving()">
        Aplicar filtros
      </button>
    </form>
    @if (canCreate() && optionsError()) {
      <div class="alert" role="alert">
        {{ optionsError() }}
        <button class="text-link" type="button" (click)="loadOptions()">
          Recarregar opções
        </button>
      </div>
    }
    @if (editor(); as mode) {
      <section class="panel form-panel agenda-editor">
        <h2>
          {{
            mode === "novo"
              ? "Agendar visita"
              : mode === "reagendar"
                ? "Reagendar visita"
                : mode === "responsavel"
                  ? "Trocar responsável"
                  : "Cancelar agendamento"
          }}
        </h2>
        @if (selected(); as item) {
          <p>{{ item.empresa }} · {{ item.data_hora_prevista | localDate }}</p>
        }
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          @if (mode === "novo" && loadingOptions()) {
            <p role="status">Carregando funcionários e responsáveis ativos…</p>
          }
          @if (
            mode === "novo" &&
            !loadingOptions() &&
            !optionsError() &&
            (!options().funcionarios.length || !options().responsaveis.length)
          ) {
            <div class="notice">
              É necessário ter um funcionário e um responsável ativos para
              agendar. Solicite apoio ao administrador.
            </div>
          }
          <fieldset [disabled]="saving()">
            @if (mode === "novo") {
              <customer-picker
                [preset]="selection()"
                [disabled]="saving()"
                (selected)="chooseCustomer($event)"
              />
              <div class="form-grid">
                <div class="field">
                  <label for="schedule-company">Empresa *</label
                  ><input id="schedule-company" formControlName="empresa" />
                </div>
                <div class="field">
                  <label for="schedule-contact">Contato *</label
                  ><input id="schedule-contact" formControlName="contato" />
                </div>
                <div class="field">
                  <label for="schedule-subject">Assunto *</label
                  ><input id="schedule-subject" formControlName="assunto" />
                </div>
                <div class="field">
                  <label for="schedule-user">Funcionário *</label
                  ><select id="schedule-user" formControlName="usuario_id">
                    <option [ngValue]="null">Selecione</option>
                    @for (u of options().funcionarios; track u.id) {
                      <option [ngValue]="u.id">{{ u.nome }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label for="schedule-resp">Responsável *</label
                  ><select id="schedule-resp" formControlName="responsavel_id">
                    <option [ngValue]="null">Selecione</option>
                    @for (r of options().responsaveis; track r.id) {
                      <option [ngValue]="r.id">{{ r.nome }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="schedule-notes">Observações (opcional)</label
                ><textarea
                  id="schedule-notes"
                  formControlName="observacoes"
                  rows="3"
                ></textarea>
              </div>
            }
            @if (mode === "responsavel") {
              <div class="field">
                <label for="schedule-new-resp">Novo responsável *</label
                ><select id="schedule-new-resp" formControlName="responsavel_id">
                  <option [ngValue]="null">Selecione</option>
                  @for (r of options().responsaveis; track r.id) {
                    @if (r.id !== Number(selected()?.responsavel_id)) {
                      <option [ngValue]="r.id">{{ r.nome }}</option>
                    }
                  }
                </select>
              </div>
            }
            @if (mode === "novo" || mode === "reagendar") {
              <div class="field">
                <label for="schedule-date"
                  >Data e hora prevista * (seu fuso local)</label
                ><input
                  id="schedule-date"
                  type="datetime-local"
                  formControlName="data"
                />
              </div>
            }
            @if (mode !== "novo") {
              <div class="field">
                <label for="schedule-reason"
                  >Motivo * (até 1000 caracteres)</label
                ><textarea
                  id="schedule-reason"
                  formControlName="motivo"
                  rows="3"
                ></textarea>
              </div>
            }
            @if (form.touched && invalidVisible()) {
              <div class="alert" role="alert">
                Revise os campos obrigatórios. Limites: empresa 180, contato
                150, assunto 200, observações 10000 e motivo 1000 caracteres.
              </div>
            }
            @for (entry of errors(); track $index) {
              <div class="field-error" role="alert">{{ entry }}</div>
            }
          </fieldset>
          <div class="form-actions">
            <button
              type="button"
              class="button secondary"
              [disabled]="saving()"
              (click)="closeEditor()"
            >
              Voltar</button
            ><button
              type="submit"
              class="button primary"
              [disabled]="saving() || loadingOptions() || !!optionsError()"
            >
              {{
                saving()
                  ? "Salvando…"
                  : mode === "cancelar"
                    ? "Confirmar cancelamento"
                    : mode === "responsavel"
                      ? "Salvar responsável"
                      : "Salvar agendamento"
              }}
            </button>
          </div>
        </form>
      </section>
    }
    @if (loading()) {
      <div class="panel form-panel" role="status">Carregando agenda…</div>
    } @else if (listError()) {
      <div class="alert" role="alert">
        {{ listError() }}
        <button type="button" class="text-link" (click)="load()">
          Tentar novamente
        </button>
      </div>
    } @else if (!items().length) {
      <div class="panel form-panel">
        Nenhum agendamento neste período e situação.
      </div>
    } @else {
      @for (group of groups(); track group.day) {
        <section class="agenda-day">
          <h2>{{ group.day }}</h2>
          @for (item of group.items; track item.id) {
            <article class="panel agenda-card">
              <div>
                <span
                  class="status"
                  [class.agenda-late]="status(item) === 'atrasado'"
                  >{{ labels[status(item)] }}</span
                >
                <h3>{{ item.empresa }}</h3>
                <p>
                  <strong>{{ item.data_hora_prevista | localDate }}</strong> ·
                  {{ item.assunto }}
                </p>
                <p class="muted">Contato: {{ item.contato }}</p>
                <p class="muted">
                  Funcionário: {{ item.funcionario_nome }} · Responsável:
                  {{ item.responsavel_nome }}
                </p>
                <p class="agenda-notes">{{ item.observacoes }}</p>
              </div>
              <div class="agenda-actions">
                @if (canManage(item) && item.status === "pendente") {
                  <button
                    type="button"
                    class="button secondary"
                    [disabled]="saving()"
                    (click)="edit(item, 'reagendar')"
                  >
                    Reagendar</button
                  ><button
                    type="button"
                    class="button secondary"
                    [disabled]="saving()"
                    (click)="edit(item, 'cancelar')"
                  >
                    Cancelar</button
                  ><button
                    type="button"
                    class="button secondary"
                    [disabled]="saving()"
                    (click)="edit(item, 'responsavel')"
                  >
                    Trocar responsável
                  </button>
                }
                @if (canStart(item)) {
                  <a
                    class="button primary"
                    routerLink="/nova-visita"
                    [queryParams]="{ agendamento_id: item.id }"
                    >Iniciar visita com GPS ↗</a
                  >
                }
                @if (item.visita_id) {
                  <a
                    class="button secondary"
                    [routerLink]="['/visitas', item.visita_id]"
                    >Consultar visita</a
                  >
                }
                <button
                  type="button"
                  class="text-link"
                  [disabled]="historyLoading()"
                  (click)="history(item)"
                >
                  Ver histórico
                </button>
              </div>
            </article>
          }
        </section>
      }
      <div class="pagination">
        <button
          type="button"
          class="button secondary"
          [disabled]="offset() === 0"
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
    @if (historyLoading()) {
      <p role="status">Carregando histórico…</p>
    }
    @if (historyItem(); as item) {
      <section class="panel form-panel">
        <h2>Histórico · {{ item.empresa }}</h2>
        <button type="button" class="text-link" (click)="historyItem.set(null)">
          Fechar histórico
        </button>
        @for (event of item.eventos; track event.id) {
          <p>
            <strong>{{ event.acao }}</strong> · {{ event.autor_nome }} ·
            {{ event.criado_em | localDate }}<br />{{ event.motivo }}
            @if (event.data_anterior) {
              <br />Anterior: {{ event.data_anterior | localDate }}
              @if (event.data_nova) {
                <br />Previsto: {{ event.data_nova | localDate }}
              }
            }
          </p>
        }
      </section>
    }
  `,
})
export class AgendaPage {
  readonly selection = signal<ClienteSelection | null>(null);
  chooseCustomer(value: ClienteSelection): void {
    if (this.saving()) return;
    this.selection.set(value);
    if (value.empresa) this.form.controls.empresa.setValue(value.empresa);
    if (value.contato) this.form.controls.contato.setValue(value.contato);
    value.cliente_id
      ? this.form.controls.empresa.disable()
      : this.form.controls.empresa.enable();
    value.contato_id
      ? this.form.controls.contato.disable()
      : this.form.controls.contato.enable();
    this.form.markAsDirty();
  }
  readonly session = inject(Session);
  private readonly api = inject(Api);
  private destroyed = false;
  private generation = 0;
  readonly items = signal<Agendamento[]>([]);
  readonly options = signal<AgendaOptions>({
    funcionarios: [],
    responsaveis: [],
  });
  readonly loadingOptions = signal(false);
  readonly optionsError = signal("");
  readonly loading = signal(false);
  readonly listError = signal("");
  readonly error = signal("");
  readonly message = signal("");
  readonly saving = signal(false);
  readonly offset = signal(0);
  readonly errors = signal<string[]>([]);
  readonly selected = signal<Agendamento | null>(null);
  readonly editor = signal<
    "novo" | "reagendar" | "cancelar" | "responsavel" | null
  >(null);
  readonly Number = Number;
  readonly historyItem = signal<Agendamento | null>(null);
  readonly historyLoading = signal(false);
  readonly now = signal(Date.now());
  readonly labels: Record<string, string> = {
    pendente: "Pendente",
    atrasado: "Atrasado",
    realizado: "Realizado",
    cancelado: "Cancelado",
  };
  readonly filters = new FormGroup({
    modo: new FormControl("semana", { nonNullable: true }),
    dia: new FormControl(localInput(new Date()).slice(0, 10), {
      nonNullable: true,
    }),
    inicio: new FormControl("", { nonNullable: true }),
    fim: new FormControl("", { nonNullable: true }),
    status: new FormControl("", { nonNullable: true }),
    funcionario_id: new FormControl<number | null>(null),
  });
  readonly form = new FormGroup({
    empresa: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(180)],
    }),
    contato: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(150)],
    }),
    assunto: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(200)],
    }),
    observacoes: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(10000)],
    }),
    usuario_id: new FormControl<number | null>(null, Validators.required),
    responsavel_id: new FormControl<number | null>(null, Validators.required),
    data: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    motivo: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(1000)],
    }),
  });
  constructor() {
    warnBeforeUnload(this);
    const timer = window.setInterval(() => this.now.set(Date.now()), 30000);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.generation++;
      window.clearInterval(timer);
    });
    if (this.canCreate()) {
      void this.loadOptions();
    }
    void this.load();
  }
  canCreate(): boolean {
    return ["funcionario", "admin"].includes(this.session.user?.perfil || "");
  }
  canManage(item: Agendamento): boolean {
    const u = this.session.user;
    return (
      u?.perfil === "admin" ||
      (u?.perfil === "funcionario" && Number(item.usuario_id) === u.id)
    );
  }
  canStart(item: Agendamento): boolean {
    const u = this.session.user;
    return (
      item.status === "pendente" &&
      u?.perfil === "funcionario" &&
      Number(item.usuario_id) === u.id
    );
  }
  status(item: Agendamento): string {
    return agendaStatus(item, this.now());
  }
  groups(): { day: string; items: Agendamento[] }[] {
    const groups = new Map<string, Agendamento[]>();
    for (const item of this.items()) {
      const day = utcDate(item.data_hora_prevista).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const list = groups.get(day) || [];
      list.push(item);
      groups.set(day, list);
    }
    return [...groups].map(([day, items]) => ({ day, items }));
  }
  hasUnsavedChanges(): boolean {
    return this.saving() || (!!this.editor() && this.form.dirty);
  }
  async loadOptions(): Promise<void> {
    if (this.loadingOptions()) return;
    this.loadingOptions.set(true);
    this.optionsError.set("");
    try {
      const options = await this.api.agendaOptions();
      if (!this.destroyed) this.options.set(options);
    } catch (e) {
      if (!this.destroyed) this.optionsError.set(errorMessage(e));
    } finally {
      if (!this.destroyed) this.loadingOptions.set(false);
    }
  }
  apply(): void {
    this.offset.set(0);
    void this.load();
  }
  page(direction: number): void {
    this.offset.update((n) => Math.max(0, n + 20 * direction));
    void this.load();
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.listError.set("");
    try {
      const f = this.filters.getRawValue();
      const range =
        f.modo === "periodo"
          ? { inicio: toUtc(f.inicio), fim: toUtc(f.fim) }
          : agendaRange(f.dia, f.modo);
      if (range.inicio >= range.fim)
        throw new Error("O fim deve ser posterior ao início.");
      const result = await this.api.agenda(20, this.offset(), {
        ...range,
        ...(f.status ? { status: f.status } : {}),
        ...(this.session.user?.perfil === "admin" && f.funcionario_id
          ? { funcionario_id: Number(f.funcionario_id) }
          : {}),
      });
      if (!this.destroyed && generation === this.generation)
        this.items.set(result.items);
    } catch (e) {
      if (!this.destroyed && generation === this.generation)
        this.listError.set(
          e instanceof Error && !("status" in e) ? e.message : errorMessage(e),
        );
    } finally {
      if (!this.destroyed && generation === this.generation)
        this.loading.set(false);
    }
  }
  newItem(): void {
    if (this.saving() || !this.canCreate()) return;
    if (!this.closeEditor()) return;
    this.form.reset({
      usuario_id:
        this.session.user?.perfil === "funcionario"
          ? this.session.user!.id
          : null,
    });
    this.editor.set("novo");
    this.error.set("");
    this.errors.set([]);
  }
  edit(item: Agendamento, mode: "reagendar" | "cancelar" | "responsavel"): void {
    if (
      this.saving() ||
      !this.canManage(item) ||
      item.status !== "pendente" ||
      !this.closeEditor()
    )
      return;
    this.selected.set(item);
    this.form.reset({ data: localInput(utcDate(item.data_hora_prevista)) });
    this.editor.set(mode);
    this.error.set("");
    this.errors.set([]);
  }
  closeEditor(): boolean {
    if (this.saving()) return false;
    if (
      this.editor() &&
      this.form.dirty &&
      !window.confirm("Descartar alterações não salvas?")
    )
      return false;
    this.editor.set(null);
    this.selection.set(null);
    this.form.controls.empresa.enable();
    this.form.controls.contato.enable();
    this.selected.set(null);
    this.form.markAsPristine();
    return true;
  }
  invalidVisible(): boolean {
    const c = this.form.controls;
    return this.editor() === "novo"
      ? [
          c.empresa,
          c.contato,
          c.assunto,
          c.observacoes,
          c.usuario_id,
          c.responsavel_id,
          c.data,
        ].some((x) => x.invalid)
      : c.motivo.invalid ||
          (this.editor() === "reagendar" && c.data.invalid) ||
          (this.editor() === "responsavel" && c.responsavel_id.invalid);
  }
  async save(): Promise<void> {
    if (this.saving() || !this.editor()) return;
    this.form.markAllAsTouched();
    this.error.set("");
    this.errors.set([]);
    if (this.invalidVisible()) return;
    const f = this.form.getRawValue(),
      mode = this.editor()!;
    let date = "";
    try {
      if (mode === "novo" || mode === "reagendar") {
        date = toUtc(f.data);
        if (new Date(date).getTime() <= Date.now())
          throw new Error("Escolha uma data e hora futura.");
      }
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    this.saving.set(true);
    try {
      if (mode === "novo")
        await this.api.createSchedule({
          ...(this.selection()?.cliente_id
            ? { cliente_id: Number(this.selection()!.cliente_id) }
            : {}),
          ...(this.selection()?.contato_id
            ? { contato_id: Number(this.selection()!.contato_id) }
            : {}),
          empresa: f.empresa,
          contato: f.contato,
          assunto: f.assunto,
          observacoes: f.observacoes,
          usuario_id: Number(f.usuario_id),
          responsavel_id: Number(f.responsavel_id),
          data_hora_prevista: date,
        });
      else
        await this.api.changeSchedule(Number(this.selected()!.id), {
          acao: mode === "responsavel" ? "trocar_responsavel" : mode,
          motivo: f.motivo,
          ...(mode === "reagendar" ? { data_hora_prevista: date } : {}),
          ...(mode === "responsavel"
            ? { responsavel_id: Number(f.responsavel_id) }
            : {}),
        });
      if (this.destroyed) return;
      this.form.markAsPristine();
      this.editor.set(null);
      this.selected.set(null);
      this.message.set(
        mode === "cancelar"
          ? "Agendamento cancelado."
          : mode === "reagendar"
            ? "Visita reagendada."
            : mode === "responsavel"
              ? "Responsável alterado."
              : "Agendamento criado.",
      );
      this.offset.set(0);
      await this.load();
    } catch (e) {
      if (!this.destroyed) {
        this.error.set(errorMessage(e));
        this.errors.set(Object.values(fieldErrors(e)));
      }
    } finally {
      if (!this.destroyed) this.saving.set(false);
    }
  }
  async history(item: Agendamento): Promise<void> {
    if (this.historyLoading()) return;
    this.historyLoading.set(true);
    this.historyItem.set(null);
    try {
      const result = await this.api.schedule(Number(item.id));
      if (!this.destroyed) this.historyItem.set(result);
    } catch (e) {
      if (!this.destroyed) this.error.set(errorMessage(e));
    } finally {
      if (!this.destroyed) this.historyLoading.set(false);
    }
  }
}
