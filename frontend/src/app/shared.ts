import { Pipe, PipeTransform } from "@angular/core";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Usuario, Visita } from "./models";
export const roleLabel = {
  funcionario: "Funcionário",
  admin: "Administrador",
};
export function canEdit(user: Usuario | null, visit: Visita): boolean {
  return (
    visit.status === "em_andamento" &&
    !!user &&
    (user.perfil === "admin" ||
      (user.perfil === "funcionario" && Number(visit.usuario_id) === user.id))
  );
}
export function utcDate(value: string): Date {
  return new Date(
    value.includes("T")
      ? /Z$|[+-]\d\d:\d\d$/.test(value)
        ? value
        : value + "Z"
      : value.replace(" ", "T") + "Z",
  );
}
@Pipe({ name: "localDate" })
export class LocalDatePipe implements PipeTransform {
  transform(value: string | null): string {
    if (!value) {
      return "—";
    }
    const date = utcDate(value);
    return Number.isNaN(date.getTime())
      ? "Data indisponível"
      : new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(date);
  }
}
export const nonBlank: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null =>
  typeof control.value === "string" && control.value.trim()
    ? null
    : { blank: true };
export const passwordBytes: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null =>
  new TextEncoder().encode(String(control.value ?? "")).length > 72
    ? { bytes: true }
    : null;
export const codePointLength = (value: string): number =>
  Array.from(value).length;
export const maxCharacters =
  (max: number): ValidatorFn =>
  (control) =>
    typeof control.value === "string" && codePointLength(control.value) > max
      ? {
          maxlength: {
            requiredLength: max,
            actualLength: codePointLength(control.value),
          },
        }
      : null;
export function textForm() {
  return new FormGroup({
    contato: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(150)],
    }),
    empresa: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(180)],
    }),
    assunto: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(200)],
    }),
    descricao: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(10000)],
    }),
  });
}

/** Agrupa pessoas por setor, em ordem alfabética, com "Sem setor" por último. */
export function bySector<T extends { nome: string; setor_nome?: string | null }>(
  people: readonly T[],
): { setor: string; pessoas: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const person of people) {
    const key = person.setor_nome || "";
    groups.set(key, [...(groups.get(key) ?? []), person]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([setor, pessoas]) => ({ setor: setor || "Sem setor", pessoas }));
}
