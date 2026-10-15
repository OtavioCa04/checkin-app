import { TestBed } from "@angular/core/testing";
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Router, provideRouter } from "@angular/router";
import {
  Auth,
  authInterceptor,
  isApiUrl,
  protectedGuard,
  roleGuard,
} from "./auth";
import { Session } from "./session";
import { API_CONFIG } from "./config";
import { Login } from "./models";
const login: Login = {
  access_token: "a".repeat(64),
  token_type: "Bearer",
  expires_in: 28800,
  usuario: {
    id: 2,
    nome: "Teste",
    email: "teste@example.test",
    perfil: "funcionario",
    ativo: true,
  },
};
describe("autenticação e integração HTTP", () => {
  let http: HttpTestingController;
  let session: Session;
  let router: Router;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    router = TestBed.inject(Router);
    vi.spyOn(router, "navigateByUrl").mockResolvedValue(true);
  });
  afterEach(() => {
    http.verify();
  });
  it("login usa contrato real e valida /me", async () => {
    const promise = TestBed.inject(Auth).login("teste@example.test", "senha");
    const request = http.expectOne(API_CONFIG.baseUrl + "/auth/login");
    expect(request.request.body).toEqual({
      email: "teste@example.test",
      senha: "senha",
    });
    expect(request.request.headers.has("Authorization")).toBe(false);
    request.flush({ success: true, message: "Autenticado.", data: login });
    await Promise.resolve();
    const me = http.expectOne(API_CONFIG.baseUrl + "/auth/me");
    expect(me.request.headers.get("Authorization")).toBe(
      "Bearer " + login.access_token,
    );
    me.flush({ success: true, message: "ok", data: login.usuario });
    await promise;
    expect(session.user?.id).toBe(2);
    expect(new Session().token).toBeNull();
  });
  it("falha ao consultar /me apaga sessão", async () => {
    const promise = TestBed.inject(Auth).login("teste@example.test", "senha");
    const rejected = expect(promise).rejects.toBeTruthy();
    http
      .expectOne(API_CONFIG.baseUrl + "/auth/login")
      .flush({ success: true, data: login });
    await Promise.resolve();
    http
      .expectOne(API_CONFIG.baseUrl + "/auth/me")
      .flush({ message: "Erro" }, { status: 500, statusText: "Error" });
    await rejected;
    expect(session.token).toBeNull();
  });
  it("Bearer fica restrito à origem e ao prefixo da API", () => {
    session.open(login);
    const client = TestBed.inject(HttpClient);
    for (const url of [
      API_CONFIG.baseUrl + "/visitas",
      "https://example.test/api/v1/visitas",
      "http://127.0.0.1:8000/api/v10/visitas",
      "http://127.0.0.1:8000/outro",
    ]) {
      client.get(url).subscribe();
      const req = http.expectOne(url);
      expect(req.request.headers.has("Authorization")).toBe(isApiUrl(url));
      expect(req.request.withCredentials).toBe(false);
      req.flush({});
    }
  });
  it("401 limpa identidade e encaminha ao login", () => {
    session.open(login);
    TestBed.inject(HttpClient)
      .get(API_CONFIG.baseUrl + "/visitas")
      .subscribe({ error: () => {} });
    http
      .expectOne(API_CONFIG.baseUrl + "/visitas")
      .flush(
        { message: "Token expirado" },
        { status: 401, statusText: "Unauthorized" },
      );
    expect(session.token).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith("/login");
  });
  it("401 externo não encerra sessão", () => {
    session.open(login);
    TestBed.inject(HttpClient)
      .get("https://example.test")
      .subscribe({ error: () => {} });
    http
      .expectOne("https://example.test")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(session.token).toBe(login.access_token);
  });
  it("logout chama revogação e limpa memória", async () => {
    session.open(login);
    const promise = TestBed.inject(Auth).logout();
    const req = http.expectOne(API_CONFIG.baseUrl + "/auth/logout");
    expect(req.request.method).toBe("POST");
    req.flush({ success: true, data: null });
    await promise;
    expect(session.token).toBeNull();
  });
  it("guards impedem sessão ausente e perfil incorreto", () => {
    expect(
      TestBed.runInInjectionContext(() =>
        protectedGuard({} as never, {} as never),
      ),
    ).not.toBe(true);
    session.open(login);
    expect(
      TestBed.runInInjectionContext(() =>
        protectedGuard({} as never, {} as never),
      ),
    ).toBe(true);
    expect(
      TestBed.runInInjectionContext(() =>
        roleGuard("admin")({} as never, {} as never),
      ),
    ).not.toBe(true);
    session.open({ ...login, usuario: { ...login.usuario, perfil: "admin" } });
    expect(
      TestBed.runInInjectionContext(() =>
        roleGuard("admin")({} as never, {} as never),
      ),
    ).toBe(true);
  });
});
