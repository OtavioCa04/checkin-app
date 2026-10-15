import { Component, input } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { textForm } from "./shared";
@Component({
  selector: "visit-text-fields",
  imports: [ReactiveFormsModule],
  template: `
    <div [formGroup]="form()" class="form-grid">
      @for (field of fields; track field.key) {
        <div
          class="field"
          [class.span-two]="
            field.key === 'descricao' || field.key === 'assunto'
          "
        >
          <label [for]="field.key"
            >{{ field.label }} <span aria-hidden="true">*</span></label
          >
          @if (field.key === "descricao") {
            <textarea
              [id]="field.key"
              [formControlName]="field.key"
              rows="5"
              [attr.aria-invalid]="invalid(field.key)"
              [attr.aria-describedby]="field.key + '-error'"
              placeholder="Conte como foi a visita e quais assuntos foram tratados."
            ></textarea>
          } @else {
            <input
              [id]="field.key"
              [formControlName]="field.key"
              [attr.aria-invalid]="invalid(field.key)"
              [attr.aria-describedby]="field.key + '-error'"
              [placeholder]="field.placeholder"
            />
          }
          @if (invalid(field.key)) {
            <small class="field-error" [id]="field.key + '-error'">{{
              errors()[field.key] ||
                "Preencha este campo (até " + field.max + " caracteres)."
            }}</small>
          }
        </div>
      }
    </div>
  `,
})
export class TextFields {
  readonly form = input.required<ReturnType<typeof textForm>>();
  readonly errors = input<Record<string, string>>({});
  readonly fields = [
    {
      key: "contato",
      label: "Nome do contato",
      max: 150,
      placeholder: "Quem você visitou?",
    },
    {
      key: "empresa",
      label: "Empresa visitada",
      max: 180,
      placeholder: "Nome da empresa",
    },
    {
      key: "assunto",
      label: "Assunto da visita",
      max: 200,
      placeholder: "Qual foi o motivo do encontro?",
    },
    { key: "descricao", label: "Descrição", max: 10000, placeholder: "" },
  ] as const;
  invalid(key: keyof ReturnType<typeof textForm>["controls"]): boolean {
    return (
      !!this.errors()[key] ||
      (this.form().controls[key].touched && this.form().controls[key].invalid)
    );
  }
}
