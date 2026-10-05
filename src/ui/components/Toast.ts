import { createButton, createElement } from './dom';

/** Anuncia un mensaje breve y opcionalmente ofrece deshacer una acción. */
export function showToast(message: string, action?: () => void): void {
  const region = document.querySelector<HTMLElement>('#toast-region');
  if (!region) return;
  const toast = createElement('div', 'toast');
  toast.setAttribute('role', 'status');
  const text = createElement('span');
  text.textContent = message;
  toast.append(text);
  if (action) {
    const undo = createButton('Deshacer eliminación', 'Deshacer', 'undo-button');
    undo.addEventListener('click', () => { action(); toast.remove(); });
    toast.append(undo);
  }
  region.replaceChildren(toast);
  window.setTimeout(() => toast.remove(), 5000);
}
