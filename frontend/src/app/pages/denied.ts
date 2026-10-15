import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
@Component({
  imports: [RouterLink],
  template: `<section class="state-card">
    <span class="eyebrow">ACESSO RESTRITO</span>
    <h1>Acesso não permitido</h1>
    <p>Seu perfil não tem acesso a esta área.</p>
    <a routerLink="/" class="button primary">Voltar ao início</a>
  </section>`,
})
export class DeniedPage {}
@Component({
  imports: [RouterLink],
  template: `<section class="state-card">
    <span class="eyebrow">404</span>
    <h1>Página não encontrada</h1>
    <p>O endereço acessado não está disponível.</p>
    <a routerLink="/" class="button primary">Voltar ao início</a>
  </section>`,
})
export class NotFoundPage {}
