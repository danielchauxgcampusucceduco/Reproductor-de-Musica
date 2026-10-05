import { createElement } from './dom';

export interface Field {
  wrapper: HTMLLabelElement;
  input: HTMLInputElement;
  error: HTMLSpanElement;
}

/** Crea un campo etiquetado con espacio para errores accesibles. */
export function makeField(labelText: string, ariaLabel: string, placeholder: string, id: string): Field {
  const wrapper = createElement('label', 'field');
  const label = createElement('span');
  label.textContent = labelText;
  const input = createElement('input');
  input.id = id;
  input.setAttribute('aria-label', ariaLabel);
  input.placeholder = placeholder;
  input.required = true;
  const error = createElement('small', 'field-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', error.id);
  wrapper.append(label, input, error);
  return { wrapper, input, error };
}

/** Añade una opción de texto seguro a un selector. */
export function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

/** Convierte una duración mm:ss en segundos o devuelve null si no es válida. */
export function parseDuration(value: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

/** Genera un identificador compatible con navegadores sin randomUUID. */
export function createSongId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `song-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/** Limpia los mensajes de validación y sus atributos de error. */
export function clearErrors(fields: Field[]): void {
  for (const field of fields) {
    field.error.textContent = '';
    field.input.removeAttribute('aria-invalid');
  }
}

/** Muestra un mensaje asociado al campo y lleva el foco a su entrada. */
export function showError(field: Field, message: string): void {
  field.error.textContent = message;
  field.input.setAttribute('aria-invalid', 'true');
  field.input.focus();
}
