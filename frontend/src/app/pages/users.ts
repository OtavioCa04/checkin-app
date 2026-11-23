import { Component, computed, inject, signal } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { Api, errorMessage, fieldErrors } from "../api";
import { Usuario, Perfil, NewUser, UserPatch, Setor } from "../models";
import { Session } from "../session";
import { maxCharacters, nonBlank, passwordBytes, roleLabel } from "../shared";
import { warnBeforeUnload } from "../unsaved";

@Component({
  imports: [ReactiveFormsModule],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">ADMINISTRAÇÃO</span>
        <h1>Usuários</h1>
        <p class="muted">Gerencie nomes, perfis e acesso da equipe.</p>
      </div>
      <button class="button primary" [disabled]="saving()" (click)="newUser()">
        ＋ Criar usuário
      </button>
    </div>
    @if (notice()) {
      <div class="notice" role="status">{{ notice() }}</div>
    }
    @if (editing()) {
      <section class="panel form-panel">
        <h2>{{ selected() ? "Editar usuário" : "Criar usuário" }}</h2>
        @if (saveError()) {
          <div class="alert" role="alert">{{ saveError() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <fieldset [disabled]="saving()">
            <div class="form-grid">
              <div class="field">
                <label for="nome">Nome</label
                ><input
                  id="nome"
                  formControlName="nome"
                  aria-describedby="nome-err"
                />
                @if (invalid("nome")) {
                  <small class="field-error" id="nome-err">{{
                    errors()["nome"] || "Nome obrigatório, até 150 caracteres."
                  }}</small>
                }
              </div>
              <div class="field">
                <label for="user-email">E-mail</label
                ><input
                  id="user-email"
                  type="email"
                  formControlName="email"
                  autocomplete="off"
                />
                @if (invalid("email")) {
                  <small class="field-error">{{
                    errors()["email"] ||
                      "Informe um e-mail válido, até 190 caracteres."
                  }}</small>
                }
              </div>
              <div class="field">
                <label for="perfil">Perfil</label
                ><select id="perfil" formControlName="perfil">
                  <option value="funcionario">Funcionário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div class="field">
                <label for="ativo">Acesso</label
                ><select id="ativo" formControlName="ativo">
                  <option [ngValue]="true">Ativo</option>
                  <option [ngValue]="false">Inativo</option>
                </select>
              </div>
              <div class="field">
                <label for="setor">Setor</label
                ><select id="setor" formControlName="setor_id">
                  <option [ngValue]="null">Sem setor</option>
                  @for (s of sectorChoices(); track s.id) {
                    <option [ngValue]="s.id">
                      {{ s.nome }}{{ s.ativo ? "" : " (inativo)" }}
                    </option>
                  }
                </select>
                @if (errors()["setor_id"]) {
                  <small class="field-error">{{ errors()["setor_id"] }}</small>
                }
                @if (!sectors().length) {
                  <small class="muted"
                    >Cadastre setores no quadro Setores, abaixo.</small
                  >
                }
              </div>
              @if (!selected()) {
                <div class="field span-two">
                  <label for="new-password">Senha inicial</label
                  ><input
                    id="new-password"
                    type="password"
                    formControlName="senha"
                    autocomplete="new-password"
                  />
                  @if (invalid("senha")) {
                    <small class="field-error">{{
                      errors()["senha"] || "Informe uma senha de 8 a 72 bytes."
                    }}</small>
                  }
                </div>
              }
            </div>
          </fieldset>
          <p class="muted">
            Mudanças de perfil alteram o acesso às visitas, mas preservam seus
            vínculos e registros. O último administrador ativo é protegido.
          </p>
          <div class="form-actions">
            <button
              class="button secondary"
              type="button"
              [disabled]="saving()"
              (click)="cancel()"
            >
              Cancelar</button
            ><button class="button primary" type="submit" [disabled]="saving()">
              {{ saving() ? "Salvando…" : "Salvar usuário" }}
            </button>
          </div>
        </form>
      </section>
    }
    <section class="panel">
      <div class="panel-heading">
        <h2>Equipe cadastrada</h2>
        <span class="muted">Página {{ offset() / limit + 1 }}</span>
      </div>
      @if (sectors().length) {
        <div class="field sector-filter">
          <label for="team-sector">Mostrar setor</label
          ><select
            id="team-sector"
            [value]="sectorFilter()"
            (change)="sectorFilter.set($any($event.target).value)"
          >
            <option value="">Todos</option>
            @for (s of sectors(); track s.id) {
              <option [value]="'' + s.id">{{ s.nome }}</option>
            }
            <option value="sem">Sem setor</option>
          </select>
        </div>
      }
      @if (busy()) {
        <div class="state-card" role="status">Carregando usuários…</div>
      } @else if (error()) {
        <div class="alert" role="alert">
          {{ error() }}
          <button class="text-link" (click)="load(offset())">
            Tentar novamente
          </button>
        </div>
      } @else if (!visibleItems().length) {
        <div class="state-card">
          {{
            items().length
              ? "Nenhum usuário deste setor nesta página."
              : "Nenhum usuário nesta página."
          }}
        </div>
      } @else {
        <div
          class="table-wrap"
          role="region"
          aria-label="Equipe cadastrada, tabela com rolagem horizontal"
          tabindex="0"
        >
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Setor</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (u of visibleItems(); track u.id) {
                <tr>
                  <td>
                    <strong>{{ u.nome }}</strong
                    ><small>#{{ u.id }}</small>
                  </td>
                  <td>{{ u.email }}</td>
                  <td>{{ labels[u.perfil] }}</td>
                  <td>{{ u.setor_nome || "—" }}</td>
                  <td>
                    <span class="status" [class.done]="u.ativo">{{
                      u.ativo ? "Ativo" : "Inativo"
                    }}</span>
                  </td>
                  <td>
                    <button
                      class="text-link"
                      [disabled]="saving()"
                      (click)="edit(u)"
                      [attr.aria-label]="'Editar usuário ' + u.nome"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div class="pagination">
        <span>{{ items().length }} usuários nesta página</span>
        <div>
          <button
            class="button secondary compact"
            [disabled]="busy() || offset() === 0"
            (click)="load(offset() - limit)"
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
            (click)="load(offset() + limit)"
          >
            Próxima →
          </button>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>Setores</h2>
        <span class="muted">Organizam a equipe. Não mudam o que cada um vê.</span>
      </div>
      @if (sectorNotice()) {
        <div class="notice" role="status">{{ sectorNotice() }}</div>
      }
      @if (sectorError()) {
        <div class="alert" role="alert">{{ sectorError() }}</div>
      }
      <!-- Formulário simples, sem FormGroup: evita o envio nativo que recarregaria a página. -->
      <form class="sector-form" (submit)="$event.preventDefault(); addSector()">
        <div class="field">
          <label for="new-sector">Novo setor</label
          ><input
            id="new-sector"
            name="new-sector"
            maxlength="80"
            placeholder="Ex.: Vendas, Logística, Manutenção"
            [value]="newSector()"
            (input)="newSector.set($any($event.target).value)"
            [disabled]="sectorBusy()"
          />
        </div>
        <button
          class="button primary compact"
          type="submit"
          [disabled]="sectorBusy() || !newSector().trim()"
        >
          Adicionar setor
        </button>
      </form>
      @if (sectors().length) {
        <div class="table-wrap" role="region" aria-label="Setores" tabindex="0">
          <table>
            <thead>
              <tr>
                <th>Setor</th>
                <th>Usuários ativos</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (s of sectors(); track s.id) {
                <tr>
                  <td>
                    <strong>{{ s.nome }}</strong>
                  </td>
                  <td>{{ s.usuarios }}</td>
                  <td>
                    <span class="status" [class.done]="s.ativo">{{
                      s.ativo ? "Ativo" : "Inativo"
                    }}</span>
                  </td>
                  <td>
                    <button
                      class="text-link"
                      [disabled]="sectorBusy()"
                      (click)="renameSector(s)"
                      [attr.aria-label]="'Renomear setor ' + s.nome"
                    >
                      Renomear</button
                    ><button
                      class="text-link"
                      [disabled]="sectorBusy()"
                      (click)="toggleSector(s)"
                      [attr.aria-label]="
                        (s.ativo ? 'Desativar setor ' : 'Ativar setor ') + s.nome
                      "
                    >
                      {{ s.ativo ? "Desativar" : "Ativar" }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!sectorBusy()) {
        <div class="state-card">
          Nenhum setor ainda. Crie setores como Vendas ou Logística para
          agrupar a equipe na agenda.
        </div>
      }
    </section>
  `,
})
export class UserListPage {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  readonly labels = roleLabel;
  readonly limit = 20;
  readonly offset = signal(0);
  readonly items = signal<Usuario[]>([]);
  readonly busy = signal(true);
  readonly error = signal("");
  readonly notice = signal("");
  readonly editing = signal(false);
  readonly selected = signal<Usuario | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal("");
  readonly errors = signal<Record<string, string>>({});
  readonly sectors = signal<Setor[]>([]);
  readonly sectorBusy = signal(false);
  readonly sectorError = signal("");
  readonly sectorNotice = signal("");
  readonly newSector = signal("");
  /** "" = todos, "sem" = sem setor, ou o id do setor. */
  readonly sectorFilter = signal("");
  readonly visibleItems = computed(() => {
    const filter = this.sectorFilter();
    if (!filter) return this.items();
    return this.items().filter((u) =>
      filter === "sem" ? !u.setor_id : String(u.setor_id) === filter,
    );
  });
  readonly form = new FormGroup({
    nome: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(150)],
    }),
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email, maxCharacters(190)],
    }),
    perfil: new FormControl<Perfil>("funcionario", { nonNullable: true }),
    ativo: new FormControl(true, { nonNullable: true }),
    setor_id: new FormControl<number | null>(null),
    senha: new FormControl("", { nonNullable: true }),
  });
  private generation = 0;
  constructor() {
    warnBeforeUnload(this);
    void this.load(0);
    void this.loadSectors();
  }
  /** Setores ativos, mais o setor atual do usuário em edição se estiver inativo. */
  sectorChoices(): Setor[] {
    const current = this.selected()?.setor_id;
    return this.sectors().filter((s) => s.ativo || s.id === current);
  }
  async loadSectors(): Promise<void> {
    try {
      this.sectors.set(await this.api.sectors());
    } catch (error) {
      this.sectorError.set(errorMessage(error));
    }
  }
  private async sectorAction(
    action: () => Promise<Setor>,
    message: string,
  ): Promise<boolean> {
    if (this.sectorBusy()) return false;
    this.sectorBusy.set(true);
    this.sectorError.set("");
    this.sectorNotice.set("");
    try {
      await action();
      this.sectorNotice.set(message);
      await this.loadSectors();
      return true;
    } catch (error) {
      const fields = fieldErrors(error);
      this.sectorError.set(fields["nome"] || errorMessage(error));
      return false;
    } finally {
      this.sectorBusy.set(false);
    }
  }
  async addSector(): Promise<void> {
    const nome = this.newSector().trim();
    if (!nome) return;
    if (await this.sectorAction(() => this.api.createSector(nome), "Setor criado.")) {
      this.newSector.set("");
    }
  }
  async renameSector(sector: Setor): Promise<void> {
    const nome = window.prompt("Novo nome do setor:", sector.nome)?.trim();
    if (!nome || nome === sector.nome) return;
    if (
      await this.sectorAction(
        () => this.api.updateSector(sector.id, { nome }),
        "Setor renomeado.",
      )
    ) {
      await this.load(this.offset());
    }
  }
  async toggleSector(sector: Setor): Promise<void> {
    if (
      sector.ativo &&
      !window.confirm(
        `Desativar o setor ${sector.nome}? Quem já está nele continua no setor, mas ele não aparece para novos cadastros.`,
      )
    ) {
      return;
    }
    await this.sectorAction(
      () => this.api.updateSector(sector.id, { ativo: !sector.ativo }),
      sector.ativo ? "Setor desativado." : "Setor ativado.",
    );
  }
  hasUnsavedChanges(): boolean {
    return this.editing() && (this.form.dirty || this.saving());
  }
  invalid(key: keyof typeof this.form.controls): boolean {
    return (
      !!this.errors()[key] ||
      (this.form.controls[key].touched && this.form.controls[key].invalid)
    );
  }
  private change(user: Usuario | null): void {
    if (
      this.editing() &&
      this.form.dirty &&
      !window.confirm("Descartar alterações deste usuário?")
    ) {
      return;
    }
    this.selected.set(user);
    this.editing.set(true);
    this.saveError.set("");
    this.errors.set({});
    this.notice.set("");
    this.form.controls.senha.setValidators(
      user
        ? []
        : [
            Validators.required,
            passwordBytes,
            (control) =>
              new TextEncoder().encode(control.value).length < 8
                ? { minbytes: true }
                : null,
          ],
    );
    this.form.reset({
      nome: user?.nome ?? "",
      email: user?.email ?? "",
      perfil: user?.perfil ?? "funcionario",
      ativo: user?.ativo ?? true,
      setor_id: user?.setor_id ?? null,
      senha: "",
    });
  }
  newUser(): void {
    this.change(null);
  }
  edit(user: Usuario): void {
    this.change(user);
  }
  cancel(): void {
    if (
      this.form.dirty &&
      !window.confirm("Descartar alterações deste usuário?")
    ) {
      return;
    }
    this.editing.set(false);
    this.form.reset();
  }
  async load(offset: number): Promise<void> {
    const generation = ++this.generation;
    this.busy.set(true);
    this.error.set("");
    try {
      const page = await this.api.users(this.limit, offset);
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
  async save(): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    this.saveError.set("");
    this.errors.set({});
    const selected = this.selected();
    const raw = this.form.getRawValue();
    const data: UserPatch = {
      nome: raw.nome,
      email: raw.email,
      perfil: raw.perfil,
      ativo: raw.ativo,
      setor_id: raw.setor_id,
    };
    try {
      const user = selected
        ? await this.api.updateUser(selected.id, data)
        : await this.api.createUser(raw as NewUser);
      this.form.reset();
      this.editing.set(false);
      this.notice.set(selected ? "Usuário atualizado." : "Usuário criado.");
      const login = this.session.current();
      if (login && user.id === login.usuario.id) {
        if (!user.ativo) {
          this.session.clear("Sua conta foi desativada.");
          await this.router.navigateByUrl("/login");
          return;
        }
        this.session.open({ ...login, usuario: user });
        if (user.perfil !== "admin") {
          await this.router.navigateByUrl("/");
          return;
        }
      }
      await this.load(this.offset());
      void this.loadSectors();
    } catch (error) {
      this.saveError.set(errorMessage(error));
      this.errors.set(fieldErrors(error));
    } finally {
      this.saving.set(false);
      this.form.controls.senha.reset();
    }
  }
}
