import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { CreatePage } from './pages/create';
import { DetailPage } from './pages/detail';
import { Session } from './session';
import { authInterceptor } from './auth';
import { API_CONFIG } from './config';
import { Visita } from './models';

const visit: Visita = {
  id: 1, usuario_id: 2, responsavel_id: 3, funcionario_nome: 'Funcionário', responsavel_nome: 'Responsável',
  contato: 'Contato', empresa: 'Empresa', assunto: 'Assunto', descricao: 'Descrição',
  latitude: -23.5, longitude: -46.6, precisao_gps: 12, status: 'em_andamento',
  data_hora_checkin: '2026-10-14 12:00:00', data_hora_checkout: null,
  criado_em: '2026-10-14 12:00:00', atualizado_em: '2026-10-14 12:00:00'
};

describe('envio pelo botão do formulário', () => {
  let http: HttpTestingController;
  let router: Router;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()
    ]});
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    TestBed.inject(Session).open({access_token: 'a'.repeat(64), token_type: 'Bearer', expires_in: 28800,
      usuario: {id:2, nome:'Funcionário', email:'teste@example.test', perfil:'funcionario', ativo:true}});
  });
  afterEach(() => { http.verify(); });

  it('clicar em Registrar envia POST e só navega após a confirmação da API', async () => {
    const fixture = TestBed.createComponent(CreatePage);
    http.expectOne(API_CONFIG.baseUrl + '/responsaveis').flush({success:true, data:[{id:3,nome:'Responsável'}]});
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.componentInstance;
    for (const [key, value] of Object.entries({contato:'Contato',empresa:'Empresa',assunto:'Assunto',descricao:'Descrição'})) {
      const input = fixture.nativeElement.querySelector('#' + key) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input', {bubbles:true}));
    }
    page.responsible.setValue(3);
    page.coordinates.set({latitude:-23.5,longitude:-46.6,precisao_gps:12,gps_capturado_em:Date.now()});
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(form.querySelector('[data-testid="register-checkin"]')?.getAttribute('type')).toBe('button');
    let submitEvent: Event | null = null;
    form.addEventListener('click', event => { submitEvent = event; });
    (form.querySelector('[data-testid="register-checkin"]') as HTMLButtonElement).click();
    expect(submitEvent).not.toBeNull();
    expect((submitEvent as unknown as Event).defaultPrevented).toBe(true);
    const request = http.expectOne(API_CONFIG.baseUrl + '/visitas');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({contato:'Contato',empresa:'Empresa',assunto:'Assunto',descricao:'Descrição',responsavel_id:3,latitude:-23.5,longitude:-46.6,precisao_gps:12,gps_capturado_em:expect.any(Number)});
    expect(request.request.headers.get('Idempotency-Key')).toMatch(/^[a-f0-9-]{36}$/);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(Session).token).not.toBeNull();
    request.flush({success:true,message:'Visita criada com sucesso.',data:visit});
    await fixture.whenStable();
    expect(router.navigate).toHaveBeenCalledWith(['/visitas',1], {state:{createdVisitId:1,message:'Check-in registrado com sucesso'}});
  });

  it('clicar sem GPS mostra validação e não recarrega nem envia a visita', async () => {
    const fixture = TestBed.createComponent(CreatePage);
    http.expectOne(API_CONFIG.baseUrl + '/responsaveis').flush({success:true,data:[{id:3,nome:'Responsável'}]});
    await fixture.whenStable(); fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const event = new Event('submit', {bubbles:true,cancelable:true});
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.gpsError()).toContain('Capture a localização');
    http.expectNone(API_CONFIG.baseUrl + '/visitas');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(Session).token).not.toBeNull();
  });

  it('Enter em um campo valida sem navegar e Enter na descrição mantém a quebra de linha', async () => {
    const fixture = TestBed.createComponent(CreatePage);
    http.expectOne(API_CONFIG.baseUrl + '/responsaveis').flush({success:true,data:[{id:3,nome:'Responsável'}]});
    await fixture.whenStable(); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#contato') as HTMLInputElement;
    const enter = new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.gpsError()).toContain('Capture a localização');
    const textarea = fixture.nativeElement.querySelector('#descricao') as HTMLTextAreaElement;
    const newline = new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
    textarea.dispatchEvent(newline);
    expect(newline.defaultPrevented).toBe(false);
    http.expectNone(API_CONFIG.baseUrl + '/visitas');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clicar em Salvar alterações envia PATCH e impede submissão nativa', async () => {
    const fixture = TestBed.createComponent(DetailPage);
    fixture.componentRef.setInput('id','1'); fixture.detectChanges();
    http.expectOne(API_CONFIG.baseUrl + '/visitas/1').flush({success:true,data:visit});
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.busy()).toBe(false));
    fixture.detectChanges();
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
});
