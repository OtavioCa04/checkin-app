import { TestBed } from "@angular/core/testing";
import { Location } from "@angular/common";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  provideHttpClient,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import {
  provideRouter,
  Router,
  ActivatedRoute,
  convertToParamMap,
  withComponentInputBinding,
} from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { FormControl } from "@angular/forms";
import { Api, errorMessage } from "./api";
import { API_CONFIG, GPS_CONFIG } from "./config";
import { NewVisit, Usuario, Visita } from "./models";
import { Session } from "./session";
import { CreatePage } from "./pages/create";
import { LoginPage } from "./pages/login";
import { Auth } from "./auth";
import { DetailPage } from "./pages/detail";
import { VisitListPage } from "./pages/lists";
import { UserListPage } from "./pages/users";
import { codePointLength, freshCoordinates, maxCharacters } from "./shared";
import { unsavedGuard } from "./unsaved";
import { RouterTestingHarness } from "@angular/router/testing";
import { routes } from "./routes";

const user: Usuario = {
  id: 2,
  nome: "Funcionário",
  email: "a@example.test",
  perfil: "funcionario",
  ativo: true,
};
const visit: Visita = {
  id: 1,
  usuario_id: 2,
  responsavel_id: 3,
  funcionario_nome: "Funcionário",
  responsavel_nome: "Responsável",
  contato: "Contato",
  empresa: "Empresa",
  assunto: "Assunto",
  descricao: "Descrição",
  latitude: -23.5,
  longitude: -46.6,
  precisao_gps: 12,
  data_hora_checkin: "2026-10-13 12:00:00",
  data_hora_checkout: null,
  criado_em: "2026-10-13 12:00:00",
  atualizado_em: "2026-10-13 12:00:00",
  status: "em_andamento",
};
const session = () =>
  TestBed.inject(Session).open({
    access_token: "a".repeat(64),
    token_type: "Bearer",
    expires_in: 28800,
    usuario: user,
  });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function validCreate(page: CreatePage): void {
  page.form.setValue({
    contato: "Contato",
    empresa: "Empresa",
    assunto: "Assunto",
    descricao: "Descrição",
  });
  page.responsible.setValue(3);
  page.coordinates.set({
    latitude: -23.5,
    longitude: -46.6,
    precisao_gps: 12,
    gps_capturado_em: Date.now(),
  });
}
describe("confiabilidade e permissões", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("navegação real entre visitas respeita guard de edição e permite sessão expirada", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        {
          provide: Api,
          useValue: {
            visit: vi.fn((id: number) => Promise.resolve({ ...visit, id })),
          },
        },
      ],
    });
    session();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl("/visitas/1", DetailPage);
    page.startEdit();
    page.form.markAsDirty();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await harness.navigateByUrl("/visitas/2");
    expect(TestBed.inject(Router).url).toBe("/visitas/1");
    expect(confirm).toHaveBeenCalled();
    TestBed.inject(Session).clear();
    await harness.navigateByUrl("/login");
    expect(TestBed.inject(Router).url).toBe("/login");
  });
  it("login respeita espera de 429 e evita nova chamada durante cooldown", async () => {
    const auth = {
      login: vi.fn().mockRejectedValue(
        new HttpErrorResponse({
          status: 429,
          headers: new HttpHeaders({ "Retry-After": "45" }),
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });
    const page = TestBed.createComponent(LoginPage).componentInstance;
    page.form.setValue({ email: "a@example.test", senha: "senha" });
    await page.submit();
    expect(page.wait()).toBeGreaterThan(0);
    await page.submit();
    expect(auth.login).toHaveBeenCalledOnce();
    page.clock.set(Date.now() + 46000);
    expect(page.wait()).toBe(0);
  });
  it("carregamento tardio de A não substitui B", async () => {
    const late = deferred<Visita>();
    const api = {
      visit: vi.fn((id: number) =>
        id === 1 ? late.promise : Promise.resolve({ ...visit, id }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    session();
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput("id", "1");
    fixture.detectChanges();
    fixture.componentRef.setInput("id", "2");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.visit()?.id).toBe(2);
    late.resolve(visit);
    await Promise.resolve();
    expect(fixture.componentInstance.visit()?.id).toBe(2);
    expect(fixture.componentInstance.message()).toBe("");
  });
  it("Unicode conta emojis da mesma forma que mb_strlen", () => {
    const control = new FormControl("😀".repeat(150));
    expect(codePointLength(control.value!)).toBe(150);
    expect(maxCharacters(150)(control)).toBeNull();
    control.setValue("😀".repeat(151));
    expect(maxCharacters(150)(control)).not.toBeNull();
    expect(codePointLength("e\u0301")).toBe(2);
  });
  it("GPS expira em 2 minutos inclusive no momento de enviar", async () => {
    const now = Date.now();
    const gps = {
      latitude: 1,
      longitude: 2,
      precisao_gps: 3,
      gps_capturado_em: now - 120000,
    };
    expect(freshCoordinates(gps, now)).toBe(true);
    expect(freshCoordinates(gps, now + 1)).toBe(false);
    const api = {
      responsibles: vi.fn().mockResolvedValue([{ id: 3, nome: "Responsável" }]),
      create: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    const page = TestBed.createComponent(CreatePage).componentInstance;
    await Promise.resolve();
    validCreate(page);
    page.coordinates.set({ ...gps, gps_capturado_em: now - 121000 });
    await page.submit();
    expect(api.create).not.toHaveBeenCalled();
    expect(page.gpsError()).toContain("expirou");
  });
  it("limite GPS configurável nunca supera 2 minutos", () => {
    const old = GPS_CONFIG.maxAgeMs;
    try {
      GPS_CONFIG.maxAgeMs = 300000;
      expect(
        freshCoordinates(
          { latitude: 1, longitude: 2, precisao_gps: 3, gps_capturado_em: 1 },
          120002,
        ),
      ).toBe(false);
    } finally {
      GPS_CONFIG.maxAgeMs = old;
    }
  });
  it("falha incerta repete a mesma chave e snapshot; alteração não cria outra visita", async () => {
    const api = {
      responsibles: vi.fn().mockResolvedValue([{ id: 3, nome: "Responsável" }]),
      create: vi
        .fn()
        .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
        .mockResolvedValue(visit),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, "navigate").mockResolvedValue(true);
    const page = TestBed.createComponent(CreatePage).componentInstance;
    await Promise.resolve();
    validCreate(page);
    await page.submit();
    const pending = page.pending()!;
    expect(pending.key).toMatch(/^[a-f0-9-]{36}$/);
    page.form.controls.empresa.setValue("Alterada");
    await page.submit();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(page.error()).toContain("formulário mudou");
    await page.recover();
    expect(api.create).toHaveBeenNthCalledWith(2, pending.payload, pending.key);
    expect(pending.payload.empresa).toBe("Empresa");
    expect(router.navigate).toHaveBeenCalledWith(["/visitas", 1], {
      state: { createdVisitId: 1, message: "Check-in registrado com sucesso" },
    });
    expect(page.hasUnsavedChanges()).toBe(false);
  });
  it("resposta tardia de gravação A nunca substitui B", async () => {
    const late = deferred<Visita>();
    const api = {
      visit: vi.fn((id: number) => Promise.resolve({ ...visit, id })),
      update: vi.fn(() => late.promise),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    session();
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput("id", "1");
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.startEdit();
    page.form.controls.empresa.setValue("Atualizada A");
    const saving = page.save();
    expect(page.saving()).toBe(true);
    fixture.componentRef.setInput("id", "2");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.visit()?.id).toBe(2);
    late.resolve({ ...visit, empresa: "Atualizada A" });
    await saving;
    expect(page.visit()?.id).toBe(2);
    expect(page.message()).toBe("");
    expect(page.error()).toBe("");
    expect(page.saving()).toBe(false);
  });
  it("erro tardio e conclusão de A não alteram mensagens de B", async () => {
    const late = deferred<Visita>();
    const api = {
      visit: vi.fn((id: number) => Promise.resolve({ ...visit, id })),
      update: vi.fn(() => late.promise),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    session();
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput("id", "1");
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.confirming.set(true);
    page.resultForm.patchValue({
      resultado: "realizada",
      resumo_resultado: "Resumo da visita",
    });
    const saving = page.complete();
    fixture.componentRef.setInput("id", "2");
    fixture.detectChanges();
    await fixture.whenStable();
    late.reject(
      new HttpErrorResponse({ status: 409, error: { message: "A concluída" } }),
    );
    await saving;
    expect(page.visit()?.id).toBe(2);
    expect(page.error()).toBe("");
    expect(api.visit).toHaveBeenCalledTimes(2);
  });
  it("confirmação de criação é exibida uma vez e removida do history", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Api,
          useValue: {
            visit: vi.fn((id: number) => Promise.resolve({ ...visit, id })),
          },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Location), "getState").mockReturnValue({
      createdVisitId: 1,
      message: "Check-in registrado com sucesso",
    });
    const replace = vi.spyOn(TestBed.inject(Location), "replaceState");
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput("id", "1");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.message()).toBe(
      "Check-in registrado com sucesso",
    );
    expect(replace).toHaveBeenCalledWith(expect.any(String), "", {});
    fixture.componentRef.setInput("id", "2");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.message()).toBe("");
  });
  it("guard avisa alterações e não impede logout ou expiração", () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const component = { hasUnsavedChanges: () => true };
    const run = () =>
      TestBed.runInInjectionContext(() =>
        unsavedGuard(component, {} as never, {} as never, {} as never),
      );
    expect(run()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    TestBed.inject(Session).clear();
    expect(run()).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
  });
  it("antes de recarregar avisa formulário sujo, mas não após sucesso", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Api,
          useValue: { responsibles: vi.fn().mockResolvedValue([]) },
        },
      ],
    });
    session();
    const fixture = TestBed.createComponent(CreatePage);
    fixture.componentInstance.form.markAsDirty();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    TestBed.inject(Session).clear();
    const logout = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(logout);
    expect(logout.defaultPrevented).toBe(false);
    fixture.destroy();
  });
  it("frontend informa Retry-After de 429", () => {
    expect(
      errorMessage(
        new HttpErrorResponse({
          status: 429,
          headers: new HttpHeaders({ "Retry-After": "45" }),
        }),
      ),
    ).toContain("45 segundos");
  });
  it("API envia filtros preparados no contrato e chave de idempotência", async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(Api);
    const http = TestBed.inject(HttpTestingController);
    const list = api.visits(20, 0, {
      empresa: "A&B",
      inicio: "2026-10-01T00:00:00Z",
      funcionario_id: 2,
    });
    const req = http.expectOne(
      (r) => r.url === API_CONFIG.baseUrl + "/visitas",
    );
    expect(req.request.params.get("empresa")).toBe("A&B");
    expect(req.request.params.get("funcionario_id")).toBe("2");
    req.flush({ data: { items: [], limit: 20, offset: 0 } });
    await list;
    const data: NewVisit = {
      contato: "Contato",
      empresa: "Empresa",
      assunto: "Assunto",
      descricao: "Descrição",
      responsavel_id: 3,
      latitude: 1,
      longitude: 2,
      precisao_gps: 3,
      gps_capturado_em: Date.now(),
    };
    const creation = api.create(data, "a".repeat(32));
    const post = http.expectOne(API_CONFIG.baseUrl + "/visitas");
    expect(post.request.headers.get("Idempotency-Key")).toBe("a".repeat(32));
    post.flush({ data: visit });
    await creation;
    http.verify();
  });
  it("alterar filtros volta à primeira página e mantém filtros nos links", async () => {
    const params = new BehaviorSubject(
      convertToParamMap({ empresa: "Antiga", offset: "40" }),
    );
    const route = {
      queryParamMap: params,
      snapshot: { queryParams: { empresa: "Antiga", offset: "40" } },
    };
    const api = {
      visits: vi
        .fn()
        .mockResolvedValue({ items: [visit], limit: 20, offset: 40 }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: Api, useValue: api },
      ],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, "navigate").mockResolvedValue(true);
    session();
    const fixture = TestBed.createComponent(VisitListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.items()).toHaveLength(1);
    const link = fixture.nativeElement.querySelector(
      'a[aria-label^="Ver visita"]',
    );
    expect(link.getAttribute("href")).toContain("empresa=Antiga");
    expect(link.getAttribute("href")).toContain("offset=40");
    fixture.componentInstance.filtersForm.controls.empresa.setValue("Nova");
    fixture.componentInstance.applyFilters();
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { empresa: "Nova", offset: 0 },
    });
  });
  it("gestão de usuário envia booleanos e perfil sem senha no PATCH", async () => {
    const api = {
      users: vi.fn().mockResolvedValue({ items: [], limit: 20, offset: 0 }),
      updateUser: vi
        .fn()
        .mockResolvedValue({ ...user, perfil: "responsavel", ativo: false }),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    const page = TestBed.createComponent(UserListPage).componentInstance;
    page.edit(user);
    page.form.patchValue({ perfil: "responsavel", ativo: false });
    await page.save();
    expect(api.updateUser).toHaveBeenCalledWith(2, {
      nome: user.nome,
      email: user.email,
      perfil: "responsavel",
      ativo: false,
    });
    expect(api.updateUser.mock.calls[0][1]).not.toHaveProperty("senha");
  });
});
