import { inject, Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { CanActivateFn, Router } from "@angular/router";
import { catchError, firstValueFrom, throwError } from "rxjs";
import { API_CONFIG } from "./config";
import { ApiResponse, Login, Perfil, Usuario } from "./models";
import { Session } from "./session";

export function isApiUrl(url: string): boolean {
  try {
    const target = new URL(
      url,
      globalThis.location?.origin ?? "http://localhost:4200",
    );
    const base = new URL(API_CONFIG.baseUrl);
    return (
      target.origin === base.origin &&
      (target.pathname === base.pathname ||
        target.pathname.startsWith(base.pathname + "/"))
    );
  } catch {
    return false;
  }
}
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(Session);
  const router = inject(Router);
  if (!isApiUrl(request.url)) {
    return next(request);
  }
  const token = session.token;
  const outbound = request.clone({
    withCredentials: false,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });
  return next(outbound).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        session.clear(
          token
            ? "Sua sessão expirou. Entre novamente."
            : "E-mail ou senha inválidos.",
        );
        void router.navigateByUrl("/login");
      }
      return throwError(() => error);
    }),
  );
};
export const protectedGuard: CanActivateFn = () =>
  inject(Session).user ? true : inject(Router).createUrlTree(["/login"]);
export const roleGuard =
  (...roles: Perfil[]): CanActivateFn =>
  () => {
    const user = inject(Session).user;
    const router = inject(Router);
    return !user
      ? router.createUrlTree(["/login"])
      : roles.includes(user.perfil)
        ? true
        : router.createUrlTree(["/acesso-negado"]);
  };
@Injectable({ providedIn: "root" })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  async login(email: string, senha: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<ApiResponse<Login>>(`${API_CONFIG.baseUrl}/auth/login`, {
        email,
        senha,
      }),
    );
    this.session.open(result.data);
    try {
      const me = await firstValueFrom(
        this.http.get<ApiResponse<Usuario>>(`${API_CONFIG.baseUrl}/auth/me`),
      );
      this.session.open({ ...result.data, usuario: me.data });
    } catch (error) {
      this.session.clear();
      throw error;
    }
  }
  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<ApiResponse<null>>(
          `${API_CONFIG.baseUrl}/auth/logout`,
          {},
        ),
      );
      this.session.clear("Sessão encerrada.");
    } catch {
      this.session.clear(
        "Sessão encerrada neste navegador. Não foi possível confirmar a revogação no servidor.",
      );
    }
    await this.router.navigateByUrl("/login");
  }
}
