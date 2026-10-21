import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Api, errorMessage } from "./api";
import { Cliente, ClienteSelection, Contato } from "./models";

@Component({
  selector: "customer-picker",
  imports: [ReactiveFormsModule],
  template: `
    <section class="customer-picker" aria-label="Cliente e contato cadastrados">
      @if (preset()?.cliente_id) {
        <p class="notice">
          Cliente vinculado #{{ preset()!.cliente_id }} ·
          {{ preset()!.empresa }}. O servidor valida o cadastro ativo ao salvar.
        </p>
      }
      @if (!locked()) {
        <button
          type="button"
          class="text-link"
          [disabled]="disabled()"
          (click)="expanded.set(!expanded())"
        >
          {{
            expanded()
              ? "Ocultar pesquisa de clientes"
              : "Pesquisar cliente cadastrado (opcional)"
          }}
        </button>
        @if (expanded()) {
          <div class="field">
            <label for="client-search"
              >Buscar por empresa, nome fantasia ou CNPJ sem máscara</label
            >
            <div class="search-row">
              <input
                id="client-search"
                [formControl]="search"
                (keydown.enter)="find($event)"
              /><button
                type="button"
                class="button secondary"
                [disabled]="loading() || disabled()"
                (click)="find()"
              >
                Buscar
              </button>
            </div>
          </div>
          @if (loading()) {
            <p role="status">Buscando clientes…</p>
          }
          @if (searched() && !loading() && !clients().length) {
            <p>Nenhum cliente ativo disponível no seu acesso.</p>
          }
          @for (c of clients(); track c.id) {
            <button
              type="button"
              class="button secondary picker-item"
              [disabled]="disabled() || !c.pode_editar"
              (click)="selectClient(c)"
            >
              {{ c.nome_empresa }} #{{ c.id
              }}{{ c.pode_editar ? "" : " · Somente histórico" }}
            </button>
          }
          @if (clients().length || offset()) {
            <div class="pagination">
              <button
                type="button"
                [disabled]="!offset() || loading()"
                (click)="page(-1)"
              >
                Anterior</button
              ><button
                type="button"
                [disabled]="clients().length < 10 || loading()"
                (click)="page(1)"
              >
                Próxima
              </button>
            </div>
          }
        }
        @if (choice()?.cliente_id) {
          <p>
            <strong>Selecionado:</strong>
            {{ choice()?.empresa || preset()?.empresa }} (#{{
              choice()?.cliente_id
            }})
            <button
              type="button"
              class="text-link"
              [disabled]="disabled()"
              (click)="clear()"
            >
              Usar apenas texto
            </button>
          </p>
          <div class="field">
            <label for="client-contact">Contato cadastrado (opcional)</label
            ><select
              id="client-contact"
              [formControl]="contact"
              (change)="chooseContact()"
            >
              <option [ngValue]="null">
                Sem vínculo de contato; preencher nome em texto
              </option>
              @for (c of contacts(); track c.id) {
                <option [ngValue]="c.id">
                  {{ c.nome }}{{ c.principal ? " · Principal" : "" }}
                </option>
              }
            </select>
          </div>
          @if (contactLoading()) {
            <p role="status">Carregando contatos…</p>
          }
          @if (contacts().length || contactOffset()) {
            <div class="pagination">
              <button
                type="button"
                [disabled]="!contactOffset() || contactLoading()"
                (click)="contactPage(-1)"
              >
                Contatos anteriores</button
              ><button
                type="button"
                [disabled]="contacts().length < 20 || contactLoading()"
                (click)="contactPage(1)"
              >
                Mais contatos
              </button>
            </div>
          }
        }
      }
      @if (error()) {
        <div class="alert" role="alert">{{ error() }}</div>
      }
    </section>
  `,
})
export class CustomerPicker {
  private readonly api = inject(Api);
  private dead = false;
  private searchGeneration = 0;
  private contactGeneration = 0;
  readonly preset = input<ClienteSelection | null>(null);
  readonly locked = input(false);
  readonly disabled = input(false);
  readonly selected = output<ClienteSelection>();
  readonly expanded = signal(false);
  readonly search = new FormControl("", { nonNullable: true });
  readonly contact = new FormControl<number | null>(null);
  readonly clients = signal<Cliente[]>([]);
  readonly contacts = signal<Contato[]>([]);
  readonly choice = signal<ClienteSelection | null>(null);
  readonly loading = signal(false);
  readonly contactLoading = signal(false);
  readonly searched = signal(false);
  readonly error = signal("");
  readonly offset = signal(0);
  readonly contactOffset = signal(0);
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.dead = true;
    });
    effect(() => {
      const preset = this.preset();
      this.choice.set(preset);
      this.contact.setValue(preset?.contato_id ?? null);
    });
    effect(() => {
      this.disabled()
        ? this.contact.disable({ emitEvent: false })
        : this.contact.enable({ emitEvent: false });
    });
  }
  async find(event?: Event, reset = true): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled()) return;
    if (reset) this.offset.set(0);
    const generation = ++this.searchGeneration;
    this.loading.set(true);
    this.error.set("");
    this.searched.set(true);
    try {
      const result = await this.api.clients(10, this.offset(), {
        q: this.search.value,
        ativo: "1",
      });
      if (!this.dead && generation === this.searchGeneration)
        this.clients.set(result.items);
    } catch (e) {
      if (!this.dead && generation === this.searchGeneration)
        this.error.set(errorMessage(e));
    } finally {
      if (!this.dead && generation === this.searchGeneration)
        this.loading.set(false);
    }
  }
  page(direction: number): void {
    this.offset.update((n) => Math.max(0, n + 10 * direction));
    void this.find(undefined, false);
  }
  selectClient(client: Cliente): void {
    if (this.disabled()) return;
    this.choice.set({
      cliente_id: Number(client.id),
      empresa: client.nome_empresa,
    });
    this.contact.setValue(null);
    this.contacts.set([]);
    this.contactOffset.set(0);
    this.selected.emit(this.choice()!);
    void this.loadContacts();
  }
  async loadContacts(): Promise<void> {
    const id = this.choice()?.cliente_id;
    if (!id) return;
    const generation = ++this.contactGeneration;
    this.contactLoading.set(true);
    this.error.set("");
    try {
      const result = await this.api.contacts(id, 20, this.contactOffset(), "1");
      if (!this.dead && generation === this.contactGeneration)
        this.contacts.set(result.items);
    } catch (e) {
      if (!this.dead && generation === this.contactGeneration)
        this.error.set(errorMessage(e));
    } finally {
      if (!this.dead && generation === this.contactGeneration)
        this.contactLoading.set(false);
    }
  }
  contactPage(direction: number): void {
    this.contactOffset.update((n) => Math.max(0, n + 20 * direction));
    void this.loadContacts();
  }
  chooseContact(): void {
    if (this.disabled()) return;
    const contact = this.contacts().find(
      (c) => Number(c.id) === Number(this.contact.value),
    );
    const current = this.choice();
    if (!current) return;
    const value = {
      cliente_id: current.cliente_id,
      empresa: current.empresa,
      ...(contact
        ? { contato_id: Number(contact.id), contato: contact.nome }
        : {}),
    };
    this.choice.set(value);
    this.selected.emit(value);
  }
  clear(): void {
    if (this.disabled()) return;
    this.contactGeneration++;
    this.contactLoading.set(false);
    this.choice.set(null);
    this.contacts.set([]);
    this.contact.setValue(null);
    this.selected.emit({});
  }
}
