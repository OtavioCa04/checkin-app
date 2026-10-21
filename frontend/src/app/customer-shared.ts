import {
  FormControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { ClienteInput, Retorno } from "./models";
import { maxCharacters, nonBlank } from "./shared";

export function normalizeCnpj(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[.\/-]/g, "");
}
export function validCnpj(input: string): boolean {
  const value = normalizeCnpj(input);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value) || /^(\d)\1{13}$/.test(value))
    return false;
  // Rejeita símbolos desconhecidos, sem apagá-los silenciosamente.
  if (
    input.trim().toUpperCase() !== value &&
    !/^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-[0-9]{2}$/.test(
      input.trim().toUpperCase(),
    )
  )
    return false;
  for (let length = 12; length <= 13; length++) {
    let sum = 0,
      weight = 2;
    for (let i = length - 1; i >= 0; i--) {
      sum += (value.charCodeAt(i) - 48) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    if (Number(value[length]) !== (rest < 2 ? 0 : 11 - rest)) return false;
  }
  return true;
}
export function cnpjMask(value: string | null): string {
  if (!value) return "—";
  const raw = normalizeCnpj(value);
  return raw.length === 14
    ? `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`
    : value;
}
const cnpjValidator: ValidatorFn = (c) =>
  !String(c.value || "").trim() || validCnpj(c.value) ? null : { cnpj: true };
export const clientFields = [
  ["nome_empresa", "Nome da empresa *", 180],
  ["nome_fantasia", "Nome fantasia", 180],
  ["cnpj", "CNPJ (opcional)", 18],
  ["cep", "CEP (8 dígitos)", 8],
  ["logradouro", "Logradouro", 200],
  ["numero", "Número", 30],
  ["complemento", "Complemento", 150],
  ["bairro", "Bairro", 100],
  ["cidade", "Cidade", 100],
  ["uf", "UF", 2],
  ["pais", "País", 100],
] as const;
export function clientForm() {
  return new FormGroup({
    nome_empresa: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(180)],
    }),
    nome_fantasia: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(180)],
    }),
    cnpj: new FormControl("", {
      nonNullable: true,
      validators: [cnpjValidator],
    }),
    cep: new FormControl("", {
      nonNullable: true,
      validators: [Validators.pattern(/^\d{8}$/)],
    }),
    logradouro: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(200)],
    }),
    numero: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(30)],
    }),
    complemento: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(150)],
    }),
    bairro: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(100)],
    }),
    cidade: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(100)],
    }),
    uf: new FormControl("", {
      nonNullable: true,
      validators: [Validators.pattern(/^[A-Za-z]{2}$/)],
    }),
    pais: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(100)],
    }),
    observacoes: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(10000)],
    }),
    ativo: new FormControl(true, { nonNullable: true }),
  });
}
export function clientPayload(
  form: ReturnType<typeof clientForm>,
  admin: boolean,
): ClienteInput {
  const { ativo, ...value } = form.getRawValue();
  return {
    ...value,
    cnpj: value.cnpj ? normalizeCnpj(value.cnpj) : null,
    ...(admin ? { ativo } : {}),
  };
}
export function contactForm() {
  return new FormGroup({
    nome: new FormControl("", {
      nonNullable: true,
      validators: [nonBlank, maxCharacters(150)],
    }),
    cargo: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(120)],
    }),
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.email, maxCharacters(190)],
    }),
    telefone: new FormControl("", {
      nonNullable: true,
      validators: [maxCharacters(40)],
    }),
    principal: new FormControl(false, { nonNullable: true }),
    ativo: new FormControl(true, { nonNullable: true }),
  });
}
export function dayLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function returnSituation(item: Retorno, today = localDay()): string {
  return item.status !== "pendente"
    ? item.status
    : item.data_prevista < today
      ? "atrasado"
      : item.data_prevista === today
        ? "hoje"
        : "pendente";
}
export function snapshotDetails(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const snapshot = JSON.parse(value),
      c = snapshot.cliente,
      p = snapshot.contato;
    if (!c) return "";
    return [
      c.nome_empresa,
      c.nome_fantasia,
      c.cnpj ? cnpjMask(c.cnpj) : "",
      [
        c.logradouro,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.uf,
        c.cep,
        c.pais,
      ]
        .filter(Boolean)
        .join(" · "),
      p
        ? [p.nome, p.cargo, p.email, p.telefone].filter(Boolean).join(" · ")
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}
