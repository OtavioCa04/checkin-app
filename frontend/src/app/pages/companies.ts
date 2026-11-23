import { Component, inject, signal } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Api, errorMessage, fieldErrors } from "../api";
import { Empresa } from "../models";
import { Session } from "../session";
import { LocalDatePipe, maxCharacters, nonBlank, passwordBytes } from "../shared";
import { warnBeforeUnload } from "../unsaved";

/** Área do superadmin: cria empresas clientes e o primeiro administrador de cada uma. */
@Component({
  imports: [ReactiveFormsModule, LocalDatePipe],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">SUPERADMIN</span>
        <h1>Empresas</h1>
        <p class="muted">
          Cada empresa vê somente os próprios usuários, clientes e visitas.
        </p>
      </div>
      @if (!creating()) {
        <button class="button primary" (click)="openCreate()">
          ＋ Nova empresa
        </button>
      }
    </div>
    @if (notice()) {
      <div class="notice" role="status">{{ notice() }}</div>
    }
    @if (creating()) {
      <section class="panel form-panel">
        <h2>Nova empresa</h2>
        <p class="muted">
          Crie a empresa e o administrador dela. Ele entra com o e-mail e a
          senha abaixo e cadastra a própria equipe.
        </p>
        @if (saveError()) {
          <div class="alert" role="alert">{{ saveError() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="create()" novalidate>
          <fieldset [disabled]="saving()">
            <div class="form-grid">
              <div class="field span-two">
                <label for="company-name">Nome da empresa</label
                ><input id="company-name" formControlName="nome" />
                @if (invalid("nome")) {
                  <small class="field-error">{{
                    errors()["nome"] || "Informe o nome, até 150 caracteres."
                  }}</small>
                }
              </div>
              <div class="field">
                <label for="admin-name">Nome do administrador</label
                ><input id="admin-name" formControlName="admin_nome" />
                @if (invalid("admin_nome")) {
                  <small class="field-error">{{
                    errors()["admin_nome"] ||
                      "Informe o nome, até 150 caracteres."
                  }}</small>
                }
              </div>
              <div class="field">
                <label for="admin-email">E-mail do administrador</label
                ><input
                  id="admin-email"
                  type="email"
                  formControlName="admin_email"
                  autocomplete="off"
                />
                @if (invalid("admin_email")) {
                  <small class="field-error">{{
                    errors()["admin_email"] || "Informe um e-mail válido."
                  }}</small>
                }
              </div>
              <div class="field span-two">
                <label for="admin-password">Senha inicial do administrador</label
                ><input
                  id="admin-password"
                  type="password"
                  formControlName="admin_senha"
                  autocomplete="new-password"
                />
                @if (invalid("admin_senha")) {
                  <small class="field-error">{{
                    errors()["admin_senha"] ||
                      "Informe uma senha de 8 a 72 bytes."
                  }}</small>
                }
              </div>
            </div>
          </fieldset>
          <div class="form-actions">
            <button
              class="button secondary"
              type="button"
              [disabled]="saving()"
              (click)="cancel()"
            >
              Cancelar</button
            ><button class="button primary" type="submit" [disabled]="saving()">
              {{ saving() ? "Criando…" : "Criar empresa" }}
            </button>
          </div>
        </form>
      </section>
    }
    <section class="panel">
      <div class="panel-heading">
        <h2>Empresas cadastradas</h2>
        <span class="muted">{{ items().length }} no total</span>
      </div>
      @if (busy()) {
        <div class="state-card" role="status">Carregando empresas…</div>
      } @else if (error()) {
        <div class="alert" role="alert">
          {{ error() }}
          <button class="text-link" (click)="load()">Tentar novamente</button>
        </div>
      } @else {
        <div class="table-wrap" role="region" aria-label="Empresas" tabindex="0">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Usuários ativos</th>
                <th>Visitas (30 dias)</th>
                <th>Desde</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (e of items(); track e.id) {
                <tr>
                  <td>
                    <strong>{{ e.nome }}</strong>
                    @if (e.id === ownCompany()) {
                      <small>Sua empresa</small>
                    }
                  </td>
                  <td>{{ e.usuarios }} ({{ e.admins }} admin)</td>
                  <td>{{ e.visitas_30d }}</td>
                  <td>{{ e.criado_em | localDate }}</td>
                  <td>
                    <span class="status" [class.done]="e.ativo">{{
                      e.ativo ? "Ativa" : "Inativa"
                    }}</span>
                  </td>
                  <td>
                    <button
                      class="text-link"
                      [disabled]="saving()"
                      (click)="rename(e)"
                      [attr.aria-label]="'Renomear empresa ' + e.nome"
                    >
                      Renomear</button
                    >@if (e.id !== ownCompany()) {
                      <button
                        class="text-link"
                        [disabled]="saving()"
                        (click)="toggle(e)"
                        [attr.aria-label]="
                          (e.ativo ? 'Desativar empresa ' : 'Ativar empresa ') +
                          e.nome
                        "
                      >
                        {{ e.ativo ? "Desativar" : "Ativar" }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class CompaniesPage {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  readonly items = signal<Empresa[]>([]);
  readonly busy = signal(true);
  readonly error = signal("");
  readonly notice = signal("");
  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal("");
  readonly errors = signal<Record<string, string>>({});
  readonly form = new FormGroup({
    nome: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(150)],
    }),
    admin_nome: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(150)],
    }),
    admin_email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email, maxCharacters(190)],
    }),
    admin_senha: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        passwordBytes,
        (control) =>
          new TextEncoder().encode(control.value).length < 8
            ? { minbytes: true }
            : null,
      ],
    }),
  });
  constructor() {
    warnBeforeUnload(this);
    void this.load();
  }
  ownCompany(): number | null {
    return this.session.user?.empresa_id ?? null;
  }
  hasUnsavedChanges(): boolean {
    return this.creating() && (this.form.dirty || this.saving());
  }
  invalid(key: keyof typeof this.form.controls): boolean {
    return (
      !!this.errors()[key] ||
      (this.form.controls[key].touched && this.form.controls[key].invalid)
    );
  }
  async load(): Promise<void> {
    this.busy.set(true);
    this.error.set("");
    try {
      this.items.set(await this.api.companies());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  openCreate(): void {
    this.form.reset();
    this.errors.set({});
    this.saveError.set("");
    this.notice.set("");
    this.creating.set(true);
  }
  cancel(): void {
    if (this.form.dirty && !window.confirm("Descartar a nova empresa?")) {
      return;
    }
    this.form.reset();
    this.creating.set(false);
  }
  async create(): Promise<void> {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saveError.set("");
    this.errors.set({});
    try {
      const company = await this.api.createCompany(this.form.getRawValue());
      this.form.reset();
      this.creating.set(false);
      this.notice.set(
        `Empresa ${company.nome} criada. Envie ao administrador o endereço do sistema, o e-mail e a senha inicial.`,
      );
      await this.load();
    } catch (e) {
      this.saveError.set(errorMessage(e));
      this.errors.set(fieldErrors(e));
    } finally {
      this.saving.set(false);
      this.form.controls.admin_senha.reset();
    }
  }
  private async change(
    company: Empresa,
    data: Partial<Pick<Empresa, "nome" | "ativo">>,
    message: string,
  ): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.notice.set("");
    this.error.set("");
    try {
      await this.api.updateCompany(company.id, data);
      this.notice.set(message);
      await this.load();
    } catch (e) {
      this.notice.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
  async rename(company: Empresa): Promise<void> {
    const nome = window.prompt("Novo nome da empresa:", company.nome)?.trim();
    if (!nome || nome === company.nome) return;
    await this.change(company, { nome }, "Empresa renomeada.");
  }
  async toggle(company: Empresa): Promise<void> {
    if (
      company.ativo &&
      !window.confirm(
        `Desativar ${company.nome}? Todos os usuários dela perdem o acesso na hora. Os dados ficam guardados e voltam se você ativar de novo.`,
      )
    ) {
      return;
    }
    await this.change(
      company,
      { ativo: !company.ativo },
      company.ativo ? "Empresa desativada." : "Empresa ativada.",
    );
  }
}
