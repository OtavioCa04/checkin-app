import { Component, DestroyRef, inject, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage, fieldErrors } from "../api";
import { maxCharacters, nonBlank, textForm } from "../shared";
import { CHECKIN_MESSAGES, PhotoPicker } from "../photo";
import {
  Agendamento,
  NewVisit,
  ClienteSelection,
} from "../models";
import { CustomerPicker } from "../customer-picker";
import { warnBeforeUnload } from "../unsaved";
import { HttpErrorResponse } from "@angular/common/http";
import { TextFields } from "../text-fields";
@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TextFields,
    CustomerPicker,
    PhotoPicker,
  ],
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
        Visita do agendamento #{{ item.id }} · {{ item.empresa }}.
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
          <customer-picker
            [preset]="selection()"
            [disabled]="saving() || !!pending()"
            [locked]="!!scheduled()?.cliente_id"
            (selected)="chooseCustomer($event)"
          />
          <visit-text-fields [form]="form" [errors]="errors()" />
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
              registeredVisit() !== null
            "
          >
            {{
              uploadingPhoto()
                ? "Enviando foto…"
                : saving()
                  ? "Registrando…"
                  : "Registrar check-in"
            }}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
      <aside class="panel place-panel">
        <span class="place-symbol" aria-hidden="true">⌖</span>
        <h2>Local e foto</h2>
        <p class="muted">
          Informe onde a visita acontece. A foto é opcional.
        </p>
        <fieldset [disabled]="saving()">
          <div class="field">
            <label for="local"
              >Local da visita <span aria-hidden="true">*</span></label
            >
            <input
              id="local"
              [formControl]="local"
              autocomplete="street-address"
              placeholder="Endereço ou referência do local"
              [attr.aria-invalid]="localInvalid()"
              aria-describedby="local-error"
            />
            @if (localInvalid()) {
              <small class="field-error" id="local-error">{{
                errors()["local"] || "Informe o local (até 255 caracteres)."
              }}</small>
            }
          </div>
        </fieldset>
        <photo-picker
          [disabled]="saving() || registeredVisit() !== null"
          (changed)="photo.set($event)"
        />
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
  readonly selection = signal<ClienteSelection | null>(null);
  chooseCustomer(value: ClienteSelection): void {
    if (this.saving() || this.pending()) return;
    this.selection.set(value);
    if (value.empresa) this.form.controls.empresa.setValue(value.empresa);
    if (value.contato) this.form.controls.contato.setValue(value.contato);
    value.cliente_id
      ? this.form.controls.empresa.disable()
      : this.form.controls.empresa.enable();
    value.contato_id
      ? this.form.controls.contato.disable()
      : this.form.controls.contato.enable();
    this.suggestLocal(value.endereco);
    this.form.markAsDirty();
  }
  // Sugere o endereço do cliente sem sobrescrever o que o funcionário digitou.
  private suggestLocal(address: string | undefined): void {
    if (!address) return;
    const current = this.local.value.trim();
    if (current && current !== this.suggestedLocal) return;
    const suggestion = Array.from(address).slice(0, 255).join("").trim();
    this.local.setValue(suggestion);
    this.suggestedLocal = suggestion;
  }
  private customerLinks(): { cliente_id?: number; contato_id?: number } {
    const c = this.selection();
    return {
      ...(c?.cliente_id ? { cliente_id: Number(c.cliente_id) } : {}),
      ...(c?.contato_id ? { contato_id: Number(c.contato_id) } : {}),
    };
  }
  readonly form = textForm();
  readonly local = new FormControl("", {
    nonNullable: true,
    validators: [nonBlank, maxCharacters(255)],
  });
  private suggestedLocal = "";
  readonly photo = signal<Blob | null>(null);
  readonly uploadingPhoto = signal(false);
  readonly saving = signal(false);
  readonly error = signal("");
  readonly errors = signal<Record<string, string>>({});
  readonly pending = signal<{ key: string; payload: NewVisit } | null>(null);
  readonly registeredVisit = signal<number | null>(null);
  private saved = false;
  private destroyed = false;
  constructor() {
    warnBeforeUnload(this);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });
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
      if (item.cliente_id) {
        this.chooseCustomer({
          cliente_id: Number(item.cliente_id),
          ...(item.contato_id ? { contato_id: Number(item.contato_id) } : {}),
          empresa: item.empresa,
          contato: item.contato,
        });
        this.form.markAsPristine();
      }
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
        this.local.dirty ||
        !!this.photo() ||
        !!this.pending() ||
        this.saving())
    );
  }
  localInvalid(): boolean {
    return (
      !!this.errors()["local"] || (this.local.touched && this.local.invalid)
    );
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
            "local",
          ].includes(key),
      )
      .map(([key, value]) => value);
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
  private payload(): NewVisit {
    return {
      ...this.customerLinks(),
      ...(this.scheduled()
        ? { agendamento_id: Number(this.scheduled()!.id) }
        : {}),
      ...this.form.getRawValue(),
      local: this.local.value.trim(),
    };
  }
  async submit(): Promise<void> {
    if (
      this.saved ||
      this.saving() ||
      this.scheduleLoading() ||
      this.scheduleError()
    ) {
      return;
    }
    this.form.markAllAsTouched();
    this.local.markAsTouched();
    this.error.set("");
    this.errors.set({});
    if (this.pending()) {
      if (
        JSON.stringify(this.payload()) !==
        JSON.stringify(this.pending()!.payload)
      ) {
        this.error.set(
          "O formulário mudou após uma tentativa incerta. Recupere a tentativa original antes de iniciar outra visita.",
        );
        return;
      }
      await this.recover();
      return;
    }
    if (this.form.invalid || this.local.invalid) {
      this.error.set("Revise os campos obrigatórios, incluindo o local.");
      return;
    }
    const attempt = { key: crypto.randomUUID(), payload: this.payload() };
    this.pending.set(attempt);
    await this.send(attempt);
  }
  async recover(): Promise<void> {
    const attempt = this.pending();
    if (!attempt || this.saving()) {
      return;
    }
    // Reenvia o snapshot com a mesma chave; o servidor devolve a resposta salva.
    await this.send(attempt);
  }
  private async send(attempt: {
    key: string;
    payload: NewVisit;
  }): Promise<void> {
    this.saving.set(true);
    this.error.set("");
    this.errors.set({});
    let visit;
    try {
      visit = await this.api.create(attempt.payload, attempt.key);
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
      this.saving.set(false);
      return;
    }
    if (this.destroyed) {
      return;
    }
    const id = Number(visit.id);
    this.pending.set(null);
    this.saved = true;
    this.registeredVisit.set(id);
    this.form.markAsPristine();
    this.local.markAsPristine();
    // A visita já existe: falha na foto não desfaz nem repete o check-in.
    let message: string = CHECKIN_MESSAGES.success;
    const photo = this.photo();
    if (photo) {
      this.uploadingPhoto.set(true);
      try {
        await this.api.uploadVisitPhoto(id, photo);
      } catch {
        message = CHECKIN_MESSAGES.photoFailed;
      }
      if (this.destroyed) {
        return;
      }
      this.uploadingPhoto.set(false);
    }
    try {
      await this.router.navigate(["/visitas", id], {
        state: { createdVisitId: id, message },
      });
    } finally {
      if (!this.destroyed) {
        this.saving.set(false);
      }
    }
  }
}
