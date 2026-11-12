import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { CreatePage } from './pages/create';
import { DetailPage } from './pages/detail';
import { Session } from './session';
import { authInterceptor } from './auth';
import { API_CONFIG } from './config';
import { Usuario, Visita } from './models';
import { CHECKIN_MESSAGES, PhotoPicker } from './photo';

const visit: Visita = {
  id: 1, usuario_id: 2, responsavel_id: null, funcionario_nome: 'Funcionário', responsavel_nome: null,
  contato: 'Contato', empresa: 'Empresa', assunto: 'Assunto', descricao: 'Descrição',
  local: 'Av. Paulista, 1000 – São Paulo', tem_foto: false,
  latitude: null, longitude: null, precisao_gps: null, status: 'em_andamento',
  data_hora_checkin: '2026-10-14 12:00:00', data_hora_checkout: null,
  criado_em: '2026-10-14 12:00:00', atualizado_em: '2026-10-14 12:00:00'
};
const owner: Usuario = {id:2, nome:'Funcionário', email:'teste@example.test', perfil:'funcionario', ativo:true};
const fields = {contato:'Contato',empresa:'Empresa',assunto:'Assunto',descricao:'Descrição',local:'Av. Paulista, 1000 – São Paulo'};
const photoUrl = API_CONFIG.baseUrl + '/visitas/1/foto';

describe('envio pelo botão do formulário', () => {
  let http: HttpTestingController;
  let router: Router;
  const login = (usuario: Usuario = owner) => TestBed.inject(Session).open({access_token: 'a'.repeat(64), token_type: 'Bearer', expires_in: 28800, usuario});
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()
    ]});
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:foto-teste');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    login();
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  async function filledCreate() {
    const fixture = TestBed.createComponent(CreatePage);
    await fixture.whenStable();
    fixture.detectChanges();
    for (const [key, value] of Object.entries(fields)) {
      const input = fixture.nativeElement.querySelector('#' + key) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input', {bubbles:true}));
    }
    fixture.detectChanges();
    return fixture;
  }
  async function openDetail(data: Visita) {
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput('id', String(data.id)); fixture.detectChanges();
    http.expectOne(API_CONFIG.baseUrl + '/visitas/' + data.id).flush({success:true,data});
    await vi.waitFor(() => expect(fixture.componentInstance.busy()).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  it('clicar em Registrar envia POST com local, sem GPS, e só navega após a confirmação da API', async () => {
    const fixture = await filledCreate();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(form.querySelector('[data-testid="register-checkin"]')?.getAttribute('type')).toBe('button');
    expect(fixture.nativeElement.querySelector('input[type="file"]')?.getAttribute('capture')).toBe('environment');
    let submitEvent: Event | null = null;
    form.addEventListener('click', event => { submitEvent = event; });
    (form.querySelector('[data-testid="register-checkin"]') as HTMLButtonElement).click();
    expect(submitEvent).not.toBeNull();
    expect((submitEvent as unknown as Event).defaultPrevented).toBe(true);
    const request = http.expectOne(API_CONFIG.baseUrl + '/visitas');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(fields);
    expect(request.request.headers.get('Idempotency-Key')).toMatch(/^[a-f0-9-]{36}$/);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(Session).token).not.toBeNull();
    request.flush({success:true,message:'Visita criada com sucesso.',data:visit});
    await fixture.whenStable();
    http.expectNone(photoUrl);
    expect(router.navigate).toHaveBeenCalledWith(['/visitas',1], {state:{createdVisitId:1,message:'Check-in registrado com sucesso'}});
  });

  it('clicar sem local mostra validação e não envia a visita', async () => {
    const fixture = TestBed.createComponent(CreatePage);
    await fixture.whenStable(); fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const event = new Event('submit', {bubbles:true,cancelable:true});
    form.dispatchEvent(event);
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.localInvalid()).toBe(true);
    expect(fixture.nativeElement.querySelector('#local-error')?.textContent).toContain('Informe o local');
    http.expectNone(API_CONFIG.baseUrl + '/visitas');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('erro de campo "local" vindo da API aparece junto ao campo', async () => {
    const fixture = await filledCreate();
    void fixture.componentInstance.submit();
    http.expectOne(API_CONFIG.baseUrl + '/visitas').flush(
      {success:false,message:'Dados inválidos.',errors:{local:'Informe o local da visita.'}},
      {status:422,statusText:'Unprocessable'});
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#local-error')?.textContent).toContain('Informe o local da visita.');
    expect(fixture.componentInstance.extraErrors()).toEqual([]);
  });

  it('Enter em um campo valida sem navegar e Enter na descrição mantém a quebra de linha', async () => {
    const fixture = TestBed.createComponent(CreatePage);
    await fixture.whenStable(); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#contato') as HTMLInputElement;
    const enter = new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.error()).toContain('Revise');
    const textarea = fixture.nativeElement.querySelector('#descricao') as HTMLTextAreaElement;
    const newline = new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
    textarea.dispatchEvent(newline);
    expect(newline.defaultPrevented).toBe(false);
    http.expectNone(API_CONFIG.baseUrl + '/visitas');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('foto escolhida é enviada após criar a visita, como multipart "foto"', async () => {
    const fixture = await filledCreate();
    const photo = new Blob(['jpeg'], {type:'image/jpeg'});
    fixture.componentInstance.photo.set(photo);
    const saving = fixture.componentInstance.submit();
    const create = http.expectOne(API_CONFIG.baseUrl + '/visitas');
    http.expectNone(photoUrl);
    create.flush({success:true,data:visit});
    const upload = await vi.waitFor(() => http.expectOne(photoUrl));
    expect(upload.request.method).toBe('POST');
    const body = upload.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('foto') as File).name).toBe('foto.jpg');
    expect(upload.request.headers.get('Authorization')).toBe('Bearer ' + 'a'.repeat(64));
    upload.flush({success:true,data:{...visit,tem_foto:true}}, {status:201,statusText:'Created'});
    await saving;
    expect(router.navigate).toHaveBeenCalledWith(['/visitas',1], {state:{createdVisitId:1,message:CHECKIN_MESSAGES.success}});
  });

  it('falha no envio da foto mantém o check-in e abre a visita com aviso', async () => {
    const fixture = await filledCreate();
    fixture.componentInstance.photo.set(new Blob(['jpeg'], {type:'image/jpeg'}));
    const saving = fixture.componentInstance.submit();
    http.expectOne(API_CONFIG.baseUrl + '/visitas').flush({success:true,data:visit});
    const upload = await vi.waitFor(() => http.expectOne(photoUrl));
    upload.flush({success:false,message:'Falha'}, {status:500,statusText:'Error'});
    await saving;
    http.expectNone(API_CONFIG.baseUrl + '/visitas');
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/visitas',1], {state:{createdVisitId:1,message:'Check-in registrado, mas a foto não foi enviada. Tente novamente na visita.'}});
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('clicar em Salvar alterações envia PATCH e impede submissão nativa', async () => {
    const fixture = await openDetail(visit);
    fixture.componentInstance.startEdit(); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#empresa') as HTMLInputElement;
    input.value = 'Empresa editada'; input.dispatchEvent(new Event('input',{bubbles:true}));
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    let event: Event | null = null;
    form.addEventListener('submit', submitted => { event = submitted; });
    (form.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(event).not.toBeNull();
    expect((event as unknown as Event).defaultPrevented).toBe(true);
    const request = http.expectOne(API_CONFIG.baseUrl + '/visitas/1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({contato:'Contato',empresa:'Empresa editada',assunto:'Assunto',descricao:'Descrição'});
    request.flush({success:true,data:{...visit,empresa:'Empresa editada'}});
    await fixture.whenStable();
    expect(fixture.componentInstance.message()).toBe('Alterações salvas.');
    expect(TestBed.inject(Session).token).not.toBeNull();
  });

  it('detalhe mostra o local e carrega a foto como blob autenticado', async () => {
    const fixture = await openDetail({...visit, tem_foto:true});
    expect(fixture.nativeElement.textContent).toContain('Av. Paulista, 1000 – São Paulo');
    expect(fixture.nativeElement.textContent).not.toContain('null');
    const request = http.expectOne(photoUrl);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('Authorization')).toBe('Bearer ' + 'a'.repeat(64));
    request.flush(new Blob(['img'], {type:'image/jpeg'}));
    await vi.waitFor(() => expect(fixture.componentInstance.photoUrl()).toBe('blob:foto-teste'));
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img.visit-photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:foto-teste');
    expect(img.getAttribute('alt')).toContain('Empresa');
    expect(fixture.nativeElement.textContent).not.toContain('Adicionar foto');
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto-teste');
  });

  it('"Adicionar foto" aparece só para o funcionário dono, em andamento e sem foto', async () => {
    for (const [data, user, expected] of [
      [visit, owner, true],
      [{...visit, status:'concluida' as const, data_hora_checkout:'2026-10-14 13:00:00'}, owner, false],
      [visit, {...owner, id:9, perfil:'admin' as const}, false],
      [visit, {...owner, id:8}, false],
    ] as [Visita, Usuario, boolean][]) {
      login(user);
      const fixture = await openDetail(data);
      expect(fixture.componentInstance.canAddPhoto()).toBe(expected);
      expect(fixture.nativeElement.textContent.includes('Adicionar foto')).toBe(expected);
      fixture.destroy();
    }
  });

  it('dono adiciona foto no detalhe e a visita é atualizada', async () => {
    const fixture = await openDetail(visit);
    const picker = fixture.debugElement.query(By.directive(PhotoPicker)).componentInstance as PhotoPicker;
    await picker.select(new File(['jpeg'], 'camera.jpg', {type:'image/jpeg'}));
    fixture.detectChanges();
    expect(fixture.componentInstance.newPhoto()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('img.photo-preview')).not.toBeNull();
    (fixture.nativeElement.querySelector('[data-testid="upload-photo"]') as HTMLButtonElement).click();
    const upload = http.expectOne(photoUrl);
    expect(upload.request.method).toBe('POST');
    expect((upload.request.body as FormData).get('foto')).toBeInstanceOf(Blob);
    upload.flush({success:true,data:{...visit,tem_foto:true}}, {status:201,statusText:'Created'});
    const load = await vi.waitFor(() => http.expectOne(r => r.method === 'GET' && r.url === photoUrl));
    load.flush(new Blob(['img'], {type:'image/jpeg'}));
    await vi.waitFor(() => expect(fixture.componentInstance.photoUrl()).toBe('blob:foto-teste'));
    fixture.detectChanges();
    expect(fixture.componentInstance.visit()?.tem_foto).toBe(true);
    expect(fixture.componentInstance.message()).toBe('Foto adicionada à visita.');
    expect(fixture.nativeElement.textContent).not.toContain('Adicionar foto');
  });
});
