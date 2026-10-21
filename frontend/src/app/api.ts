import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { API_CONFIG } from "./config";
import {
  ApiResponse,
  Page,
  Visita,
  Usuario,
  Responsavel,
  NewVisit,
  VisitPatch,
  VisitFilters,
  NewUser,
  UserPatch,
  Agendamento,
  NovaAgenda,
  AgendaChange,
  AgendaOptions,
  Cliente,
  ClienteInput,
  Contato,
  ContatoInput,
  Retorno,
} from "./models";
@Injectable({ providedIn: "root" })
export class Api {
  private readonly http = inject(HttpClient);
  async clients(
    limit: number,
    offset: number,
    filters: { q?: string; ativo?: string } = {},
  ): Promise<Page<Cliente>> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Page<Cliente>>>(
          `${API_CONFIG.baseUrl}/clientes`,
          { params: { limit, offset, ...filters } },
        ),
      )
    ).data;
  }
  async client(id: number): Promise<Cliente> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Cliente>>(
          `${API_CONFIG.baseUrl}/clientes/${id}`,
        ),
      )
    ).data;
  }
  async saveClient(
    data: ClienteInput | Partial<ClienteInput>,
    id?: number,
  ): Promise<Cliente> {
    return (
      await firstValueFrom(
        id
          ? this.http.patch<ApiResponse<Cliente>>(
              `${API_CONFIG.baseUrl}/clientes/${id}`,
              data,
            )
          : this.http.post<ApiResponse<Cliente>>(
              `${API_CONFIG.baseUrl}/clientes`,
              data,
            ),
      )
    ).data;
  }
  async clientAccess(id: number, ids: number[]): Promise<Cliente> {
    return (
      await firstValueFrom(
        this.http.patch<ApiResponse<Cliente>>(
          `${API_CONFIG.baseUrl}/clientes/${id}/acessos`,
          { funcionarios_ids: ids },
        ),
      )
    ).data;
  }
  async contacts(
    client: number,
    limit = 20,
    offset = 0,
    ativo = "",
  ): Promise<Page<Contato>> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Page<Contato>>>(
          `${API_CONFIG.baseUrl}/clientes/${client}/contatos`,
          { params: { limit, offset, ...(ativo ? { ativo } : {}) } },
        ),
      )
    ).data;
  }
  async saveContact(
    client: number,
    data: ContatoInput,
    id?: number,
  ): Promise<Contato> {
    return (
      await firstValueFrom(
        id
          ? this.http.patch<ApiResponse<Contato>>(
              `${API_CONFIG.baseUrl}/contatos/${id}`,
              data,
            )
          : this.http.post<ApiResponse<Contato>>(
              `${API_CONFIG.baseUrl}/clientes/${client}/contatos`,
              data,
            ),
      )
    ).data;
  }
  async clientHistory(
    id: number,
    kind: "visitas" | "agendamentos",
    offset = 0,
  ): Promise<Page<Visita | Agendamento>> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Page<Visita | Agendamento>>>(
          `${API_CONFIG.baseUrl}/clientes/${id}/${kind}`,
          { params: { limit: 20, offset } },
        ),
      )
    ).data;
  }
  async returns(
    limit: number,
    offset: number,
    filters: {
      inicio?: string;
      fim?: string;
      status?: string;
      funcionario_id?: number;
      referencia?: string;
    } = {},
  ): Promise<Page<Retorno>> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Page<Retorno>>>(
          `${API_CONFIG.baseUrl}/retornos`,
          { params: { limit, offset, ...filters } },
        ),
      )
    ).data;
  }
  async followup(id: number): Promise<Retorno> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Retorno>>(
          `${API_CONFIG.baseUrl}/retornos/${id}`,
        ),
      )
    ).data;
  }
  async finishReturn(
    id: number,
    status: "realizado" | "cancelado",
    observacao: string,
  ): Promise<Retorno> {
    return (
      await firstValueFrom(
        this.http.patch<ApiResponse<Retorno>>(
          `${API_CONFIG.baseUrl}/retornos/${id}`,
          { status, observacao },
        ),
      )
    ).data;
  }
  async scheduleReturn(
    id: number,
    data_hora_prevista: string,
  ): Promise<Agendamento> {
    return (
      await firstValueFrom(
        this.http.post<ApiResponse<Agendamento>>(
          `${API_CONFIG.baseUrl}/retornos/${id}/agendamento`,
          { data_hora_prevista },
        ),
      )
    ).data;
  }
  async agenda(
    limit: number,
    offset: number,
    filters: Omit<VisitFilters, "empresa"> = {},
  ): Promise<Page<Agendamento>> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Page<Agendamento>>>(
          `${API_CONFIG.baseUrl}/agendamentos`,
          { params: { limit, offset, ...filters } },
        ),
      )
    ).data;
  }
  async schedule(id: number): Promise<Agendamento> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Agendamento>>(
          `${API_CONFIG.baseUrl}/agendamentos/${id}`,
        ),
      )
    ).data;
  }
  async agendaOptions(): Promise<AgendaOptions> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<AgendaOptions>>(
          `${API_CONFIG.baseUrl}/agendamentos/opcoes`,
        ),
      )
    ).data;
  }
  async createSchedule(data: NovaAgenda): Promise<Agendamento> {
    return (
      await firstValueFrom(
        this.http.post<ApiResponse<Agendamento>>(
          `${API_CONFIG.baseUrl}/agendamentos`,
          data,
        ),
      )
    ).data;
  }
  async changeSchedule(id: number, data: AgendaChange): Promise<Agendamento> {
    return (
      await firstValueFrom(
        this.http.patch<ApiResponse<Agendamento>>(
          `${API_CONFIG.baseUrl}/agendamentos/${id}`,
          data,
        ),
      )
    ).data;
  }
  async visits(
    limit: number,
    offset: number,
    filters: VisitFilters = {},
  ): Promise<Page<Visita>> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Page<Visita>>>(
          `${API_CONFIG.baseUrl}/visitas`,
          { params: { limit, offset, ...filters } },
        ),
      )
    ).data;
  }
  async visit(id: number): Promise<Visita> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Visita>>(
          `${API_CONFIG.baseUrl}/visitas/${id}`,
        ),
      )
    ).data;
  }
  async create(data: NewVisit, key: string): Promise<Visita> {
    return (
      await firstValueFrom(
        this.http.post<ApiResponse<Visita>>(
          `${API_CONFIG.baseUrl}/visitas`,
          data,
          { headers: { "Idempotency-Key": key } },
        ),
      )
    ).data;
  }
  async createUser(data: NewUser): Promise<Usuario> {
    return (
      await firstValueFrom(
        this.http.post<ApiResponse<Usuario>>(
          `${API_CONFIG.baseUrl}/usuarios`,
          data,
        ),
      )
    ).data;
  }
  async updateUser(id: number, data: UserPatch): Promise<Usuario> {
    return (
      await firstValueFrom(
        this.http.patch<ApiResponse<Usuario>>(
          `${API_CONFIG.baseUrl}/usuarios/${id}`,
          data,
        ),
      )
    ).data;
  }
  async update(id: number, data: VisitPatch): Promise<Visita> {
    return (
      await firstValueFrom(
        this.http.patch<ApiResponse<Visita>>(
          `${API_CONFIG.baseUrl}/visitas/${id}`,
          data,
        ),
      )
    ).data;
  }
  async users(limit: number, offset: number): Promise<Page<Usuario>> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Page<Usuario>>>(
          `${API_CONFIG.baseUrl}/usuarios`,
          { params: { limit, offset } },
        ),
      )
    ).data;
  }
  async responsibles(): Promise<Responsavel[]> {
    return (
      await firstValueFrom(
        this.http.get<ApiResponse<Responsavel[]>>(
          `${API_CONFIG.baseUrl}/responsaveis`,
        ),
      )
    ).data;
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 429) {
      const wait = Number(error.headers.get("Retry-After"));
      return `Muitas tentativas de login. Aguarde ${Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : 60} segundos antes de tentar novamente.`;
    }
    if (error.status === 0) {
      return "Não foi possível conectar à API. Verifique sua conexão e tente novamente.";
    }
    if (error.status === 403) {
      return "Você não tem permissão para esta ação.";
    }
    if (error.status === 404) {
      return "Registro não encontrado ou indisponível para seu perfil.";
    }
    return (
      error.error?.message ||
      "Não foi possível concluir a operação. Tente novamente."
    );
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof HttpErrorResponse ? (error.error?.errors ?? {}) : {};
}
