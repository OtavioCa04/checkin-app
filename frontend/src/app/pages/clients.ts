import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Api, errorMessage, fieldErrors } from "../api";
import { Cliente, Contato, Responsavel, Agendamento, Visita } from "../models";
import { Session } from "../session";
import { ClientFields } from "../client-fields";
import {
  clientForm,
  clientPayload,
  cnpjMask,
  contactForm,
} from "../customer-shared";
import { LocalDatePipe } from "../shared";
import { warnBeforeUnload } from "../unsaved";

@Component({
  imports: [ReactiveFormsModule, RouterLink, ClientFields],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">RELACIONAMENTO</span>
        <h1>Clientes</h1>
        <p class="muted">Cadastros disponíveis para seu trabalho.</p>
      </div>
      @if (session.user?.perfil !== "responsavel") {
        <button
          type="button"
          class="button primary"
          [disabled]="creating()"
          (click)="creating.set(true)"
        >
          ＋ Cadastrar cliente
        </button>
      }
    </div>
    <form class="panel form-panel search-row" (submit)="apply($event)">
      <div class="field">
        <label for="clients-q">Empresa, nome fantasia ou CNPJ sem máscara</label
        ><input id="clients-q" [formControl]="search" />
      </div>
      <div class="field">
        <label for="clients-active">Situação</label
        ><select id="clients-active" [formControl]="active">
          <option value="">Todas</option>
          <option value="1">Ativos</option>
          <option value="0">Inativos</option>
        </select>
      </div>
      <button type="submit" class="button secondary">Buscar</button>
    </form>
    @if (error()) {
      <div class="alert" role="alert">{{ error() }}</div>
    }
    @if (creating()) {
      <section class="panel form-panel">
        <h2>Novo cliente</h2>
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <fieldset [disabled]="saving()">
            <client-fields
              [form]="form"
              [admin]="session.user?.perfil === 'admin'"
            />
          </fieldset>
          @for (entry of errors(); track $index) {
            <p class="field-error" role="alert">{{ entry }}</p>
          }
          <div class="form-actions">
            <button
              type="button"
              class="button secondary"
              [disabled]="saving()"
              (click)="cancel()"
            >
              Cancelar</button
            ><button type="submit" class="button primary" [disabled]="saving()">
              {{ saving() ? "Salvando…" : "Cadastrar cliente" }}
            </button>
          </div>
        </form>
      </section>
    }
    @if (loading()) {
      <p role="status">Carregando clientes…</p>
    } @else if (!items().length) {
      <div class="panel form-panel">
        Nenhum cliente encontrado no seu acesso.
      </div>
    } @else {
      <div class="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CNPJ</th>
              <th>Situação</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            @for (c of items(); track c.id) {
              <tr>
                <td>
                  <strong>{{ c.nome_empresa }}</strong
                  ><br /><small>{{ c.nome_fantasia }}</small>
                </td>
                <td>{{ mask(c.cnpj) }}</td>
                <td>{{ c.ativo ? "Ativo" : "Inativo" }}</td>
                <td>
                  <a
                    class="text-link"
                    [routerLink]="['/clientes', c.id]"
                    [queryParams]="params()"
                    >Abrir →</a
                  >
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
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
  `,
})
export class ClientsPage {
  readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private dead = false;
  private generation = 0;
  readonly search = new FormControl("", { nonNullable: true });
  readonly active = new FormControl("1", { nonNullable: true });
  readonly form = clientForm();
  readonly mask = cnpjMask;
  readonly items = signal<Cliente[]>([]);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly errors = signal<string[]>([]);
  readonly offset = signal(0);
  readonly creating = signal(false);
  readonly saving = signal(false);
  constructor() {
    warnBeforeUnload(this);
    inject(DestroyRef).onDestroy(() => {
      this.dead = true;
      this.generation++;
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.search.setValue(p.get("q") || "");
      this.active.setValue(p.get("ativo") ?? "1");
      const offset = Number(p.get("offset") || 0);
      this.offset.set(Number.isSafeInteger(offset) && offset >= 0 ? offset : 0);
      void this.load();
    });
  }
  hasUnsavedChanges(): boolean {
    return this.saving() || (this.creating() && this.form.dirty);
  }
  params() {
    return {
      q: this.search.value,
      ativo: this.active.value,
      offset: this.offset(),
    };
  }
  apply(event: Event): void {
    event.preventDefault();
    this.offset.set(0);
    this.navigate();
  }
  page(direction: number): void {
    this.offset.update((n) => Math.max(0, n + direction * 20));
    this.navigate();
  }
  private navigate(): void {
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
      const result = await this.api.clients(20, this.offset(), {
        q: this.search.value,
        ...(this.active.value ? { ativo: this.active.value } : {}),
      });
      if (!this.dead && generation === this.generation)
        this.items.set(result.items);
    } catch (e) {
      if (!this.dead && generation === this.generation)
        this.error.set(errorMessage(e));
    } finally {
      if (!this.dead && generation === this.generation) this.loading.set(false);
    }
  }
  cancel(): void {
    if (
      this.saving() ||
      (this.form.dirty && !window.confirm("Descartar cadastro não salvo?"))
    )
      return;
    this.creating.set(false);
    this.form.reset();
    this.errors.set([]);
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set("");
    this.errors.set([]);
    try {
      const c = await this.api.saveClient(
        clientPayload(this.form, this.session.user?.perfil === "admin"),
      );
      if (this.dead) return;
      this.form.markAsPristine();
      this.creating.set(false);
      this.saving.set(false);
      await this.router.navigate(["/clientes", c.id], {
        queryParams: this.params(),
      });
    } catch (e) {
      if (!this.dead) {
        this.error.set(errorMessage(e));
        this.errors.set(Object.values(fieldErrors(e)));
      }
    } finally {
      if (!this.dead) this.saving.set(false);
    }
  }
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, ClientFields, LocalDatePipe],
  template: `
    <a routerLink="/clientes" [queryParams]="backParams()" class="back-link"
      >← Voltar aos clientes</a
    >
    @if (loading()) {
      <p role="status">Carregando cliente…</p>
    }
    @if (error()) {
      <div class="alert" role="alert">
        {{ error() }}
        <button
          type="button"
          class="text-link"
          [disabled]="saving()"
          (click)="load()"
        >
          Atualizar dados
        </button>
      </div>
    }
    @if (message()) {
      <div class="notice" role="status">{{ message() }}</div>
    }
    @if (client(); as c) {
      <div class="page-heading">
        <div>
          <span class="eyebrow">CLIENTE #{{ c.id }}</span>
          <h1>{{ c.nome_empresa }}</h1>
          <p class="muted">
            {{ c.ativo ? "Ativo" : "Inativo" }}{{ c.cnpj ? " · " + mask(c.cnpj) : "" }}
          </p>
        </div>
        @if (c.pode_editar && !editing()) {
          <button
            type="button"
            class="button secondary"
            [disabled]="saving()"
            (click)="edit()"
          >
            Editar cliente
          </button>
        }
      </div>
      <section class="panel form-panel">
        @if (editing()) {
          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <fieldset [disabled]="saving()">
              <client-fields
                [form]="form"
                [admin]="session.user?.perfil === 'admin'"
              />
            </fieldset>
            @for (entry of errors(); track $index) {
              <p class="field-error" role="alert">{{ entry }}</p>
            }
            <div class="form-actions">
              <button
                type="button"
                class="button secondary"
                [disabled]="saving()"
                (click)="cancelEdit()"
              >
                Cancelar edição</button
              ><button
                type="submit"
                class="button primary"
                [disabled]="saving()"
              >
                {{ saving() ? "Salvando…" : "Salvar cliente" }}
              </button>
            </div>
          </form>
        } @else {
          <dl class="details">
            <dt>Nome fantasia</dt>
            <dd>{{ c.nome_fantasia || "—" }}</dd>
            <dt>Endereço</dt>
            <dd>{{ address(c) }}</dd>
            <dt>Observações</dt>
            <dd class="description">{{ c.observacoes || "—" }}</dd>
            <dt>Criação</dt>
            <dd>{{ c.criado_em | localDate }} · Autor #{{ c.criado_por }}</dd>
          </dl>
          <p class="muted">
            As alterações cadastrais preservam os retratos das visitas e dos
            agendamentos existentes.
          </p>
        }
      </section>
      @if (session.user?.perfil === "admin") {
        <section class="panel form-panel">
          <h2>Acesso de funcionários</h2>
          <p class="muted">
            Vínculo explícito permite planejar antes da primeira visita. Remover
            o vínculo impede novos usos; o histórico próprio continua
            consultável.
          </p>
          <p>
            Vínculos atuais:
            @for (u of c.funcionarios; track u.usuario_id) {
              <span
                >{{ u.nome }} (#{{ u.usuario_id }}){{
                  u.ativo ? "" : " · Inativo"
                }};
              </span>
            }
          </p>
          @if (accessError()) {
            <div class="alert" role="alert">
              {{ accessError() }}
              <button type="button" class="text-link" (click)="loadEmployees()">
                Recarregar funcionários
              </button>
            </div>
          }
          <div class="field">
            <label for="client-access"
              >Funcionários ativos (Ctrl/Cmd para selecionar vários)</label
            ><select id="client-access" multiple [formControl]="accessIds">
              @for (u of employees(); track u.id) {
                <option [ngValue]="u.id">{{ u.nome }} #{{ u.id }}</option>
              }
            </select>
          </div>
          <button
            type="button"
            class="button secondary"
            [disabled]="saving() || !!accessError()"
            (click)="saveAccess()"
          >
            Salvar vínculos selecionados
          </button>
        </section>
      }
      <section class="panel form-panel">
        <div class="section-heading">
          <h2>Contatos</h2>
          @if (c.pode_editar) {
            <button
              type="button"
              class="button secondary"
              [disabled]="saving()"
              (click)="newContact()"
            >
              ＋ Novo contato
            </button>
          }
        </div>
        @if (contactLoading()) {
          <p role="status">Carregando contatos…</p>
        } @else if (!contacts().length) {
          <p>Nenhum contato nesta página.</p>
        }
        @for (person of contacts(); track person.id) {
          <article class="contact-card">
            <div>
              <strong>{{ person.nome }}</strong>
              {{ person.principal ? "· Principal" : "" }}
              {{ person.ativo ? "" : "· Inativo" }}
              @if (joined([person.cargo, person.email, person.telefone]); as info) {
                <p>{{ info }}</p>
              }
            </div>
            @if (c.pode_editar) {
              <button
                type="button"
                class="text-link"
                [disabled]="saving()"
                (click)="editContact(person)"
              >
                Editar contato
              </button>
            }
          </article>
        }
        <div class="pagination">
          <button
            type="button"
            class="button secondary"
            [disabled]="!contactOffset() || contactLoading()"
            (click)="contactPage(-1)"
          >
            Anterior</button
          ><button
            type="button"
            class="button secondary"
            [disabled]="contacts().length < 20 || contactLoading()"
            (click)="contactPage(1)"
          >
            Próxima
          </button>
        </div>
        @if (contactEditing()) {
          <h3>{{ contactId() ? "Editar contato" : "Novo contato" }}</h3>
          <form [formGroup]="contactForm" (ngSubmit)="saveContact()" novalidate>
            <fieldset [disabled]="saving()">
              <div class="form-grid">
                <div class="field">
                  <label for="contact-name">Nome *</label
                  ><input id="contact-name" formControlName="nome" />
                </div>
                <div class="field">
                  <label for="contact-role">Cargo</label
                  ><input id="contact-role" formControlName="cargo" />
                </div>
                <div class="field">
                  <label for="contact-email">E-mail</label
                  ><input
                    id="contact-email"
                    type="email"
                    formControlName="email"
                  />
                </div>
                <div class="field">
                  <label for="contact-phone">Telefone</label
                  ><input
                    id="contact-phone"
                    type="tel"
                    formControlName="telefone"
                  />
                </div>
              </div>
              <label class="check-field"
                ><input type="checkbox" formControlName="principal" /> Contato
                principal</label
              >
              @if (session.user?.perfil === "admin") {
                <label class="check-field"
                  ><input type="checkbox" formControlName="ativo" /> Contato
                  ativo</label
                >
              }
            </fieldset>
            @if (contactForm.touched && contactForm.invalid) {
              <p class="field-error" role="alert">
                Revise nome (150), cargo (120), e-mail válido (190) e telefone
                (40 caracteres).
              </p>
            }
            <div class="form-actions">
              <button
                type="button"
                class="button secondary"
                [disabled]="saving()"
                (click)="closeContact()"
              >
                Cancelar</button
              ><button
                type="submit"
                class="button primary"
                [disabled]="saving()"
              >
                Salvar contato
              </button>
            </div>
          </form>
        }
      </section>
      <section class="panel form-panel">
        <h2>Histórico autorizado</h2>
        <div class="form-actions">
          <button
            type="button"
            class="button secondary"
            (click)="changeHistory('visitas')"
          >
            Visitas</button
          ><button
            type="button"
            class="button secondary"
            (click)="changeHistory('agendamentos')"
          >
            Agendamentos
          </button>
        </div>
        <p class="muted">
          {{ historyKind() === "visitas" ? "Visitas" : "Agendamentos" }} ·
          Apenas registros permitidos pelo seu perfil.
        </p>
        @if (historyLoading()) {
          <p role="status">Carregando histórico…</p>
        } @else if (!history().length) {
          <p>Nenhum registro nesta página.</p>
        }
        @for (row of history(); track row.id) {
          <article class="contact-card">
            <div>
              <strong>{{ row.empresa }} · {{ row.assunto }}</strong>
              <p>
                {{ row.contato }} · {{ row.funcionario_nome }} ·
                {{ row.responsavel_nome }} · {{ row.status }}
              </p>
              <p>{{ historyDate(row) | localDate }}</p>
            </div>
            @if (historyKind() === "visitas") {
              <a
                class="text-link"
                [routerLink]="['/visitas', row.id]"
                [queryParams]="visitParams()"
                >Abrir visita #{{ row.id }}</a
              >
            } @else {
              <span>Agendamento #{{ row.id }}</span>
            }
          </article>
        }
        <div class="pagination">
          <button
            type="button"
            class="button secondary"
            [disabled]="!historyOffset() || historyLoading()"
            (click)="historyPage(-1)"
          >
            Anterior</button
          ><button
            type="button"
            class="button secondary"
            [disabled]="history().length < 20 || historyLoading()"
            (click)="historyPage(1)"
          >
            Próxima
          </button>
        </div>
      </section>
    }
  `,
})
export class ClientDetailPage {
  readonly id = input.required<string>();
  readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private dead = false;
  private generation = 0;
  private contactGeneration = 0;
  private historyGeneration = 0;
  readonly client = signal<Cliente | null>(null);
  readonly loading = signal(true);
  readonly error = signal("");
  readonly message = signal("");
  readonly saving = signal(false);
  readonly editing = signal(false);
  readonly errors = signal<string[]>([]);
  readonly form = clientForm();
  readonly mask = cnpjMask;
  readonly employees = signal<Responsavel[]>([]);
  readonly accessIds = new FormControl<number[]>([], { nonNullable: true });
  readonly accessError = signal("");
  readonly contacts = signal<Contato[]>([]);
  readonly contactLoading = signal(false);
  readonly contactOffset = signal(0);
  readonly contactForm = contactForm();
  readonly contactId = signal<number | null>(null);
  readonly contactEditing = signal(false);
  readonly history = signal<(Visita | Agendamento)[]>([]);
  readonly historyKind = signal<"visitas" | "agendamentos">("visitas");
  readonly historyOffset = signal(0);
  readonly historyLoading = signal(false);
  constructor() {
    warnBeforeUnload(this);
    inject(DestroyRef).onDestroy(() => {
      this.dead = true;
      this.generation++;
      this.contactGeneration++;
      this.historyGeneration++;
    });
    effect(() => {
      this.id();
      untracked(() => void this.load());
    });
  }
  backParams() {
    const p = this.route.snapshot.queryParams;
    return {
      q: p["q"] || "",
      ativo: p["ativo"] ?? "1",
      offset: Number(p["offset"] || 0),
    };
  }
  private detailParams() {
    return {
      ...this.backParams(),
      historico: this.historyKind(),
      historico_offset: this.historyOffset(),
      contatos_offset: this.contactOffset(),
    };
  }
  visitParams() {
    return { ...this.detailParams(), origem_cliente: this.id() };
  }
  private remember(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.detailParams(),
      replaceUrl: true,
    });
  }
  hasUnsavedChanges(): boolean {
    return (
      this.saving() ||
      (this.editing() && this.form.dirty) ||
      (this.contactEditing() && this.contactForm.dirty) ||
      this.accessIds.dirty
    );
  }
  private active(generation: number, id: number): boolean {
    return (
      !this.dead && generation === this.generation && Number(this.id()) === id
    );
  }
  async load(): Promise<void> {
    const next = Number(this.id()),
      same = this.client()?.id === next;
    if (same && this.saving()) return;
    if (
      same &&
      this.hasUnsavedChanges() &&
      !window.confirm("Descartar alterações e atualizar os dados?")
    )
      return;
    const generation = ++this.generation,
      id = next;
    this.loading.set(true);
    this.saving.set(false);
    this.error.set("");
    this.client.set(null);
    this.contacts.set([]);
    this.history.set([]);
    this.contactGeneration++;
    this.historyGeneration++;
    this.message.set("");
    this.editing.set(false);
    this.contactEditing.set(false);
    this.accessIds.markAsPristine();
    const p = this.route.snapshot.queryParams;
    const page = (v: unknown) => {
      const n = Number(v || 0);
      return Number.isSafeInteger(n) && n >= 0 && n <= 1000000 ? n : 0;
    };
    this.contactOffset.set(page(p["contatos_offset"]));
    this.historyOffset.set(page(p["historico_offset"]));
    this.historyKind.set(
      p["historico"] === "agendamentos" ? "agendamentos" : "visitas",
    );
    try {
      const c = await this.api.client(id);
      if (!this.active(generation, id)) return;
      this.client.set(c);
      this.form.reset({
        ...c,
        cnpj: cnpjMask(c.cnpj) === "—" ? "" : cnpjMask(c.cnpj),
      });
      this.accessIds.setValue(
        (c.funcionarios || [])
          .filter((u) => u.ativo && u.perfil === "funcionario")
          .map((u) => Number(u.usuario_id)),
      );
      await Promise.all([
        this.loadContacts(),
        this.loadHistory(),
        ...(this.session.user?.perfil === "admin"
          ? [this.loadEmployees()]
          : []),
      ]);
    } catch (e) {
      if (this.active(generation, id)) this.error.set(errorMessage(e));
    } finally {
      if (this.active(generation, id)) this.loading.set(false);
    }
  }
  async loadEmployees(): Promise<void> {
    const id = Number(this.id()),
      generation = this.generation;
    this.accessError.set("");
    try {
      const result = await this.api.agendaOptions();
      if (this.active(generation, id)) this.employees.set(result.funcionarios);
    } catch (e) {
      if (this.active(generation, id)) this.accessError.set(errorMessage(e));
    }
  }
  edit(): void {
    if (!this.client()?.pode_editar || this.saving()) return;
    this.editing.set(true);
    this.form.markAsPristine();
  }
  cancelEdit(): void {
    if (
      this.saving() ||
      (this.form.dirty && !window.confirm("Descartar alterações do cliente?"))
    )
      return;
    const c = this.client()!;
    this.form.reset({ ...c, cnpj: c.cnpj ? cnpjMask(c.cnpj) : "" });
    this.editing.set(false);
  }
  private async write(
    operation: () => Promise<unknown>,
    message: string,
  ): Promise<boolean> {
    if (this.saving()) return false;
    const generation = this.generation,
      id = Number(this.id());
    this.saving.set(true);
    this.error.set("");
    this.errors.set([]);
    try {
      await operation();
      if (!this.active(generation, id)) return false;
      this.message.set(message);
      return true;
    } catch (e) {
      if (this.active(generation, id)) {
        this.error.set(errorMessage(e));
        this.errors.set(Object.values(fieldErrors(e)));
      }
      return false;
    } finally {
      if (this.active(generation, id)) this.saving.set(false);
    }
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.client()?.pode_editar) return;
    let updated: Cliente | undefined;
    if (
      await this.write(async () => {
        updated = await this.api.saveClient(
          clientPayload(this.form, this.session.user?.perfil === "admin"),
          Number(this.id()),
        );
      }, "Cliente atualizado.")
    ) {
      this.client.set(updated!);
      this.form.markAsPristine();
      this.editing.set(false);
    }
  }
  async saveAccess(): Promise<void> {
    if (!window.confirm("Confirmar os vínculos selecionados?")) return;
    let updated: Cliente | undefined;
    if (
      await this.write(async () => {
        updated = await this.api.clientAccess(
          Number(this.id()),
          this.accessIds.value.map(Number),
        );
      }, "Vínculos atualizados.")
    ) {
      this.client.set(updated!);
      this.accessIds.markAsPristine();
    }
  }
  async loadContacts(): Promise<void> {
    const generation = ++this.contactGeneration,
      id = Number(this.id());
    this.contactLoading.set(true);
    try {
      const result = await this.api.contacts(id, 20, this.contactOffset());
      if (
        !this.dead &&
        generation === this.contactGeneration &&
        id === Number(this.id())
      )
        this.contacts.set(result.items);
    } catch (e) {
      if (
        !this.dead &&
        generation === this.contactGeneration &&
        id === Number(this.id())
      )
        this.error.set(errorMessage(e));
    } finally {
      if (
        !this.dead &&
        generation === this.contactGeneration &&
        id === Number(this.id())
      )
        this.contactLoading.set(false);
    }
  }
  contactPage(direction: number): void {
    this.contactOffset.update((n) => Math.max(0, n + direction * 20));
    this.remember();
    void this.loadContacts();
  }
  newContact(): void {
    if (!this.closeContact()) return;
    this.contactForm.reset();
    this.contactId.set(null);
    this.contactEditing.set(true);
  }
  editContact(c: Contato): void {
    if (!this.closeContact()) return;
    this.contactForm.reset(c);
    this.contactId.set(Number(c.id));
    this.contactEditing.set(true);
  }
  closeContact(): boolean {
    if (
      this.saving() ||
      (this.contactEditing() &&
        this.contactForm.dirty &&
        !window.confirm("Descartar alterações do contato?"))
    )
      return false;
    this.contactEditing.set(false);
    this.contactForm.markAsPristine();
    return true;
  }
  async saveContact(): Promise<void> {
    this.contactForm.markAllAsTouched();
    if (this.contactForm.invalid) return;
    const { ativo, ...data } = this.contactForm.getRawValue();
    if (
      await this.write(
        () =>
          this.api.saveContact(
            Number(this.id()),
            {
              ...data,
              ...(this.session.user?.perfil === "admin" ? { ativo } : {}),
            },
            this.contactId() ?? undefined,
          ),
        "Contato salvo.",
      )
    ) {
      this.contactForm.markAsPristine();
      this.contactEditing.set(false);
      await this.loadContacts();
    }
  }
  // Junta somente as partes preenchidas, sem separadores soltos.
  joined(parts: unknown[], separator = " · "): string {
    return parts
      .map((p) => (typeof p === "string" ? p.trim() : p == null ? "" : String(p)))
      .filter(Boolean)
      .join(separator);
  }
  address(c: Cliente): string {
    return (
      this.joined([
        this.joined([c.logradouro, c.numero, c.complemento], " "),
        c.bairro,
        this.joined([c.cidade, c.uf], " "),
        c.cep,
        c.pais,
      ]) || "—"
    );
  }
  historyDate(row: Visita | Agendamento): string {
    return "data_hora_prevista" in row
      ? row.data_hora_prevista
      : row.data_hora_checkin;
  }
  changeHistory(kind: "visitas" | "agendamentos"): void {
    this.historyKind.set(kind);
    this.historyOffset.set(0);
    this.remember();
    void this.loadHistory();
  }
  historyPage(direction: number): void {
    this.historyOffset.update((n) => Math.max(0, n + direction * 20));
    this.remember();
    void this.loadHistory();
  }
  async loadHistory(): Promise<void> {
    const generation = ++this.historyGeneration,
      id = Number(this.id());
    this.historyLoading.set(true);
    try {
      const result = await this.api.clientHistory(
        id,
        this.historyKind(),
        this.historyOffset(),
      );
      if (
        !this.dead &&
        generation === this.historyGeneration &&
        id === Number(this.id())
      )
        this.history.set(result.items);
    } catch (e) {
      if (
        !this.dead &&
        generation === this.historyGeneration &&
        id === Number(this.id())
      )
        this.error.set(errorMessage(e));
    } finally {
      if (
        !this.dead &&
        generation === this.historyGeneration &&
        id === Number(this.id())
      )
        this.historyLoading.set(false);
    }
  }
}
