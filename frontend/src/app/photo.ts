import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { errorMessage } from "./api";

export const PHOTO_CONFIG = {
  maxBytes: 5 * 1024 * 1024,
  maxSide: 1600,
  quality: 0.8,
  accepted: ["image/jpeg", "image/png", "image/webp"],
} as const;

/** Mensagens passadas do check-in para o detalhe pela navegação. */
export const CHECKIN_MESSAGES = {
  success: "Check-in registrado com sucesso",
  photoFailed:
    "Check-in registrado, mas a foto não foi enviada. Tente novamente na visita.",
} as const;

/** Redimensiona para no máximo 1600 px no maior lado e gera JPEG ~0.8. */
export async function compressImage(
  file: Blob,
  maxSide: number = PHOTO_CONFIG.maxSide,
  quality: number = PHOTO_CONFIG.quality,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext?.("2d");
  if (!context) throw new Error("Canvas indisponível.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const timer = window.setTimeout(
        () => reject(new Error("Tempo esgotado ao ler a imagem.")),
        15000,
      );
      img.onload = () => {
        window.clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Imagem ilegível."));
      };
      img.src = url;
    });
    const width = image.naturalWidth,
      height = image.naturalHeight;
    if (!width || !height) throw new Error("Imagem sem dimensões.");
    const scale = Math.min(1, maxSide / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    // Fundo branco: PNG transparente não vira preto no JPEG.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Falha ao gerar JPEG.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Valida e comprime a foto escolhida. Se a compressão falhar, usa o arquivo
 * original quando ele já está em formato aceito e dentro de 5 MB.
 */
export async function preparePhoto(
  file: File,
  compress: (file: Blob) => Promise<Blob> = compressImage,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  }
  let result: Blob;
  try {
    result = await compress(file);
  } catch {
    if (!(PHOTO_CONFIG.accepted as readonly string[]).includes(file.type)) {
      throw new Error(
        "Não foi possível processar esta imagem. Use uma foto JPG, PNG ou WebP.",
      );
    }
    result = file;
  }
  if (result.size > PHOTO_CONFIG.maxBytes) {
    throw new Error("A foto excede 5 MB mesmo após a compressão.");
  }
  return result;
}

export function photoUploadError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 413) return "A foto excede o limite de 5 MB.";
    if (error.status === 409)
      return (
        error.error?.message ||
        "A visita já foi concluída ou já possui foto."
      );
  }
  return errorMessage(error);
}

/** Seleção opcional de foto com prévia e remoção; emite a foto já comprimida. */
@Component({
  selector: "photo-picker",
  template: `
    <div class="field photo-field">
      <label [for]="inputId()">{{ label() }}</label>
      <input
        #file
        [id]="inputId()"
        type="file"
        accept="image/*"
        capture="environment"
        [disabled]="disabled() || processing()"
        (change)="choose($event)"
      />
      @if (processing()) {
        <small role="status">Preparando foto…</small>
      }
      @if (error()) {
        <small class="field-error" role="alert">{{ error() }}</small>
      }
      @if (preview(); as src) {
        <img class="photo-preview" [src]="src" alt="Prévia da foto escolhida" />
        <button
          type="button"
          class="button secondary compact"
          [disabled]="disabled()"
          (click)="remove()"
        >
          Remover foto
        </button>
      }
      <small class="meta-note"
        >Opcional. JPG, PNG ou WebP, até 5 MB; a imagem é reduzida antes do
        envio.</small
      >
    </div>
  `,
})
export class PhotoPicker {
  readonly label = input("Foto da visita (opcional)");
  readonly inputId = input("visit-photo");
  readonly disabled = input(false);
  readonly changed = output<Blob | null>();
  readonly preview = signal<string | null>(null);
  readonly processing = signal(false);
  readonly error = signal("");
  private readonly file = viewChild<ElementRef<HTMLInputElement>>("file");
  private generation = 0;
  private dead = false;
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.dead = true;
      this.setPreview(null);
    });
  }
  async choose(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await this.select(file);
  }
  async select(file: File): Promise<void> {
    const generation = ++this.generation;
    this.processing.set(true);
    this.error.set("");
    try {
      const photo = await preparePhoto(file);
      if (this.dead || generation !== this.generation) return;
      this.setPreview(photo);
      this.changed.emit(photo);
    } catch (e) {
      if (this.dead || generation !== this.generation) return;
      this.error.set(e instanceof Error ? e.message : "Foto inválida.");
      this.setPreview(null);
      this.resetInput();
      this.changed.emit(null);
    } finally {
      if (!this.dead && generation === this.generation)
        this.processing.set(false);
    }
  }
  remove(): void {
    this.generation++;
    this.processing.set(false);
    this.error.set("");
    this.setPreview(null);
    this.resetInput();
    this.changed.emit(null);
  }
  private resetInput(): void {
    const element = this.file()?.nativeElement;
    if (element) element.value = "";
  }
  private setPreview(photo: Blob | null): void {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.preview.set(photo ? URL.createObjectURL(photo) : null);
  }
}
