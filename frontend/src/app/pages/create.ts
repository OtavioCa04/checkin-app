import { Component, DestroyRef, inject, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage, fieldErrors } from "../api";
import { Coordinates, freshCoordinates, locate, textForm } from "../shared";
import { Agendamento, NewVisit, Responsavel } from "../models";
import { warnBeforeUnload } from "../unsaved";
import { HttpErrorResponse } from "@angular/common/http";
import { TextFields } from "../text-fields";
@Component({
  imports: [ReactiveFormsModule, RouterLink, TextFields],
  template: `
    <a routerLink="/visitas" class="back-link">← Voltar às visitas</a>
    <div class="page-heading">
      <div>
        <span class="eyebrow">REGISTRO EM CAMPO</span>
        <h1>Novo check-in</h1>
        <p class="muted">
          Registre o encontro. O horário oficial será definido ao salvar.
        </p>
      </div>
      <span class="step-badge">01 / REGISTRAR VISITA</span>
    </div>
    @if (scheduleLoading()) {
      <div class="notice" role="status">Carregando agendamento…</div>
    }
    @if (scheduleError()) {
      <div class="alert" role="alert">
        {{ scheduleError() }} <a routerLink="/agenda">Voltar à agenda</a>
      </div>
    }
    @if (scheduled(); as item) {
      <div class="notice">
        Visita do agendamento #{{ item.id }} · {{ item.empresa }}. O responsável
        permanece vinculado ao planejamento.
        <a routerLink="/agenda">Consultar agenda</a>
      </div>
    }
    <form
      [formGroup]="form"
      (submit)="handleSubmit($event)"
      (keydown.enter)="handleEnter($event)"
      novalidate
      class="create-layout"
    >
      <section class="panel form-panel">
        <div class="section-heading">
          <h2>Dados da visita</h2>
          <small class="muted">* Campos obrigatórios</small>
        </div>
        @if (error()) {
          <div class="alert" role="alert">
            {{ error() }}
            @for (entry of extraErrors(); track entry) {
              <div>{{ entry }}</div>
            }
          </div>
        }
        @if (registeredVisit(); as id) {
          <div class="notice" role="status">
            Check-in registrado com sucesso.
            <a class="text-link" [routerLink]="['/visitas', id]"
              >Abrir visita →</a
            >
          </div>
        }
        @if (pending() && !saving()) {
          <div class="notice" role="status">
            O resultado da tentativa anterior ficou incerto. Ela pode ter sido
            registrada. Alterações feitas agora não serão enviadas na
            recuperação.<button
              type="button"
              class="button secondary full"
              [disabled]="saving()"
              (click)="recover()"
            >
              Recuperar tentativa original
            </button>
          </div>
        }
        <fieldset [disabled]="saving()">
          <visit-text-fields [form]="form" [errors]="errors()" />
          <div class="field">
            <label for="responsavel"
              >Responsável pelo acompanhamento
              <span aria-hidden="true">*</span></label
            >
            @if (loadingResponsibles()) {
              <p role="status">Carregando responsáveis…</p>
            } @else if (responsibleError()) {
              <div class="alert" role="alert">
                {{ responsibleError() }}
                <button
                  class="text-link"
                  type="button"
                  (click)="loadResponsibles()"
                >
                  Tentar novamente
                </button>
              </div>
            } @else if (!responsibles().length) {
              <div class="notice">
                Nenhum responsável ativo disponível. Solicite apoio ao
                administrador.
              </div>
            } @else {
              <select
                id="responsavel"
                [formControl]="responsible"
                [attr.aria-invalid]="
                  (responsible.touched && responsible.invalid) ||
                  !!errors()['responsavel_id']
                "
                aria-describedby="responsavel-error"
              >
                <option [ngValue]="null">Selecione um responsável</option>
                @for (r of responsibles(); track r.id) {
                  <option [ngValue]="r.id">{{ r.nome }}</option>
                }
              </select>
            }
            @if (
              (responsible.touched && responsible.invalid) ||
              errors()["responsavel_id"]
            ) {
              <small class="field-error" id="responsavel-error">{{
                errors()["responsavel_id"] || "Selecione um responsável ativo."
              }}</small>
            }
          </div>
        </fieldset>
        <div class="form-actions">
          <a class="button secondary" routerLink="/visitas">Cancelar</a
          ><button
            class="button primary"
            type="button"
            data-testid="register-checkin"
            (click)="handleSubmit($event)"
            [disabled]="
              saving() ||
              scheduleLoading() ||
              !!scheduleError() ||
              registeredVisit() !== null ||
              locating() ||
              loadingResponsibles() ||
              !!responsibleError() ||
              !responsibles().length
            "
          >
            {{ saving() ? "Registrando…" : "Registrar check-in" }}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
      <aside class="panel gps-panel">
        <span class="gps-symbol" aria-hidden="true">◎</span>
        <h2>Localização da visita</h2>
        <p class="muted">
          Capture sua posição atual para registrar o check-in.
        </p>
        @if (gpsError()) {
          <div class="alert" role="alert">{{ gpsError() }}</div>
        }
        @if (coordinates(); as gps) {
          <div class="gps-success" role="status">
            <span class="live-dot"></span> Localização capturada
          </div>
          <dl class="gps-data">
            <dt>Capturada em</dt>
            <dd>{{ capturedAt() }}</dd>
            <dt>Validade</dt>
            <dd>{{ expired() ? "Expirada: capture novamente" : "Atual" }}</dd>
            <dt>Latitude</dt>
            <dd>{{ gps.latitude.toFixed(7) }}</dd>
            <dt>Longitude</dt>
            <dd>{{ gps.longitude.toFixed(7) }}</dd>
            <dt>Precisão</dt>
            <dd>{{ gps.precisao_gps.toFixed(1) }} m</dd>
          </dl>
        } @else {
          <div class="gps-placeholder">Aguardando localização</div>
        }
        <button
          type="button"
          class="button secondary full"
          [disabled]="locating() || saving()"
          (click)="capture()"
        >
          {{
            locating()
              ? "Buscando localização…"
              : coordinates()
                ? "Atualizar localização"
                : "Capturar localização"
          }}</button
        ><small class="gps-note"
          >Permita o acesso à localização no navegador. A precisão pode variar
          conforme o dispositivo e o ambiente. A captura é válida por no máximo
          2 minutos e não comprova presença física.</small
        >
      </aside>
    </form>
  `,
})
export class CreatePage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  readonly scheduled = signal<Agendamento | null>(null);
  readonly scheduleLoading = signal(false);
  readonly scheduleError = signal("");
  readonly form = textForm();
  readonly responsible = new FormControl<number | null>(
    null,
    Validators.required,
  );
  readonly responsibles = signal<Responsavel[]>([]);
  readonly loadingResponsibles = signal(true);
  readonly responsibleError = signal("");
  readonly coordinates = signal<Coordinates | null>(null);
  readonly locating = signal(false);
  readonly gpsError = signal("");
  readonly saving = signal(false);
  readonly error = signal("");
  readonly errors = signal<Record<string, string>>({});
  readonly pending = signal<{ key: string; payload: NewVisit } | null>(null);
  readonly registeredVisit = signal<number | null>(null);
  readonly clock = signal(Date.now());
  private saved = false;
  private destroyed = false;
  constructor() {
    warnBeforeUnload(this);
    const timer = window.setInterval(() => this.clock.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      window.clearInterval(timer);
    });
    void this.loadResponsibles();
    const id = this.route?.snapshot?.queryParamMap?.get("agendamento_id");
    if (id !== null && id !== undefined) {
      void this.loadSchedule(id);
    }
  }
  async loadSchedule(value: string): Promise<void> {
    this.scheduleLoading.set(true);
    this.scheduleError.set("");
    try {
      if (!/^[1-9][0-9]{0,9}$/.test(value)) {
        throw new Error("Agendamento inválido.");
      }
      const item = await this.api.schedule(Number(value));
      if (this.destroyed) return;
      if (item.status !== "pendente") {
        this.scheduleError.set(
          "Este agendamento já foi realizado ou cancelado.",
        );
        return;
      }
      this.scheduled.set(item);
      this.form.reset({
        empresa: item.empresa,
        contato: item.contato,
        assunto: item.assunto,
        descricao: item.observacoes,
      });
      this.responsible.setValue(Number(item.responsavel_id));
      this.responsible.disable();
    } catch (e) {
      if (!this.destroyed)
        this.scheduleError.set(
          e instanceof Error && !("status" in e) ? e.message : errorMessage(e),
        );
    } finally {
      if (!this.destroyed) this.scheduleLoading.set(false);
    }
  }
  hasUnsavedChanges(): boolean {
    return (
      !this.saved &&
      (this.form.dirty ||
        this.responsible.dirty ||
        !!this.coordinates() ||
        !!this.pending() ||
        this.saving())
    );
  }
  expired(): boolean {
    return !freshCoordinates(this.coordinates(), this.clock());
  }
  capturedAt(): string {
    const coords = this.coordinates();
    return coords
      ? new Date(coords.gps_capturado_em).toLocaleTimeString("pt-BR")
      : "";
  }
  extraErrors(): string[] {
    return Object.entries(this.errors())
      .filter(
        ([key]) =>
          ![
            "contato",
            "empresa",
            "assunto",
            "descricao",
            "responsavel_id",
          ].includes(key),
      )
      .map(([key, value]) => value);
  }
  async loadResponsibles(): Promise<void> {
    this.loadingResponsibles.set(true);
    this.responsibleError.set("");
    try {
      const items = await this.api.responsibles();
      if (!this.destroyed) {
        this.responsibles.set(items);
      }
    } catch (error) {
      if (!this.destroyed) {
        this.responsibleError.set(errorMessage(error));
      }
    } finally {
      if (!this.destroyed) {
        this.loadingResponsibles.set(false);
      }
    }
  }
  async capture(): Promise<void> {
    if (this.locating() || this.saving()) {
      return;
    }
    this.locating.set(true);
    this.gpsError.set("");
    this.coordinates.set(null);
    try {
      const coords = await locate();
      if (!this.destroyed) {
        this.coordinates.set(coords);
        this.clock.set(Date.now());
      }
    } catch (error) {
      if (!this.destroyed) {
        this.gpsError.set(
          error instanceof Error
            ? error.message
            : "Falha ao capturar localização.",
        );
      }
    } finally {
      if (!this.destroyed) {
        this.locating.set(false);
      }
    }
  }
  handleSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }
  handleEnter(event: Event): void {
    if (
      event instanceof KeyboardEvent &&
      !event.isComposing &&
      (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement)
    ) {
      this.handleSubmit(event);
    }
  }
  async submit(): Promise<void> {
    if (
      this.saved ||
      this.saving() ||
      this.locating() ||
      this.loadingResponsibles() ||
      this.responsibleError() ||
      this.scheduleLoading() ||
      this.scheduleError()
    ) {
      return;
    }
    this.form.markAllAsTouched();
    this.responsible.markAsTouched();
    this.error.set("");
    this.errors.set({});
    const coords = this.coordinates();
    const responsible = this.responsible.value;
    if (this.pending()) {
      const candidate = {
        ...(this.scheduled()
          ? { agendamento_id: Number(this.scheduled()!.id) }
          : {}),
        ...this.form.getRawValue(),
        responsavel_id: Number(responsible),
        ...coords,
      };
      if (
        JSON.stringify(candidate) !== JSON.stringify(this.pending()!.payload)
      ) {
        this.error.set(
          "O formulário mudou após uma tentativa incerta. Recupere a tentativa original antes de iniciar outra visita.",
        );
        return;
      }
      await this.recover();
      return;
    }
    if (!freshCoordinates(coords)) {
      this.gpsError.set(
        coords
          ? "A localização expirou. Capture novamente antes de enviar."
          : "Capture a localização antes de registrar o check-in.",
      );
      return;
    }
    if (
      this.form.invalid ||
      this.responsible.invalid ||
      !coords ||
      !responsible ||
      !this.responsibles().some((r) => r.id === responsible)
    ) {
      this.error.set("Revise os campos obrigatórios e a localização.");
      return;
    }
    const attempt = {
      key: crypto.randomUUID(),
      payload: {
        ...(this.scheduled()
          ? { agendamento_id: Number(this.scheduled()!.id) }
          : {}),
        ...this.form.getRawValue(),
        responsavel_id: Number(responsible),
        ...coords,
      },
    };
    this.pending.set(attempt);
    await this.send(attempt);
  }
  async recover(): Promise<void> {
    const attempt = this.pending();
    if (!attempt || this.saving()) {
      return;
    }
    // Reenvia o snapshot. O servidor devolve a resposta salva ou rejeita GPS vencido antes de criar.
    await this.send(attempt);
  }
  private async send(attempt: {
    key: string;
    payload: NewVisit;
  }): Promise<void> {
    this.saving.set(true);
    this.error.set("");
    this.errors.set({});
    try {
      const visit = await this.api.create(attempt.payload, attempt.key);
      if (this.destroyed) {
        return;
      }
      this.pending.set(null);
      this.saved = true;
      this.registeredVisit.set(Number(visit.id));
      this.form.markAsPristine();
      this.responsible.markAsPristine();
      await this.router.navigate(["/visitas", visit.id], {
        state: {
          createdVisitId: Number(visit.id),
          message: "Check-in registrado com sucesso",
        },
      });
    } catch (error) {
      if (this.destroyed) {
        return;
      }
      this.error.set(errorMessage(error));
      this.errors.set(fieldErrors(error));
      if (
        error instanceof HttpErrorResponse &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 409
      ) {
        this.pending.set(null);
      }
    } finally {
      if (!this.destroyed) {
        this.saving.set(false);
      }
    }
  }
}
