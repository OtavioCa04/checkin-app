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
  cliente_id?: number | null;
  contato_id?: number | null;
  cadastro_snapshot?: string | null;
  resultado?: ResultadoVisita | null;
  resumo_resultado?: string | null;
  proximo_passo?: string | null;
  data_retorno?: string | null;
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
  cliente_id?: number;
  contato_id?: number;
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
export type VisitPatch = Partial<
  VisitText &
    Pick<
      Visita,
      | "status"
      | "resultado"
      | "resumo_resultado"
      | "proximo_passo"
      | "data_retorno"
    >
>;

export interface Agendamento {
  cliente_id?: number | null;
  contato_id?: number | null;
  cadastro_snapshot?: string | null;
  retorno_id?: number | null;
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
  cliente_id?: number;
  contato_id?: number;
  usuario_id: number;
  responsavel_id: number;
  empresa: string;
  contato: string;
  assunto: string;
  observacoes: string;
  data_hora_prevista: string;
}
export interface AgendaChange {
  acao: "cancelar" | "reagendar" | "trocar_responsavel";
  motivo: string;
  data_hora_prevista?: string;
  responsavel_id?: number;
}
export interface AgendaOptions {
  funcionarios: Responsavel[];
  responsaveis: Responsavel[];
}
export type ResultadoVisita =
  "realizada" | "sem_contato" | "reagendar" | "cancelada";
export interface ClienteInput {
  nome_empresa: string;
  nome_fantasia: string;
  cnpj: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
  observacoes: string;
  ativo?: boolean;
}
export interface Cliente extends ClienteInput {
  id: number;
  ativo: boolean;
  pode_editar: boolean;
  criado_por: number;
  criado_em: string;
  atualizado_em: string;
  funcionarios?: {
    usuario_id: number;
    nome: string;
    ativo: boolean;
    perfil: Perfil;
  }[];
}
export interface ContatoInput {
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  principal: boolean;
  ativo?: boolean;
}
export interface Contato extends ContatoInput {
  id: number;
  cliente_id: number;
  ativo: boolean;
  criado_por: number;
  criado_em: string;
  atualizado_em: string;
}
export interface ClienteSelection {
  cliente_id?: number;
  contato_id?: number;
  empresa?: string;
  contato?: string;
}
export interface Retorno {
  id: number;
  visita_id: number;
  cliente_id: number | null;
  contato_id: number | null;
  empresa: string;
  contato: string;
  assunto: string;
  usuario_id: number;
  responsavel_id: number;
  funcionario_nome: string;
  responsavel_nome: string;
  proximo_passo: string | null;
  resumo_resultado: string;
  data_prevista: string;
  status: "pendente" | "realizado" | "cancelado";
  encerrado_por: number | null;
  encerrado_por_nome: string | null;
  encerrado_em: string | null;
  observacao: string | null;
  agendamento_id: number | null;
}
