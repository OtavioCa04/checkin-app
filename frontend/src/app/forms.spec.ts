import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { Api } from "./api";
import { Auth } from "./auth";
import { Session } from "./session";
import { CreatePage } from "./pages/create";
import { LoginPage } from "./pages/login";
import { DetailPage } from "./pages/detail";
import { canEdit, locate, passwordBytes, textForm, utcDate } from "./shared";
import { FormControl } from "@angular/forms";
import { Visita, NewVisit } from "./models";
const visit: Visita = {
  id: 1,
  usuario_id: 2,
  responsavel_id: 3,
  contato: "Contato",
  empresa: "Empresa",
  assunto: "Assunto",
  descricao: "Descrição",
  latitude: "-23.5",
  longitude: "-46.6",
  precisao_gps: "12.00",
  data_hora_checkin: "2026-10-13 12:00:00",
  data_hora_checkout: null,
  criado_em: "2026-10-13 12:00:00",
  atualizado_em: "2026-10-13 12:00:00",
  status: "em_andamento",
};
describe("formulários, dados e geolocalização", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("campos rejeitam vazios, espaços e texto longo", () => {
    const form = textForm();
    expect(form.invalid).toBe(true);
    form.setValue({
      contato: " ",
      empresa: "Empresa",
      assunto: "Assunto",
      descricao: "Descrição",
    });
    expect(form.invalid).toBe(true);
    form.controls.contato.setValue("a".repeat(151));
    expect(form.invalid).toBe(true);
    form.controls.contato.setValue("Contato");
    expect(form.valid).toBe(true);
  });
  it("limite de senha conta bytes UTF-8", () => {
    expect(passwordBytes(new FormControl("á".repeat(37)))).toEqual({
      bytes: true,
    });
  });
  it("DATETIME MySQL é interpretado como UTC", () => {
    expect(utcDate("2026-10-13 12:00:00").toISOString()).toBe(
      "2026-10-13T12:00:00.000Z",
    );
  });
  it("concluídas e responsáveis não podem editar", () => {
    const user = {
      id: 2,
      nome: "Teste",
      email: "a@example.test",
      perfil: "funcionario" as const,
      ativo: true,
    };
    expect(canEdit(user, visit)).toBe(true);
    expect(canEdit(user, { ...visit, status: "concluida" })).toBe(false);
    expect(canEdit({ ...user, perfil: "responsavel" }, visit)).toBe(false);
    expect(canEdit({ ...user, id: 8 }, visit)).toBe(false);
  });
  it("GPS produz números e solicita posição atual", async () => {
    const getCurrentPosition = vi.fn(
      (
        success: (position: unknown) => void,
        _error?: unknown,
        _options?: PositionOptions,
      ) =>
        success({
          coords: { latitude: -23.5, longitude: -46.6, accuracy: 12 },
          timestamp: Date.now(),
        }),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    expect(await locate()).toEqual({
      latitude: -23.5,
      longitude: -46.6,
      precisao_gps: 12,
      gps_capturado_em: expect.any(Number),
    });
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
  it("GPS informa permissão negada", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (
          _success: unknown,
          error: (arg: unknown) => void,
        ) => error({ code: 1 }),
      },
    });
    await expect(locate()).rejects.toThrow("Permissão de localização negada");
  });
  it("GPS informa indisponibilidade, timeout e falta de suporte", async () => {
    for (const code of [2, 3]) {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: (
            _success: unknown,
            error: (arg: unknown) => void,
          ) => error({ code }),
        },
      });
      await expect(locate()).rejects.toThrow(
        code === 2 ? "Localização indisponível" : "demorou demais",
      );
    }
    vi.stubGlobal("navigator", {});
    await expect(locate()).rejects.toThrow("não oferece geolocalização");
  });
  it("criação bloqueia ausência de GPS e submissões duplicadas", async () => {
    let finish!: (v: Visita) => void;
    const api = {
      responsibles: vi.fn().mockResolvedValue([{ id: 3, nome: "Responsável" }]),
      create: vi.fn(
        (_data: NewVisit) =>
          new Promise<Visita>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    const page = TestBed.createComponent(CreatePage).componentInstance;
    await Promise.resolve();
    page.form.setValue({
      contato: "Contato",
      empresa: "Empresa",
      assunto: "Assunto",
      descricao: "Descrição",
    });
    page.responsible.setValue(3);
    await page.submit();
    expect(api.create).not.toHaveBeenCalled();
    expect(page.gpsError()).toContain("Capture");
    page.coordinates.set({
      latitude: -23.5,
      longitude: -46.6,
      precisao_gps: 12,
      gps_capturado_em: Date.now(),
    });
    const promise = page.submit();
    await page.submit();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0]?.[0]).toEqual({
      contato: "Contato",
      empresa: "Empresa",
      assunto: "Assunto",
      descricao: "Descrição",
      responsavel_id: 3,
      latitude: -23.5,
      longitude: -46.6,
      precisao_gps: 12,
      gps_capturado_em: expect.any(Number),
    });
    finish(visit);
    await promise;
    expect(page.saving()).toBe(false);
  });
  it("login inválido não chama API; login válido evita duplicação", async () => {
    let finish!: () => void;
    const auth = {
      login: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });
    vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    const page = TestBed.createComponent(LoginPage).componentInstance;
    await page.submit();
    expect(auth.login).not.toHaveBeenCalled();
    page.form.setValue({ email: "a@example.test", senha: "senha" });
    const promise = page.submit();
    await page.submit();
    expect(auth.login).toHaveBeenCalledTimes(1);
    finish();
    await promise;
    expect(page.form.controls.senha.value).toBe("");
  });
  it("detalhe concluído não mostra edição nem conclusão", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Api,
          useValue: {
            visit: vi
              .fn()
              .mockResolvedValue({
                ...visit,
                status: "concluida",
                data_hora_checkout: "2026-10-13 13:00:00",
              }),
          },
        },
      ],
    });
    TestBed.inject(Session).open({
      access_token: "a".repeat(64),
      token_type: "Bearer",
      expires_in: 28800,
      usuario: {
        id: 2,
        nome: "Teste",
        email: "a@example.test",
        perfil: "funcionario",
        ativo: true,
      },
    });
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput("id", "1");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("apenas para consulta");
    expect(fixture.nativeElement.textContent).not.toContain("Editar dados");
    expect(fixture.nativeElement.textContent).not.toContain("Concluir visita");
  });
});
