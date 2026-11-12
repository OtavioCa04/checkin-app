// Endereço da API: em produção vem de config.js (window.EM_CAMPO_CONFIG), editável no servidor sem novo build.
const DEFAULT_API_URL = "http://127.0.0.1:8000/api/v1";

export function resolveApiUrl(runtime: unknown): string {
  const value = (runtime as { apiUrl?: unknown } | null | undefined)?.apiUrl;
  if (typeof value !== "string" || !value.trim()) return DEFAULT_API_URL;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_API_URL;
    return url.href.replace(/\/+$/, "");
  } catch {
    return DEFAULT_API_URL;
  }
}

export const API_CONFIG = {
  baseUrl: resolveApiUrl(
    (globalThis as { EM_CAMPO_CONFIG?: unknown }).EM_CAMPO_CONFIG,
  ),
} as const;
