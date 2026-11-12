import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Api } from "./api";
import { API_CONFIG, resolveApiUrl } from "./config";
describe("contratos da API", () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it("paginação usa limit/offset e extrai data", async () => {
    const promise = TestBed.inject(Api).visits(20, 40);
    const req = TestBed.inject(HttpTestingController).expectOne(
      API_CONFIG.baseUrl + "/visitas?limit=20&offset=40",
    );
    req.flush({
      success: true,
      message: "ok",
      data: { items: [], limit: 20, offset: 40 },
    });
    expect(await promise).toEqual({ items: [], limit: 20, offset: 40 });
  });
  it("opções da agenda usam endpoint dedicado e trazem apenas funcionários", async () => {
    const promise = TestBed.inject(Api).agendaOptions();
    TestBed.inject(HttpTestingController)
      .expectOne(API_CONFIG.baseUrl + "/agendamentos/opcoes")
      .flush({
        success: true,
        message: "ok",
        data: { funcionarios: [{ id: 2, nome: "Funcionário" }] },
      });
    expect(await promise).toEqual({
      funcionarios: [{ id: 2, nome: "Funcionário" }],
    });
  });
  it("conclusão envia status e resultado por PATCH", async () => {
    const body = {
      status: "concluida" as const,
      resultado: "realizada" as const,
      resumo_resultado: "Resumo da visita",
    };
    const promise = TestBed.inject(Api).update(1, body);
    const req = TestBed.inject(HttpTestingController).expectOne(
      API_CONFIG.baseUrl + "/visitas/1",
    );
    expect(req.request.method).toBe("PATCH");
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, data: { id: 1, status: "concluida" } });
    expect((await promise).status).toBe("concluida");
  });
});
describe("endereço da API em config.js", () => {
  it("usa o endereço de produção e remove a barra final", () => {
    expect(resolveApiUrl({ apiUrl: " https://api.exemplo.com.br/api/v1/ " })).toBe("https://api.exemplo.com.br/api/v1");
  });
  it("volta ao endereço local quando config.js falta ou é inválido", () => {
    for (const value of [undefined, null, {}, { apiUrl: "" }, { apiUrl: 42 }, { apiUrl: "não é url" }, { apiUrl: "javascript:alert(1)" }]) {
      expect(resolveApiUrl(value)).toBe("http://127.0.0.1:8000/api/v1");
    }
  });
});
