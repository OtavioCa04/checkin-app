import { Component, input } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import {
  clientFields,
  clientForm,
  cnpjMask,
  validCnpj,
} from "./customer-shared";

@Component({
  selector: "client-fields",
  imports: [ReactiveFormsModule],
  template: `
    <div [formGroup]="form()">
      <div class="form-grid">
        @for (field of fields; track field[0]) {
          <div class="field">
            <label [for]="'client-' + field[0]">{{ field[1] }}</label
            ><input
              [id]="'client-' + field[0]"
              [formControlName]="field[0]"
              (blur)="mask(field[0])"
              [attr.aria-invalid]="
                form().controls[field[0]].touched &&
                form().controls[field[0]].invalid
              "
            />
            @if (
              form().controls[field[0]].touched &&
              form().controls[field[0]].invalid
            ) {
              <small class="field-error">{{
                field[0] === "cnpj"
                  ? "Verifique o CNPJ e seus dígitos."
                  : field[0] === "cep"
                    ? "Use 8 dígitos."
                    : field[0] === "uf"
                      ? "Use duas letras."
                      : "Campo obrigatório ou acima do limite de " +
                        field[2] +
                        " caracteres."
              }}</small>
            }
          </div>
        }
      </div>
      <div class="field">
        <label for="client-notes">Observações (até 10000 caracteres)</label
        ><textarea
          id="client-notes"
          formControlName="observacoes"
          rows="3"
        ></textarea>
      </div>
      @if (admin()) {
        <label class="check-field"
          ><input type="checkbox" formControlName="ativo" /> Cliente
          ativo</label
        >
      }
    </div>
  `,
})
export class ClientFields {
  mask(key: string): void {
    const control = this.form().controls.cnpj;
    if (key === "cnpj" && validCnpj(control.value)) {
      control.setValue(cnpjMask(control.value));
    }
  }
  readonly form = input.required<ReturnType<typeof clientForm>>();
  readonly admin = input(false);
  readonly fields = clientFields;
}
