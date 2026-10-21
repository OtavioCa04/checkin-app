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
import { BehaviorSubject } from "rxjs";
import { Api } from "./api";
import { API_CONFIG } from "./config";
import { Session } from "./session";
import { Cliente, Contato, Perfil, Retorno, Visita } from "./models";
import {
  clientForm,
  clientPayload,
  cnpjMask,
  validCnpj,
  dayLabel,
  localDay,
  returnSituation,
  snapshotDetails,
} from "./customer-shared";
import { ClientsPage, ClientDetailPage } from "./pages/clients";
import { ReturnsPage, ReturnDetailPage } from "./pages/returns";
import { DetailPage } from "./pages/detail";
import { CreatePage } from "./pages/create";
import { CustomerPicker } from "./customer-picker";

const client: Cliente = {
  id: 1,
  nome_empresa: "Empresa",
  nome_fantasia: "Fantasia",
  cnpj: "11222333000181",
  cep: "12345678",
  logradouro: "Rua",
  numero: "1",
  complemento: "",
  bairro: "Centro",
  cidade: "Cidade",
  uf: "SP",
  pais: "Brasil",
  observacoes: "Observações",
  ativo: true,
  pode_editar: true,
  criado_por: 2,
  criado_em: "2026-10-16 12:00:00",
  atualizado_em: "2026-10-16 12:00:00",
};
const contact: Contato = {
  id: 5,
  cliente_id: 1,
  nome: "Contato",
  cargo: "Compras",
  email: "teste@example.test",
  telefone: "11999999999",
  principal: true,
  ativo: true,
  criado_por: 2,
  criado_em: "2026-10-16 12:00:00",
  atualizado_em: "2026-10-16 12:00:00",
};
const visit: Visita = {
  id: 9,
  usuario_id: 2,
  responsavel_id: 3,
  empresa: "Empresa original",
  contato: "Contato original",
  assunto: "Assunto",
  descricao: "Descrição",
  latitude: -23,
  longitude: -46,
  precisao_gps: 10,
  data_hora_checkin: "2026-10-16 12:00:00",
  data_hora_checkout: null,
  criado_em: "2026-10-16 12:00:00",
  atualizado_em: "2026-10-16 12:00:00",
  status: "em_andamento",
};
const followup: Retorno = {
  id: 4,
  visita_id: 9,
  cliente_id: 1,
  contato_id: 5,
  empresa: "Empresa original",
  contato: "Contato original",
  assunto: "Assunto",
  usuario_id: 2,
  responsavel_id: 3,
  funcionario_nome: "Funcionário",
  responsavel_nome: "Responsável",
  proximo_passo: "Ligar",
  resumo_resultado: "Resumo",
  data_prevista: "2026-10-16",
  status: "pendente",
  encerrado_por: null,
  encerrado_por_nome: null,
  encerrado_em: null,
  observacao: null,
  agendamento_id: null,
};
async function microtasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function login(perfil: Perfil = "funcionario") {
  TestBed.inject(Session).open({
    access_token: "a".repeat(64),
    token_type: "Bearer",
    expires_in: 28800,
    usuario: {
      id: 2,
      nome: "Funcionário",
      email: "teste@example.test",
      perfil,
      ativo: true,
    },
  });
}

describe("cadastros e datas de calendário", () => {
  it("CNPJ é opcional; valida DV numérico e alfanumérico e mascara somente na UI", () => {
    expect(validCnpj("11.222.333/0001-81")).toBe(true);
    expect(validCnpj("12ABC34501DE35")).toBe(true);
    expect(validCnpj("11222333000180")).toBe(false);
    expect(validCnpj("00000000000000")).toBe(false);
    expect(validCnpj("11222333000181!")).toBe(false);
    const form = clientForm();
    form.patchValue({ nome_empresa: "Empresa", cnpj: "11.222.333/0001-81" });
    expect(form.valid).toBe(true);
    expect(clientPayload(form, false).cnpj).toBe("11222333000181");
    expect(clientPayload(form, false)).not.toHaveProperty("ativo");
    expect(cnpjMask("11222333000181")).toBe("11.222.333/0001-81");
    form.controls.cnpj.setValue("");
    expect(clientPayload(form, false).cnpj).toBeNull();
  });
  it("valida campos do endereço e nome da empresa", () => {
    const form = clientForm();
    expect(form.invalid).toBe(true);
    form.patchValue({ nome_empresa: "Empresa", cep: "123", uf: "ABC" });
    expect(form.invalid).toBe(true);
    form.patchValue({ cep: "12345678", uf: "SP" });
    expect(form.valid).toBe(true);
  });
  it("dia de retorno não é convertido para UTC nem deslocado ao exibir", () => {
    expect(dayLabel("2026-10-16")).toBe("16/10/2026");
    expect(localDay(new Date(2026, 9, 16, 23, 59))).toBe("2026-10-16");
    expect(
      returnSituation(
        { ...followup, data_prevista: "2026-10-15" },
        "2026-10-16",
      ),
    ).toBe("atrasado");
    expect(returnSituation(followup, "2026-10-16")).toBe("hoje");
    expect(
      returnSituation({ ...followup, status: "cancelado" }, "2026-10-17"),
    ).toBe("cancelado");
    expect(
      returnSituation({ ...followup, status: "realizado" }, "2026-10-17"),
    ).toBe("realizado");
  });
  it("retratos são lidos do registro e não de consultas ao cadastro atual", () => {
    const snapshot = JSON.stringify({
      cliente: {
        nome_empresa: "Nome antigo",
        cnpj: "11222333000181",
        logradouro: "Rua antiga",
      },
      contato: { nome: "Pessoa antiga", email: "antigo@example.test" },
    });
    expect(snapshotDetails(snapshot)).toContain("Nome antigo");
    expect(snapshotDetails(snapshot)).toContain("Rua antiga");
    expect(snapshotDetails(snapshot)).toContain("11.222.333/0001-81");
    expect(snapshotDetails("invalid")).toBe("");
  });
});

describe("integração de clientes, contatos, resultados e retornos", () => {
  let http: HttpTestingController;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let route: {
    snapshot: {
      queryParams: Record<string, string>;
      queryParamMap: ReturnType<typeof convertToParamMap>;
    };
    queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  };
  beforeEach(() => {
    query = new BehaviorSubject(convertToParamMap({}));
    route = {
      snapshot: { queryParams: {}, queryParamMap: convertToParamMap({}) },
      queryParamMap: query,
    };
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
    vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => http.verify());
  async function clientDetail(
    perfil: Perfil = "funcionario",
    data: Cliente = client,
  ) {
    login(perfil);
    const fixture = TestBed.createComponent(ClientDetailPage);
    fixture.componentRef.setInput("id", "1");
    fixture.detectChanges();
    http.expectOne(API_CONFIG.baseUrl + "/clientes/1").flush({ data });
    await microtasks();
    http
      .expectOne((r) => r.url.endsWith("/clientes/1/contatos"))
      .flush({ data: { items: [contact], limit: 20, offset: 0 } });
    http
      .expectOne((r) =>
        r.url.endsWith(
          "/clientes/1/" +
            (route.snapshot.queryParams["historico"] === "agendamentos"
              ? "agendamentos"
              : "visitas"),
        ),
      )
      .flush({ data: { items: [], limit: 20, offset: 0 } });
    if (perfil === "admin")
      http.expectOne(API_CONFIG.baseUrl + "/agendamentos/opcoes").flush({
        data: {
          funcionarios: [{ id: 2, nome: "Funcionário" }],
          responsaveis: [],
        },
      });
    await microtasks();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  async function returnDetail(
    perfil: Perfil = "funcionario",
    data: Retorno = followup,
  ) {
    login(perfil);
    const fixture = TestBed.createComponent(ReturnDetailPage);
    fixture.componentRef.setInput("id", "4");
    fixture.detectChanges();
    http.expectOne(API_CONFIG.baseUrl + "/retornos/4").flush({ data });
    await microtasks();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it("lista clientes com busca, situação e offset recebidos da URL", async () => {
    route.snapshot.queryParams = { q: "Empresa", ativo: "0", offset: "20" };
    query.next(convertToParamMap(route.snapshot.queryParams));
    const fixture = TestBed.createComponent(ClientsPage);
    const req = http.expectOne((r) => r.url.endsWith("/clientes"));
    expect(req.request.params.get("q")).toBe("Empresa");
    expect(req.request.params.get("ativo")).toBe("0");
    expect(req.request.params.get("offset")).toBe("20");
    req.flush({ data: { items: [], limit: 20, offset: 20 } });
    await microtasks();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Nenhum cliente encontrado",
    );
    expect(fixture.componentInstance.params()).toEqual({
      q: "Empresa",
      ativo: "0",
      offset: 20,
    });
  });
  it("funcionário cria com CNPJ normalizado sem enviar ativo e evita duplicação de clique", async () => {
    const fixture = TestBed.createComponent(ClientsPage);
    http
      .expectOne((r) => r.url.endsWith("/clientes"))
      .flush({ data: { items: [], limit: 20, offset: 0 } });
    await microtasks();
    await fixture.whenStable();
    const p = fixture.componentInstance;
    p.creating.set(true);
    p.form.patchValue({ nome_empresa: "Empresa", cnpj: "11.222.333/0001-81" });
    vi.mocked(TestBed.inject(Router).navigate).mockImplementation(async () => {
      expect(p.hasUnsavedChanges()).toBe(false);
      return true;
    });
    const saving = p.save();
    await p.save();
    const req = http.expectOne(API_CONFIG.baseUrl + "/clientes");
    expect(req.request.method).toBe("POST");
    expect(req.request.body.cnpj).toBe("11222333000181");
    expect(req.request.body).not.toHaveProperty("ativo");
    req.flush({ data: client });
    await saving;
    expect(p.error()).toBe("");
    expect(p.hasUnsavedChanges()).toBe(false);
  });
  it("erro 409 não revela outro cliente na interface e mantém formulário para correção", async () => {
    const fixture = TestBed.createComponent(ClientsPage);
    http
      .expectOne((r) => r.url.endsWith("/clientes"))
      .flush({ data: { items: [], limit: 20, offset: 0 } });
    await microtasks();
    await fixture.whenStable();
    const p = fixture.componentInstance;
    p.creating.set(true);
    p.form.patchValue({ nome_empresa: "Empresa", cnpj: "11222333000181" });
    const saving = p.save();
    http
      .expectOne(API_CONFIG.baseUrl + "/clientes")
      .flush(
        { message: "Não foi possível salvar o cadastro." },
        { status: 409, statusText: "Conflict" },
      );
    await saving;
    expect(p.error()).toBe("Não foi possível salvar o cadastro.");
    expect(p.creating()).toBe(true);
    expect(p.saving()).toBe(false);
  });
  it("responsável consulta histórico e contatos sem ações de edição ou atribuição", async () => {
    const fixture = await clientDetail("responsavel", {
      ...client,
      pode_editar: false,
    });
    expect(fixture.nativeElement.textContent).toContain("Contato");
    expect(fixture.nativeElement.textContent).not.toContain("Editar cliente");
    expect(fixture.nativeElement.textContent).not.toContain("Novo contato");
    expect(fixture.nativeElement.textContent).not.toContain(
      "Acesso de funcionários",
    );
  });
  it("contato criado pelo funcionário mantém e-mail/telefone e não envia situação", async () => {
    const fixture = await clientDetail();
    const p = fixture.componentInstance;
    p.newContact();
    p.contactForm.patchValue({
      nome: "Novo contato",
      email: "teste@example.test",
      telefone: "11999999999",
      principal: true,
    });
    const saving = p.saveContact();
    const req = http.expectOne(API_CONFIG.baseUrl + "/clientes/1/contatos");
    expect(req.request.body).toEqual({
      nome: "Novo contato",
      cargo: "",
      email: "teste@example.test",
      telefone: "11999999999",
      principal: true,
    });
    req.flush({ data: contact });
    await microtasks();
    http
      .expectOne((r) => r.url.endsWith("/clientes/1/contatos"))
      .flush({ data: { items: [contact], limit: 20, offset: 0 } });
    await saving;
    expect(p.contactEditing()).toBe(false);
    expect(p.hasUnsavedChanges()).toBe(false);
  });
  it("somente admin envia alteração explícita de vínculos com IDs numéricos", async () => {
    const fixture = await clientDetail("admin");
    const p = fixture.componentInstance;
    p.accessIds.setValue([2]);
    const saving = p.saveAccess();
    const req = http.expectOne(API_CONFIG.baseUrl + "/clientes/1/acessos");
    expect(req.request.body).toEqual({ funcionarios_ids: [2] });
    req.flush({
      data: {
        ...client,
        funcionarios: [
          {
            usuario_id: 2,
            nome: "Funcionário",
            ativo: true,
            perfil: "funcionario",
          },
        ],
      },
    });
    await saving;
    expect(p.accessIds.pristine).toBe(true);
  });
  it("preserva filtros e paginação do histórico ao abrir uma visita e voltar", async () => {
    route.snapshot.queryParams = {
      q: "Empresa",
      ativo: "1",
      offset: "20",
      historico: "agendamentos",
      historico_offset: "40",
      contatos_offset: "20",
    };
    const fixture = await clientDetail();
    const p = fixture.componentInstance;
    expect(p.historyOffset()).toBe(40);
    expect(p.historyKind()).toBe("agendamentos");
    expect(p.contactOffset()).toBe(20);
    expect(p.visitParams()).toEqual({
      q: "Empresa",
      ativo: "1",
      offset: 20,
      historico: "agendamentos",
      historico_offset: 40,
      contatos_offset: 20,
      origem_cliente: "1",
    });
  });
  it("seletor busca somente clientes ativos do escopo e carrega contatos do cliente selecionado", async () => {
    const fixture = TestBed.createComponent(CustomerPicker);
    fixture.detectChanges();
    const p = fixture.componentInstance;
    http.expectNone((r) => r.url.endsWith("/clientes"));
    p.search.setValue("Empresa");
    const loading = p.find();
    const req = http.expectOne((r) => r.url.endsWith("/clientes"));
    expect(req.request.params.get("ativo")).toBe("1");
    expect(req.request.params.get("q")).toBe("Empresa");
    req.flush({ data: { items: [client], limit: 10, offset: 0 } });
    await loading;
    p.selectClient(client);
    const contacts = http.expectOne((r) =>
      r.url.endsWith("/clientes/1/contatos"),
    );
    expect(contacts.request.params.get("ativo")).toBe("1");
    contacts.flush({ data: { items: [contact], limit: 20, offset: 0 } });
    await microtasks();
    p.contact.setValue(5);
    p.chooseContact();
    expect(p.choice()?.contato_id).toBe(5);
    expect(p.choice()?.cliente_id).toBe(1);
  });
  it("resposta antiga de contatos não mistura clientes após nova seleção", async () => {
    const fixture = TestBed.createComponent(CustomerPicker);
    fixture.detectChanges();
    const p = fixture.componentInstance;
    p.selectClient(client);
    const old = http.expectOne((r) => r.url.endsWith("/clientes/1/contatos"));
    p.selectClient({ ...client, id: 2, nome_empresa: "Outra" });
    http
      .expectOne((r) => r.url.endsWith("/clientes/2/contatos"))
      .flush({ data: { items: [], limit: 20, offset: 0 } });
    await microtasks();
    old.flush({ data: { items: [contact], limit: 20, offset: 0 } });
    await microtasks();
    expect(p.contacts()).toEqual([]);
    expect(p.choice()?.cliente_id).toBe(2);
  });
  it("check-in avulso seleciona IDs numéricos e preserva chave idempotente", async () => {
    const fixture = TestBed.createComponent(CreatePage);
    http
      .expectOne(API_CONFIG.baseUrl + "/responsaveis")
      .flush({ data: [{ id: 3, nome: "Responsável" }] });
    await microtasks();
    await fixture.whenStable();
    const p = fixture.componentInstance;
    p.form.setValue({
      empresa: "Empresa",
      contato: "Contato",
      assunto: "Assunto",
      descricao: "Descrição",
    });
    p.chooseCustomer({
      cliente_id: 1,
      contato_id: 5,
      empresa: "Empresa",
      contato: "Contato",
    });
    p.responsible.setValue(3);
    p.coordinates.set({
      latitude: -23,
      longitude: -46,
      precisao_gps: 10,
      gps_capturado_em: Date.now(),
    });
    const saving = p.submit();
    const req = http.expectOne(API_CONFIG.baseUrl + "/visitas");
    expect(req.request.body.cliente_id).toBe(1);
    expect(req.request.body.contato_id).toBe(5);
    expect(req.request.headers.has("Idempotency-Key")).toBe(true);
    expect(req.request.body).not.toHaveProperty("usuario_id");
    req.flush({ data: visit });
    await saving;
  });
  it("conclusão exige resultado e resumo e envia retorno como dia sem conversão UTC", async () => {
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput("id", "9");
    fixture.detectChanges();
    http.expectOne(API_CONFIG.baseUrl + "/visitas/9").flush({ data: visit });
    await microtasks();
    await fixture.whenStable();
    const p = fixture.componentInstance;
    p.confirming.set(true);
    await p.complete();
    http.expectNone((r) => r.method === "PATCH");
    p.resultForm.patchValue({
      resultado: "reagendar",
      resumo_resultado: "Resumo",
      proximo_passo: "Ligar",
      data_retorno: "2026-10-17",
    });
    const saving = p.complete();
    const req = http.expectOne(API_CONFIG.baseUrl + "/visitas/9");
    expect(req.request.body).toEqual({
      status: "concluida",
      resultado: "reagendar",
      resumo_resultado: "Resumo",
      proximo_passo: "Ligar",
      data_retorno: "2026-10-17",
    });
    req.flush({
      data: {
        ...visit,
        status: "concluida",
        resultado: "reagendar",
        resumo_resultado: "Resumo",
        proximo_passo: "Ligar",
        data_retorno: "2026-10-17",
      },
    });
    await saving;
    expect(p.hasUnsavedChanges()).toBe(false);
  });
  it("visita antiga concluída permanece consultável sem exigir resultado retroativo", async () => {
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput("id", "9");
    fixture.detectChanges();
    http
      .expectOne(API_CONFIG.baseUrl + "/visitas/9")
      .flush({ data: { ...visit, status: "concluida", resultado: null } });
    await microtasks();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "disponível apenas para consulta",
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      "Confirmar conclusão",
    );
    expect(fixture.componentInstance.editable()).toBe(false);
  });
  it("detalhes de visita voltam ao cliente ou retorno com os filtros preservados", () => {
    const fixture = TestBed.createComponent(DetailPage);
    const p = fixture.componentInstance;
    route.snapshot.queryParams = {
      origem_cliente: "1",
      q: "Empresa",
      offset: "20",
    };
    expect(p.backLink()).toEqual(["/clientes", "1"]);
    expect(p.backFilters()).toEqual({ q: "Empresa", offset: "20" });
    route.snapshot.queryParams = { origem_retorno: "4", status: "pendente" };
    expect(p.backLink()).toEqual(["/retornos", "4"]);
    expect(p.backFilters()).toEqual({ status: "pendente" });
  });
  it("retornos preservam filtros na URL, dia de referência local e estado vazio", async () => {
    route.snapshot.queryParams = {
      status: "atrasado",
      inicio: "2026-10-01",
      fim: "2026-11-01",
      offset: "20",
    };
    query.next(convertToParamMap(route.snapshot.queryParams));
    const fixture = TestBed.createComponent(ReturnsPage);
    const req = http.expectOne((r) => r.url.endsWith("/retornos"));
    expect(req.request.params.get("status")).toBe("atrasado");
    expect(req.request.params.get("inicio")).toBe("2026-10-01");
    expect(req.request.params.get("referencia")).toBe(localDay());
    req.flush({ data: { items: [], limit: 20, offset: 20 } });
    await microtasks();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Nenhum retorno");
    expect(fixture.componentInstance.params().offset).toBe(20);
  });
  it("responsável lê retorno sem poder encerrar ou agendar", async () => {
    const fixture = await returnDetail("responsavel");
    expect(fixture.componentInstance.canManage()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain(
      "Encerrar acompanhamento",
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      "Gerar agendamento",
    );
  });
  it("retorno encerrado exibe autor e observação sem ações de mutação", async () => {
    const fixture = await returnDetail("funcionario", {
      ...followup,
      status: "realizado",
      encerrado_por: 2,
      encerrado_por_nome: "Funcionário",
      encerrado_em: "2026-10-16 12:00:00",
      observacao: "Ligação feita",
    });
    expect(fixture.nativeElement.textContent).toContain("Ligação feita");
    expect(fixture.componentInstance.canManage()).toBe(false);
  });
  it("encerrar retorno exige observação, confirma e grava por PATCH sem alterar visita", async () => {
    const fixture = await returnDetail();
    const p = fixture.componentInstance;
    await p.finish();
    http.expectNone((r) => r.method === "PATCH");
    p.finishForm.patchValue({
      status: "cancelado",
      observacao: "Sem necessidade",
    });
    const saving = p.finish();
    await p.finish();
    const req = http.expectOne(API_CONFIG.baseUrl + "/retornos/4");
    expect(req.request.body).toEqual({
      status: "cancelado",
      observacao: "Sem necessidade",
    });
    req.flush({
      data: {
        ...followup,
        status: "cancelado",
        observacao: "Sem necessidade",
        encerrado_por: 2,
        encerrado_em: "2026-10-16 12:00:00",
      },
    });
    await saving;
    http.expectNone((r) => r.url.includes("/visitas"));
    expect(p.hasUnsavedChanges()).toBe(false);
  });
  it("gerar agenda exige ação e confirmação, evita duplicação e mantém retorno pendente", async () => {
    const fixture = await returnDetail();
    const p = fixture.componentInstance;
    http.expectNone((r) => r.method === "POST");
    p.date.setValue("2028-01-02T09:00");
    const event = new Event("submit", { cancelable: true });
    const saving = p.schedule(event);
    await p.schedule(new Event("submit"));
    expect(event.defaultPrevented).toBe(true);
    const req = http.expectOne(API_CONFIG.baseUrl + "/retornos/4/agendamento");
    expect(req.request.body).toEqual({
      data_hora_prevista: new Date(2028, 0, 2, 9)
        .toISOString()
        .replace(".000Z", "Z"),
    });
    req.flush({ data: { id: 20 } });
    await saving;
    expect(p.item()?.status).toBe("pendente");
    expect(p.item()?.agendamento_id).toBe(20);
    expect(p.message()).toContain("continua pendente");
  });
  it("falha de conexão e acesso negado são exibidos sem deixar submissão bloqueada", async () => {
    const fixture = await returnDetail();
    const p = fixture.componentInstance;
    p.finishForm.patchValue({ observacao: "Teste" });
    let saving = p.finish();
    http
      .expectOne(API_CONFIG.baseUrl + "/retornos/4")
      .error(new ProgressEvent("error"));
    await saving;
    expect(p.error()).toContain("conectar");
    expect(p.saving()).toBe(false);
    saving = p.finish();
    http
      .expectOne(API_CONFIG.baseUrl + "/retornos/4")
      .flush({}, { status: 403, statusText: "Forbidden" });
    await saving;
    expect(p.error()).toContain("permissão");
    expect(p.saving()).toBe(false);
  });
});
