import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { Api } from "./api";
import { Auth } from "./auth";
import { Session } from "./session";
import { CreatePage } from "./pages/create";
import { LoginPage } from "./pages/login";
import { DetailPage } from "./pages/detail";
import { canEdit, passwordBytes, textForm, utcDate } from "./shared";
import { PHOTO_CONFIG, preparePhoto } from "./photo";
import { clientAddress } from "./customer-shared";
import { FormControl } from "@angular/forms";
import { Visita, NewVisit } from "./models";
const visit: Visita = {
  id: 1,
  usuario_id: 2,
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
describe("formulários, dados, local e foto", () => {
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
  it("concluídas e visitas de outro funcionário não podem editar; admin edita em andamento", () => {
    const user = {
      id: 2,
      nome: "Teste",
      email: "a@example.test",
      perfil: "funcionario" as const,
      ativo: true,
    };
    expect(canEdit(user, visit)).toBe(true);
    expect(canEdit(user, { ...visit, status: "concluida" })).toBe(false);
    expect(canEdit({ ...user, id: 9, perfil: "admin" }, visit)).toBe(true);
    expect(
      canEdit({ ...user, perfil: "admin" }, { ...visit, status: "concluida" }),
    ).toBe(false);
    expect(canEdit({ ...user, id: 8 }, visit)).toBe(false);
  });
  it("foto: rejeita não imagem, usa a versão comprimida e limita 5 MB", async () => {
    const text = new File(["x"], "nota.txt", { type: "text/plain" });
    await expect(preparePhoto(text)).rejects.toThrow("arquivo de imagem");
    const original = new File(["abc"], "foto.png", { type: "image/png" });
    const small = new Blob(["j"], { type: "image/jpeg" });
    expect(await preparePhoto(original, async () => small)).toBe(small);
    const huge = new Blob([new Uint8Array(PHOTO_CONFIG.maxBytes + 1)], {
      type: "image/jpeg",
    });
    await expect(preparePhoto(original, async () => huge)).rejects.toThrow(
      "5 MB",
    );
  });
  it("foto: falha na compressão usa o original aceito ou mostra erro", async () => {
    const fail = async (): Promise<Blob> => {
      throw new Error("sem canvas");
    };
    const jpeg = new File(["abc"], "foto.jpg", { type: "image/jpeg" });
    expect(await preparePhoto(jpeg, fail)).toBe(jpeg);
    const heic = new File(["abc"], "foto.heic", { type: "image/heic" });
    await expect(preparePhoto(heic, fail)).rejects.toThrow("JPG, PNG ou WebP");
    const big = new File([new Uint8Array(PHOTO_CONFIG.maxBytes + 1)], "g.jpg", {
      type: "image/jpeg",
    });
    await expect(preparePhoto(big, fail)).rejects.toThrow("5 MB");
  });
  it("endereço do cliente é unido sem separadores soltos", () => {
    expect(
      clientAddress(
        {
          logradouro: "Av. Paulista",
          numero: "1000",
          complemento: " ",
          bairro: "",
          cidade: "São Paulo",
          uf: "SP",
          cep: "",
          pais: "",
        },
        ", ",
      ),
    ).toBe("Av. Paulista 1000, São Paulo SP");
    expect(clientAddress({ logradouro: "", cidade: "" })).toBe("");
  });
  it("cliente escolhido sugere o local sem sobrescrever o que foi digitado", async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: {} }],
    });
    const page = TestBed.createComponent(CreatePage).componentInstance;
    page.chooseCustomer({ cliente_id: 1, empresa: "A", endereco: "Rua A, 1" });
    expect(page.local.value).toBe("Rua A, 1");
    page.chooseCustomer({ cliente_id: 2, empresa: "B", endereco: "Rua B, 2" });
    expect(page.local.value).toBe("Rua B, 2");
    page.local.setValue("Portaria lateral");
    page.chooseCustomer({ cliente_id: 3, empresa: "C", endereco: "Rua C, 3" });
    expect(page.local.value).toBe("Portaria lateral");
    page.chooseCustomer({ cliente_id: 4, empresa: "D" });
    expect(page.local.value).toBe("Portaria lateral");
  });
  it("criação exige local, envia sem GPS e bloqueia submissões duplicadas", async () => {
    let finish!: (v: Visita) => void;
    const api = {
      create: vi.fn(
        (_data: NewVisit) =>
          new Promise<Visita>((resolve) => {
            finish = resolve;
          }),
      ),
      uploadVisitPhoto: vi.fn(),
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
    await page.submit();
    expect(api.create).not.toHaveBeenCalled();
    expect(page.localInvalid()).toBe(true);
    page.local.setValue("Av. Paulista, 1000 – São Paulo");
    const promise = page.submit();
    await page.submit();
    expect(api.create).toHaveBeenCalledTimes(1);
    const body = api.create.mock.calls[0]?.[0];
    expect(body).toEqual({
      contato: "Contato",
      empresa: "Empresa",
      assunto: "Assunto",
      descricao: "Descrição",
      local: "Av. Paulista, 1000 – São Paulo",
    });
    for (const key of [
      "latitude",
      "longitude",
      "precisao_gps",
      "gps_capturado_em",
    ])
      expect(body).not.toHaveProperty(key);
    finish(visit);
    await promise;
    expect(api.uploadVisitPhoto).not.toHaveBeenCalled();
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
    // Visita antiga sem local continua mostrando as coordenadas, nunca "null".
    expect(fixture.nativeElement.textContent).toContain("-23.5, -46.6");
    expect(fixture.nativeElement.textContent).toContain("registro antigo");
    expect(fixture.nativeElement.textContent).not.toContain("null");
    expect(fixture.nativeElement.textContent).not.toContain("Adicionar foto");
    expect(fixture.nativeElement.textContent).not.toContain("Editar dados");
    expect(fixture.nativeElement.textContent).not.toContain("Concluir visita");
  });
});
