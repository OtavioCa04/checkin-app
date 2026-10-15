export type Perfil = "funcionario" | "responsavel" | "admin";
export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}
export interface Responsavel {
  id: number;
  nome: string;
}
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
}
export interface Login {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  usuario: Usuario;
}
export interface Visita {
  agendamento_id?: number | null;
  id: number;
  usuario_id: number;
  responsavel_id: number;
  contato: string;
  empresa: string;
  assunto: string;
  descricao: string;
  funcionario_nome?: string;
  responsavel_nome?: string;
  latitude: string | number;
  longitude: string | number;
  precisao_gps: string | number;
  data_hora_checkin: string;
  data_hora_checkout: string | null;
  criado_em: string;
  atualizado_em: string;
  status: "em_andamento" | "concluida";
}
export interface VisitText {
  contato: string;
  empresa: string;
  assunto: string;
  descricao: string;
}
export interface NewVisit extends VisitText {
  agendamento_id?: number;
  responsavel_id: number;
  latitude: number;
  longitude: number;
  precisao_gps: number;
  gps_capturado_em: number;
}
export interface VisitFilters {
  inicio?: string;
  fim?: string;
  status?: string;
  empresa?: string;
  funcionario_id?: number;
}
export interface NewUser {
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  senha: string;
}
export type UserPatch = Partial<
  Pick<Usuario, "nome" | "email" | "perfil" | "ativo">
>;
export type VisitPatch = Partial<VisitText & Pick<Visita, "status">>;

export interface Agendamento {
  id: number;
  usuario_id: number;
  responsavel_id: number;
  funcionario_nome: string;
  responsavel_nome: string;
  empresa: string;
  contato: string;
  assunto: string;
  observacoes: string;
  data_hora_prevista: string;
  status: "pendente" | "realizado" | "cancelado";
  visita_id: number | null;
  eventos?: AgendaEvento[];
}
export interface AgendaEvento {
  id: number;
  autor_id: number;
  autor_nome: string;
  acao: string;
  motivo: string;
  criado_em: string;
  data_anterior: string | null;
  data_nova: string | null;
}
export interface NovaAgenda {
  usuario_id: number;
  responsavel_id: number;
  empresa: string;
  contato: string;
  assunto: string;
  observacoes: string;
  data_hora_prevista: string;
}
export interface AgendaChange {
  acao: "cancelar" | "reagendar";
  motivo: string;
  data_hora_prevista?: string;
}
export interface AgendaOptions {
  funcionarios: Responsavel[];
  responsaveis: Responsavel[];
}
