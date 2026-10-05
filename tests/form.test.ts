import { describe, expect, it } from 'vitest';
import { parseDuration } from '../src/ui/components/form';

describe('validación de duración del formulario', () => {
  it('convierte minutos y segundos a segundos', () => {
    expect(parseDuration('03:42')).toBe(222);
    expect(parseDuration('120:00')).toBe(7200);
  });

  it('rechaza formatos incorrectos, segundos fuera de rango y duración cero', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('3:60')).toBeNull();
    expect(parseDuration('03:4')).toBeNull();
    expect(parseDuration('00:00')).toBeNull();
  });
});
