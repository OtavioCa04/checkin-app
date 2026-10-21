import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Location } from "@angular/common";
import { warnBeforeUnload } from "../unsaved";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterLink } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { Api, errorMessage, fieldErrors } from "../api";
import { Visita, ResultadoVisita } from "../models";
import {
  canEdit,
  LocalDatePipe,
  textForm,
  nonBlank,
  maxCharacters,
} from "../shared";
import { dayLabel, snapshotDetails } from "../customer-shared";
import { Session } from "../session";
import { TextFields } from "../text-fields";
@Component({
  imports: [RouterLink, LocalDatePipe, ReactiveFormsModule, TextFields],
  template: `
    <a class="back-link" [routerLink]="backLink()" [queryParams]="backFilters()"
      >← Voltar</a
    >
    @if (busy()) {
      <div class="state-card" role="status">Carregando visita…</div>
    } @else if (loadError()) {
      <div class="alert" role="alert">
        {{ loadError() }}
        <button class="text-link" (click)="load()">Tentar novamente</button>
      </div>
    } @else if (visit(); as v) {
      <div class="page-heading">
        <div>
          <span class="eyebrow">VISITA #{{ v.id }}</span>
          <h1>{{ v.empresa }}</h1>
          <p class="muted">{{ v.assunto }}</p>
        </div>
        <span class="status large" [class.done]="v.status === 'concluida'">{{
          v.status === "concluida" ? "Concluída" : "Em andamento"
        }}</span>
      </div>
      @if (message()) {
        <div class="notice" role="status">{{ message() }}</div>
      }
      @if (v.agendamento_id) {
        <div class="notice">
          Visita vinculada ao agendamento #{{ v.agendamento_id }}.
          <a routerLink="/agenda">Consultar agenda</a>
        </div>
      }
      @if (error()) {
        <div class="alert" role="alert">
          {{ error() }}
          @for (entry of extraErrors(); track entry) {
            <div>{{ entry }}</div>
          }
        </div>
      }
      <div class="detail-layout">
        <section class="panel form-panel">
          <div class="section-heading">
            <h2>{{ editing() ? "Editar visita" : "Sobre o encontro" }}</h2>
            @if (editable() && !editing()) {
              <button class="button secondary compact" (click)="startEdit()">
                Editar dados
              </button>
            }
          </div>
          @if (editing()) {
            <form [formGroup]="form" (submit)="handleSubmit($event)" novalidate>
              <fieldset [disabled]="saving()">
                <visit-text-fields [form]="form" [errors]="errors()" />
              </fieldset>
              <div class="form-actions">
                <button
                  class="button secondary"
                  type="button"
                  [disabled]="saving()"
                  (click)="cancelEdit()"
                >
                  Cancelar edição</button
                ><button
                  class="button primary"
                  type="submit"
                  [disabled]="saving()"
                >
                  {{ saving() ? "Salvando…" : "Salvar alterações" }}
                </button>
              </div>
            </form>
          } @else {
            <dl class="details">
              <dt>Contato</dt>
              <dd>{{ v.contato }}</dd>
              <dt>Empresa</dt>
              <dd>{{ v.empresa }}</dd>
              <dt>Assunto</dt>
              <dd>{{ v.assunto }}</dd>
              <dt>Descrição</dt>
              <dd class="description">{{ v.descricao }}</dd>
              @if (snapshot(v.cadastro_snapshot)) {
                <dt>Retrato cadastral no check-in</dt>
                <dd class="description">{{ snapshot(v.cadastro_snapshot) }}</dd>
              }
              @if (v.resultado) {
                <dt>Resultado</dt>
                <dd>{{ resultLabels[v.resultado] }}</dd>
                <dt>Resumo</dt>
                <dd class="description">{{ v.resumo_resultado }}</dd>
                <dt>Próximo passo</dt>
                <dd class="description">{{ v.proximo_passo || "—" }}</dd>
                <dt>Retorno previsto</dt>
                <dd>{{ day(v.data_retorno) }}</dd>
              }
            </dl>
          }
          @if (v.status === "concluida") {
            <div class="closed-note">
              <span aria-hidden="true">✓</span> Esta visita foi concluída e está
              disponível apenas para consulta.
            </div>
          } @else if (editable() && !editing()) {
            <div class="complete-section">
              <div>
                <h3>Encontro finalizado?</h3>
                <p class="muted">
                  A conclusão registra o checkout e encerra as edições.
                </p>
              </div>
              @if (!confirming()) {
                <button
                  class="button primary"
                  [disabled]="saving()"
                  (click)="confirming.set(true)"
                >
                  Concluir visita ✓
                </button>
              } @else {
                <div
                  class="confirm-box"
                  role="group"
                  aria-label="Confirmar conclusão"
                >
                  <p>Concluir esta visita? Você não poderá editá-la depois.</p>
                  <form
                    [formGroup]="resultForm"
                    (submit)="completeSubmit($event)"
                    novalidate
                  >
                    <fieldset [disabled]="saving()">
                      <div class="field">
                        <label for="visit-result">Resultado *</label
                        ><select id="visit-result" formControlName="resultado">
                          <option value="">Selecione</option>
                          <option value="realizada">Realizada</option>
                          <option value="sem_contato">Sem contato</option>
                          <option value="reagendar">Reagendar</option>
                          <option value="cancelada">Cancelada</option>
                        </select>
                      </div>
                      <div class="field">
                        <label for="visit-summary"
                          >Resumo do resultado * (até 10000 caracteres)</label
                        ><textarea
                          id="visit-summary"
                          formControlName="resumo_resultado"
                          rows="3"
                        ></textarea>
                      </div>
                      <div class="field">
                        <label for="visit-next"
                          >Próximo passo (opcional, até 10000 caracteres)</label
                        ><textarea
                          id="visit-next"
                          formControlName="proximo_passo"
                          rows="2"
                        ></textarea>
                      </div>
                      <div class="field">
                        <label for="visit-return"
                          >Dia previsto de retorno (opcional)</label
                        ><input
                          id="visit-return"
                          type="date"
                          formControlName="data_retorno"
                        /><small
                          >Dia de calendário, sem conversão de fuso. Cria uma
                          pendência separada.</small
                        >
                      </div>
                    </fieldset>
                    @if (resultForm.touched && resultForm.invalid) {
                      <p class="field-error" role="alert">
                        Selecione o resultado e preencha o resumo. Limite de
                        10000 caracteres por texto.
                      </p>
                    }
                    <button
                      type="button"
                      class="button secondary compact"
                      [disabled]="saving()"
                      (click)="confirming.set(false)"
                    >
                      Voltar</button
                    ><button
                      type="button"
                      class="button primary compact"
                      [disabled]="saving()"
                      (click)="complete()"
                    >
                      {{ saving() ? "Concluindo…" : "Confirmar conclusão" }}
                    </button>
                  </form>
                </div>
              }
            </div>
          }
        </section>
        <aside class="panel detail-meta">
          <h2>Registro da visita</h2>
          <div class="timeline">
            <div>
              <span class="timeline-dot"></span><small>CHECK-IN</small
              ><strong>{{ v.data_hora_checkin | localDate }}</strong>
            </div>
            <div>
              <span
                class="timeline-dot"
                [class.waiting]="!v.data_hora_checkout"
              ></span
              ><small>CHECKOUT</small
              ><strong>{{
                v.data_hora_checkout
                  ? (v.data_hora_checkout | localDate)
                  : "Ainda em andamento"
              }}</strong>
            </div>
          </div>
          <hr />
          <h3>Localização registrada</h3>
          <dl class="gps-data">
            <dt>Latitude</dt>
            <dd>{{ v.latitude }}</dd>
            <dt>Longitude</dt>
            <dd>{{ v.longitude }}</dd>
            <dt>Precisão</dt>
            <dd>{{ v.precisao_gps }} m</dd>
          </dl>
          <hr />
          <dl class="gps-data">
            <dt>Funcionário</dt>
            <dd>
              {{ v.funcionario_nome || "Funcionário" }} (#{{ v.usuario_id }})
            </dd>
            <dt>Responsável</dt>
            <dd>
              {{ v.responsavel_nome || "Responsável" }} (#{{
                v.responsavel_id
              }})
            </dd>
          </dl>
          <small class="gps-note"
            >Horários exibidos no fuso deste dispositivo.</small
          >
        </aside>
      </div>
    }
  `,
})
export class DetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  readonly visit = signal<Visita | null>(null);
  readonly busy = signal(true);
  readonly loadError = signal("");
  readonly error = signal("");
  readonly message = signal("");
  readonly editing = signal(false);
  readonly confirming = signal(false);
  readonly saving = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly form = textForm();
  readonly day = dayLabel;
  readonly snapshot = snapshotDetails;
  readonly resultLabels: Record<ResultadoVisita, string> = {
    realizada: "Realizada",
    sem_contato: "Sem contato",
    reagendar: "Reagendar",
    cancelada: "Cancelada",
  };
  readonly resultForm = new FormGroup({
    resultado: new FormControl<ResultadoVisita | "">("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    resumo_resultado: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(10000)],
    }),
    proximo_passo: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(10000)],
    }),
    data_retorno: new FormControl("", { nonNullable: true }),
  });
  private generation = 0;
  private destroyed = false;
  private creationNotice: Record<string, unknown> | null;
  constructor() {
    this.creationNotice =
      this.router.getCurrentNavigation()?.extras.state ??
      (this.location.getState() as Record<string, unknown>);
    warnBeforeUnload(this);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.generation++;
    });
    effect(() => {
      this.id();
      void this.load();
    });
  }
  backFilters() {
    const { origem_cliente, origem_retorno, ...rest } =
      this.route.snapshot.queryParams;
    return rest;
  }
  backLink(): string | unknown[] {
    const p = this.route.snapshot.queryParams;
    for (const [key, path] of [
      ["origem_cliente", "clientes"],
      ["origem_retorno", "retornos"],
    ]) {
      if (/^[1-9][0-9]{0,9}$/.test(p[key] || "")) return ["/" + path, p[key]];
    }
    return "/visitas";
  }
  hasUnsavedChanges(): boolean {
    return (
      this.saving() ||
      (this.editing() && this.form.dirty) ||
      (this.confirming() && this.resultForm.dirty)
    );
  }
  private active(generation: number, id: number): boolean {
    return (
      !this.destroyed &&
      generation === this.generation &&
      Number(this.id()) === id
    );
  }
  editable(): boolean {
    const visit = this.visit();
    return (
      !this.busy() &&
      !!visit &&
      Number(visit.id) === Number(this.id()) &&
      canEdit(this.session.user, visit)
    );
  }
  extraErrors(): string[] {
    return Object.entries(this.errors())
      .filter(
        ([key]) =>
          !["contato", "empresa", "assunto", "descricao"].includes(key),
      )
      .map(([, value]) => value);
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    const id = Number(this.id());
    this.busy.set(true);
    this.visit.set(null);
    this.loadError.set("");
    this.error.set("");
    this.errors.set({});
    this.message.set("");
    this.saving.set(false);
    this.editing.set(false);
    this.confirming.set(false);
    this.form.reset();
    this.resultForm.reset();
    this.form.controls.empresa.enable();
    this.form.controls.contato.enable();
    const notice = this.creationNotice;
    this.creationNotice = null;
    try {
      if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
        throw new HttpErrorResponse({ status: 404 });
      }
      const visit = await this.api.visit(id);
      if (!this.active(generation, id)) {
        return;
      }
      this.visit.set(visit);
      if (
        notice?.["createdVisitId"] === id &&
        notice["message"] === "Check-in registrado com sucesso"
      ) {
        this.message.set("Check-in registrado com sucesso");
        const state = {
          ...(this.location.getState() as Record<string, unknown>),
        };
        delete state["createdVisitId"];
        delete state["message"];
        this.location.replaceState(this.location.path(), "", state);
      }
    } catch (error) {
      if (this.active(generation, id)) {
        this.loadError.set(errorMessage(error));
      }
    } finally {
      if (this.active(generation, id)) {
        this.busy.set(false);
      }
    }
  }
  startEdit(): void {
    const visit = this.visit();
    if (!visit || !this.editable() || this.saving()) {
      return;
    }
    this.form.reset({
      contato: visit.contato,
      empresa: visit.empresa,
      assunto: visit.assunto,
      descricao: visit.descricao,
    });
    if (visit.cliente_id) this.form.controls.empresa.disable();
    if (visit.contato_id) this.form.controls.contato.disable();
    this.error.set("");
    this.errors.set({});
    this.message.set("");
    this.confirming.set(false);
    this.editing.set(true);
  }
  cancelEdit(): void {
    if (
      this.form.dirty &&
      !window.confirm("Descartar as alterações não salvas?")
    ) {
      return;
    }
    this.editing.set(false);
    this.form.markAsPristine();
    this.error.set("");
    this.errors.set({});
  }
  handleSubmit(event: Event): void {
    event.preventDefault();
    void this.save();
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.editable() || this.saving()) {
      return;
    }
    await this.patch(this.form.getRawValue(), "Alterações salvas.");
  }
  async complete(): Promise<void> {
    if (!this.confirming() || !this.editable() || this.saving()) {
      return;
    }
    this.resultForm.markAllAsTouched();
    if (this.resultForm.invalid) return;
    const f = this.resultForm.getRawValue();
    await this.patch(
      {
        status: "concluida",
        resultado: f.resultado as ResultadoVisita,
        resumo_resultado: f.resumo_resultado,
        proximo_passo: f.proximo_passo,
        data_retorno: f.data_retorno || null,
      },
      "Visita concluída com sucesso.",
    );
  }
  completeSubmit(event: Event): void {
    event.preventDefault();
    void this.complete();
  }
  private async patch(
    data: Parameters<Api["update"]>[1],
    message: string,
  ): Promise<void> {
    const visit = this.visit();
    if (!visit) {
      return;
    }
    const generation = this.generation;
    const id = Number(visit.id);
    this.saving.set(true);
    this.error.set("");
    this.errors.set({});
    try {
      const updated = await this.api.update(id, data);
      if (!this.active(generation, id)) {
        return;
      }
      this.visit.set(updated);
      this.message.set(message);
      this.editing.set(false);
      this.confirming.set(false);
      this.form.markAsPristine();
      this.resultForm.markAsPristine();
    } catch (error) {
      if (!this.active(generation, id)) {
        return;
      }
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const reloadGeneration = this.generation + 1;
        await this.load();
        if (this.active(reloadGeneration, id)) {
          this.error.set(errorMessage(error));
        }
      } else {
        this.error.set(errorMessage(error));
        this.errors.set(fieldErrors(error));
      }
    } finally {
      if (this.active(generation, id)) {
        this.saving.set(false);
      }
    }
  }
}
