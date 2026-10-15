import { DestroyRef, inject } from "@angular/core";
import { CanDeactivateFn } from "@angular/router";
import { Session } from "./session";
export interface Unsaved {
  hasUnsavedChanges(): boolean;
}
export const unsavedGuard: CanDeactivateFn<Unsaved> = (component) =>
  !inject(Session).user ||
  !component.hasUnsavedChanges() ||
  window.confirm(
    "Há alterações não salvas ou uma operação ainda em andamento. Sair desta tela? Uma gravação já enviada pode ser concluída no servidor.",
  );
export function warnBeforeUnload(component: Unsaved): void {
  const session = inject(Session);
  const handler = (event: BeforeUnloadEvent) => {
    if (session.user && component.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", handler);
  inject(DestroyRef).onDestroy(() =>
    window.removeEventListener("beforeunload", handler),
  );
}
