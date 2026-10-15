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
import { GPS_CONFIG } from "./config";
export const roleLabel = {
  funcionario: "Funcionário",
  responsavel: "Responsável",
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
export interface Coordinates {
  latitude: number;
  longitude: number;
  precisao_gps: number;
  gps_capturado_em: number;
}
export function freshCoordinates(
  value: Coordinates | null,
  now = Date.now(),
): boolean {
  const age = value ? now - value.gps_capturado_em : Infinity;
  return (
    !!value &&
    Number.isFinite(age) &&
    age >= -5000 &&
    age <= Math.min(120_000, Math.max(1, GPS_CONFIG.maxAgeMs))
  );
}
export function locate(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este navegador não oferece geolocalização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          ![latitude, longitude, accuracy].every(Number.isFinite) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180 ||
          accuracy < 0 ||
          accuracy > 999999.99
        ) {
          reject(
            new Error(
              "O dispositivo retornou uma localização inválida. Tente novamente.",
            ),
          );
          return;
        }
        const result = {
          latitude,
          longitude,
          precisao_gps: accuracy,
          gps_capturado_em: position.timestamp,
        };
        if (!freshCoordinates(result)) {
          reject(
            new Error(
              "A localização retornada está desatualizada. Faça nova captura.",
            ),
          );
          return;
        }
        resolve(result);
      },
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Permissão de localização negada. Autorize o acesso nas configurações do navegador e tente novamente."
              : error.code === 2
                ? "Localização indisponível. Verifique o GPS do dispositivo e tente novamente."
                : "A busca da localização demorou demais. Tente novamente.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
