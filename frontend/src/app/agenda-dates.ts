import { Agendamento } from "./models";
import { utcDate } from "./shared";

export function localInput(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
export function toUtc(value: string): string {
  const date = new Date(value);
  if (
    !value ||
    !Number.isFinite(date.getTime()) ||
    localInput(date) !== value
  ) {
    throw new Error("Informe uma data e hora local válidas.");
  }
  return date.toISOString().replace(".000Z", "Z");
}
export function agendaRange(
  day: string,
  mode: string,
): { inicio: string; fim: string } {
  const start = new Date(`${day}T00:00:00`);
  if (
    !Number.isFinite(start.getTime()) ||
    localInput(start).slice(0, 10) !== day
  ) {
    throw new Error("Informe um dia válido.");
  }
  if (mode === "semana") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + (mode === "semana" ? 7 : 1));
  end.setHours(0, 0, 0, 0);
  return { inicio: toUtc(localInput(start)), fim: toUtc(localInput(end)) };
}
export function agendaStatus(item: Agendamento, now = Date.now()): string {
  return item.status === "pendente" &&
    utcDate(item.data_hora_prevista).getTime() < now
    ? "atrasado"
    : item.status;
}
