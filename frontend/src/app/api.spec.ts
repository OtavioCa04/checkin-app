import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Api } from "./api";
import { API_CONFIG } from "./config";
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
  it("responsáveis usam endpoint dedicado, não administrativo", async () => {
    const promise = TestBed.inject(Api).responsibles();
    TestBed.inject(HttpTestingController)
      .expectOne(API_CONFIG.baseUrl + "/responsaveis")
      .flush({
        success: true,
        message: "ok",
        data: [{ id: 3, nome: "Responsável" }],
      });
    expect(await promise).toEqual([{ id: 3, nome: "Responsável" }]);
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
