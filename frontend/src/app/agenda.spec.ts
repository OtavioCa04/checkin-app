import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from "@angular/router";
import { Api } from "./api";
import { API_CONFIG } from "./config";
import { AgendaPage } from "./pages/agenda";
import { CreatePage } from "./pages/create";
import { Agendamento, Perfil } from "./models";
import { Session } from "./session";
import { agendaRange, agendaStatus, localInput, toUtc } from "./agenda-dates";
import { utcDate } from "./shared";
import { dayLabel } from "./customer-shared";

const schedule: Agendamento = {
  id: 8,
  usuario_id: 2,
  responsavel_id: 3,
  funcionario_nome: "Funcionário",
  responsavel_nome: "Responsável",
  empresa: "Empresa",
  contato: "Contato",
  assunto: "Reunião",
  observacoes: "Descrição prevista",
  data_hora_prevista: "2028-01-02 12:00:00",
  status: "pendente",
  visita_id: null,
};
function login(perfil: Perfil = "funcionario"): void {
  TestBed.inject(Session).open({
    access_token: "a".repeat(64),
    token_type: "Bearer",
    expires_in: 28800,
    usuario: {
      id: 2,
      nome: "Funcionário",
      email: "teste@example.test",
      ativo: true,
      perfil,
    },
  });
}

describe("datas da agenda", () => {
  it("preserva o dia de retorno e converte UTC perto da meia-noite em São Paulo", () => {
    const format = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });
    expect(format.format(utcDate("2026-10-21 02:59:00"))).toBe(
      "20/10/2026, 23:59",
    );
    expect(format.format(utcDate("2026-10-21 03:00:00"))).toBe(
      "21/10/2026, 00:00",
    );
    expect(dayLabel("2026-10-21")).toBe("21/10/2026");
  });
  it("converte entrada local e preserva ida e volta sem depender de UTC−3 fixo", () => {
    const local = "2028-01-02T09:30";
    const utc = toUtc(local);
    expect(utc).toBe(
      new Date(2028, 0, 2, 9, 30).toISOString().replace(".000Z", "Z"),
    );
    expect(localInput(new Date(utc))).toBe(local);
    expect(() => toUtc("2028-02-30T09:00")).toThrow();
  });
  it("semana vai de segunda a domingo e dia usa intervalo com fim excluído", () => {
    const week = agendaRange("2028-01-05", "semana");
    expect(new Date(week.inicio).getDay()).toBe(1);
    expect(localInput(new Date(week.inicio)).slice(0, 10)).toBe("2028-01-03");
    expect(localInput(new Date(week.fim)).slice(0, 10)).toBe("2028-01-10");
    const day = agendaRange("2028-01-05", "dia");
    expect(localInput(new Date(day.fim))).toBe("2028-01-06T00:00");
    expect(() => agendaRange("2028-02-30", "dia")).toThrow();
  });
  it("atraso é derivado e não altera cancelados ou realizados", () => {
    const now = new Date("2028-01-03T00:00:00Z").getTime();
    expect(agendaStatus(schedule, now)).toBe("atrasado");
    expect(schedule.status).toBe("pendente");
    expect(agendaStatus({ ...schedule, status: "cancelado" }, now)).toBe(
      "cancelado",
    );
    expect(agendaStatus({ ...schedule, status: "realizado" }, now)).toBe(
      "realizado",
    );
  });
});

describe("agenda integrada à API e aos formulários", () => {
  let http: HttpTestingController;
  const route = { snapshot: { queryParamMap: convertToParamMap({}) } };
  beforeEach(() => {
    route.snapshot.queryParamMap = convertToParamMap({});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    login();
  });
  afterEach(() => http.verify());
  async function page(perfil: Perfil = "funcionario") {
    login(perfil);
    const fixture = TestBed.createComponent(AgendaPage);
    if (perfil !== "responsavel")
      http.expectOne(API_CONFIG.baseUrl + "/agendamentos/opcoes").flush({
        data: {
          funcionarios: [{ id: 2, nome: "Funcionário" }],
          responsaveis: [{ id: 3, nome: "Responsável" }],
        },
      });
    http
      .expectOne((r) => r.url.endsWith("/agendamentos"))
      .flush({ data: { items: [schedule], limit: 20, offset: 0 } });
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it("responsável consulta e não vê ações de agendar, reagendar, cancelar ou iniciar", async () => {
    const fixture = await page("responsavel");
    expect(fixture.componentInstance.canManage(schedule)).toBe(false);
    expect(fixture.componentInstance.canStart(schedule)).toBe(false);
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain("Agendar visita");
    expect(text).not.toContain("Iniciar visita");
    expect(text).not.toContain("Reagendar");
  });
  it("envio do formulário da agenda cancela a submissão nativa e valida sem sair da tela", async () => {
    const fixture = await page();
    fixture.componentInstance.newItem();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector(
      ".agenda-editor form",
    ) as HTMLFormElement;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.invalidVisible()).toBe(true);
    http.expectNone((r) => r.method === "POST");
    expect(TestBed.inject(Session).token).not.toBeNull();
  });
  it("funcionário inicia apenas o próprio pendente; realizado não oferece mutações", async () => {
    const fixture = await page();
    const p = fixture.componentInstance;
    expect(p.canStart(schedule)).toBe(true);
    expect(p.canStart({ ...schedule, usuario_id: 9 })).toBe(false);
    expect(p.canStart({ ...schedule, status: "realizado" })).toBe(false);
    p.items.set([{ ...schedule, status: "realizado", visita_id: 10 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      "Iniciar visita com GPS",
    );
    expect(fixture.nativeElement.textContent).not.toContain("Reagendar");
    expect(
      fixture.nativeElement.querySelector('a[href="/visitas/10"]'),
    ).not.toBeNull();
  });
  it("administrador agenda com IDs numéricos e data UTC; bloqueia envio duplicado", async () => {
    const fixture = await page("admin");
    const p = fixture.componentInstance;
    p.newItem();
    p.form.patchValue({
      empresa: "Empresa",
      contato: "Contato",
      assunto: "Assunto",
      observacoes: "",
      usuario_id: 2,
      responsavel_id: 3,
      data: "2028-01-02T09:00",
    });
    const saving = p.save();
    await p.save();
    const req = http.expectOne(API_CONFIG.baseUrl + "/agendamentos");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({
      empresa: "Empresa",
      contato: "Contato",
      assunto: "Assunto",
      observacoes: "",
      usuario_id: 2,
      responsavel_id: 3,
      data_hora_prevista: toUtc("2028-01-02T09:00"),
    });
    req.flush({ data: schedule });
    await Promise.resolve();
    await Promise.resolve();
    http
      .expectOne((r) => r.url.endsWith("/agendamentos"))
      .flush({ data: { items: [schedule], limit: 20, offset: 0 } });
    await saving;
    expect(p.editor()).toBeNull();
    expect(p.hasUnsavedChanges()).toBe(false);
  });
  it("valida motivo, cancela por PATCH e apresenta conflito do backend", async () => {
    const fixture = await page();
    const p = fixture.componentInstance;
    p.edit(schedule, "cancelar");
    await p.save();
    http.expectNone((r) => r.method === "PATCH");
    p.form.controls.motivo.setValue("Cliente cancelou");
    const saving = p.save();
    const req = http.expectOne(API_CONFIG.baseUrl + "/agendamentos/8");
    expect(req.request.body).toEqual({
      acao: "cancelar",
      motivo: "Cliente cancelou",
    });
    req.flush(
      { message: "Agendamento já realizado." },
      { status: 409, statusText: "Conflict" },
    );
    await saving;
    expect(p.error()).toBe("Agendamento já realizado.");
    expect(p.editor()).toBe("cancelar");
    expect(p.saving()).toBe(false);
  });
  it("reagenda com motivo e rejeita horário passado antes de chamar a API", async () => {
    const fixture = await page();
    const p = fixture.componentInstance;
    p.edit(schedule, "reagendar");
    p.form.patchValue({ motivo: "Novo horário", data: "2000-01-01T09:00" });
    await p.save();
    expect(p.error()).toContain("futura");
    http.expectNone((r) => r.method === "PATCH");
    p.form.controls.data.setValue("2028-01-03T09:00");
    const saving = p.save();
    const req = http.expectOne(API_CONFIG.baseUrl + "/agendamentos/8");
    expect(req.request.body).toEqual({
      acao: "reagendar",
      motivo: "Novo horário",
      data_hora_prevista: toUtc("2028-01-03T09:00"),
    });
    req.flush({ data: schedule });
    await Promise.resolve();
    await Promise.resolve();
    http
      .expectOne((r) => r.url.endsWith("/agendamentos"))
      .flush({ data: { items: [], limit: 20, offset: 0 } });
    await saving;
  });
  it("admin envia filtro de funcionário, período UTC e paginação", async () => {
    const fixture = await page("admin");
    const p = fixture.componentInstance;
    p.filters.patchValue({
      modo: "periodo",
      inicio: "2028-01-01T00:00",
      fim: "2028-02-01T00:00",
      status: "atrasado",
      funcionario_id: 2,
    });
    const loading = p.load();
    const req = http.expectOne((r) => r.url.endsWith("/agendamentos"));
    expect(req.request.params.get("funcionario_id")).toBe("2");
    expect(req.request.params.get("status")).toBe("atrasado");
    expect(req.request.params.get("inicio")).toBe(toUtc("2028-01-01T00:00"));
    expect(req.request.params.get("limit")).toBe("20");
    req.flush({ data: { items: [], limit: 20, offset: 0 } });
    await loading;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Nenhum agendamento");
  });
  it("ignora resposta de uma consulta anterior depois de aplicar outro filtro", async () => {
    const fixture = await page();
    const p = fixture.componentInstance;
    const a = p.load();
    const old = http.expectOne((r) => r.url.endsWith("/agendamentos"));
    p.filters.controls.status.setValue("cancelado");
    const b = p.load();
    const current = http.expectOne((r) => r.url.endsWith("/agendamentos"));
    current.flush({ data: { items: [], limit: 20, offset: 0 } });
    await b;
    old.flush({ data: { items: [schedule], limit: 20, offset: 0 } });
    await a;
    expect(p.items()).toEqual([]);
  });
  it("iniciar usa o formulário existente, pré-preenche e envia vínculo numérico com GPS", async () => {
    route.snapshot.queryParamMap = convertToParamMap({ agendamento_id: "8" });
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(CreatePage);
    http
      .expectOne(API_CONFIG.baseUrl + "/responsaveis")
      .flush({ data: [{ id: 3, nome: "Responsável" }] });
    http
      .expectOne(API_CONFIG.baseUrl + "/agendamentos/8")
      .flush({ data: schedule });
    await fixture.whenStable();
    const p = fixture.componentInstance;
    expect(p.form.controls.empresa.value).toBe("Empresa");
    expect(p.responsible.disabled).toBe(true);
    p.coordinates.set({
      latitude: -23.5,
      longitude: -46.6,
      precisao_gps: 10,
      gps_capturado_em: Date.now(),
    });
    const saving = p.submit();
    const req = http.expectOne(API_CONFIG.baseUrl + "/visitas");
    expect(req.request.body.agendamento_id).toBe(8);
    expect(req.request.body.responsavel_id).toBe(3);
    expect(req.request.headers.has("Idempotency-Key")).toBe(true);
    req.flush({ data: { id: 12 } });
    await saving;
    expect(navigate).toHaveBeenCalledWith(["/visitas", 12], expect.anything());
  });
  it("check-in cancelado bloqueia envio e mostra uma mensagem clara", async () => {
    route.snapshot.queryParamMap = convertToParamMap({ agendamento_id: "8" });
    const fixture = TestBed.createComponent(CreatePage);
    http.expectOne(API_CONFIG.baseUrl + "/responsaveis").flush({ data: [] });
    http
      .expectOne(API_CONFIG.baseUrl + "/agendamentos/8")
      .flush({ data: { ...schedule, status: "cancelado" } });
    await fixture.whenStable();
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.scheduleError()).toContain("cancelado");
    http.expectNone((r) => r.method === "POST");
  });
});
