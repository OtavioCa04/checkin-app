import { Injectable, signal } from "@angular/core";
import { Login } from "./models";
@Injectable({ providedIn: "root" })
export class Session {
  private readonly state = signal<Login | null>(null);
  readonly current = this.state.asReadonly();
  readonly notice = signal("");
  get token(): string | null {
    return this.state()?.access_token ?? null;
  }
  get user() {
    return this.state()?.usuario ?? null;
  }
  open(login: Login): void {
    this.state.set(login);
    this.notice.set("");
  }
  clear(message = ""): void {
    this.state.set(null);
    this.notice.set(message);
  }
}
