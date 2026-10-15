import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { App } from "./app/app";
import { routes } from "./app/routes";
import { authInterceptor } from "./app/auth";
bootstrapApplication(App, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
  ],
}).catch(() => {
  document.body.textContent =
    "Não foi possível iniciar a aplicação. Recarregue a página.";
});
