import { Component, DestroyRef, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { Auth } from "../auth";
import { Session } from "../session";
import { errorMessage } from "../api";
import { passwordBytes, maxCharacters } from "../shared";
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-layout">
      <section class="login-story">
        <div class="brand">
          <span class="brand-mark">↗</span
          ><span>em campo<small>GESTÃO DE VISITAS</small></span>
        </div>
        <div class="story-body">
          <span class="eyebrow">PRESENTE EM CADA CONEXÃO</span>
          <h1>Boas visitas.<br />Histórias bem<br /><em>registradas.</em></h1>
          <p>
            Um espaço para registrar seus encontros, acompanhar o trabalho em
            campo e seguir em frente.
          </p>
          <div class="route-art" aria-hidden="true">
            <span class="route-point">01</span><i></i
            ><span class="route-point end">02</span>
            <div>CHECK-IN <span>→</span> CONCLUSÃO</div>
          </div>
        </div>
        <span class="story-footer">Cada encontro conta.</span>
      </section>
      <section class="login-form">
        <div class="login-card">
          <span class="eyebrow">BEM-VINDO AO EM CAMPO</span>
          <h2>Entre na sua conta</h2>
          <p class="muted">Acesse suas visitas e continue de onde parou.</p>
          @if (session.notice()) {
            <div class="notice" role="status">{{ session.notice() }}</div>
          }
          @if (error()) {
            <div class="alert" role="alert">{{ error() }}</div>
          }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label for="email">E-mail</label
              ><input
                id="email"
                type="email"
                formControlName="email"
                autocomplete="username"
                placeholder="seu.nome@empresa.com"
                [attr.aria-invalid]="
                  form.controls.email.touched && form.controls.email.invalid
                "
                aria-describedby="email-error"
              />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <small class="field-error" id="email-error"
                  >Informe um e-mail válido de até 190 caracteres.</small
                >
              }
            </div>
            <div class="field">
              <label for="senha">Senha</label
              ><input
                id="senha"
                type="password"
                formControlName="senha"
                autocomplete="current-password"
                placeholder="Digite sua senha"
                [attr.aria-invalid]="
                  form.controls.senha.touched && form.controls.senha.invalid
                "
                aria-describedby="senha-error"
              />
              @if (form.controls.senha.touched && form.controls.senha.invalid) {
                <small class="field-error" id="senha-error"
                  >Informe sua senha (até 72 bytes).</small
                >
              }
            </div>
            <button
              class="button primary full"
              type="submit"
              [disabled]="busy() || wait() > 0"
            >
              {{
                busy()
                  ? "Entrando…"
                  : wait() > 0
                    ? "Aguarde " + wait() + " s"
                    : "Entrar"
              }}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p class="login-footnote">
            Sua sessão fica apenas neste navegador.<br />Ao recarregar a página,
            entre novamente.
          </p>
        </div>
      </section>
    </div>
  `,
})
export class LoginPage {
  readonly session = inject(Session);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly clock = signal(Date.now());
  private retryAt = 0;
  constructor() {
    const timer = window.setInterval(() => this.clock.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }
  wait(): number {
    return Math.max(0, Math.ceil((this.retryAt - this.clock()) / 1000));
  }
  readonly form = new FormGroup({
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email, maxCharacters(190)],
    }),
    senha: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, passwordBytes],
    }),
  });
  async submit(): Promise<void> {
    if (this.busy() || this.wait() > 0) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.busy.set(true);
    this.error.set("");
    this.session.notice.set("");
    try {
      const { email, senha } = this.form.getRawValue();
      await this.auth.login(email.trim(), senha);
      await this.router.navigateByUrl("/");
    } catch (error) {
      this.error.set(errorMessage(error));
      if (error instanceof HttpErrorResponse && error.status === 429) {
        const seconds = Number(error.headers.get("Retry-After"));
        this.retryAt =
          Date.now() +
          (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
        this.clock.set(Date.now());
      }
    } finally {
      this.busy.set(false);
      this.form.controls.senha.reset();
    }
  }
}
