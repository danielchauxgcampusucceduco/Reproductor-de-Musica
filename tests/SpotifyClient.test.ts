import { describe, expect, it } from 'vitest';
import { formatSpotifyErrorMessage } from '../src/domain/SpotifyClient';

describe('mensajes de error de Spotify', () => {
  const redirectUri = 'https://example.vercel.app/';

  it('explica que un código rechazado puede deberse a la URL de retorno y muestra la URI exacta', () => {
    const message = formatSpotifyErrorMessage(400, { error: 'invalid_grant' }, redirectUri, 'authorization');

    expect(message).toContain('Inicia sesión otra vez');
    expect(message).toContain(redirectUri);
  });

  it('identifica cuando Spotify no reconoce la aplicación', () => {
    const message = formatSpotifyErrorMessage(401, { error: 'invalid_client' }, redirectUri, 'authorization');

    expect(message).toContain('no reconoce la aplicación');
  });

  it('muestra el detalle del API en vez de ocultarlo tras un error genérico', () => {
    const message = formatSpotifyErrorMessage(400, {
      error: { status: 400, message: 'Invalid device ID' }
    }, redirectUri, 'api');

    expect(message).toContain('Invalid device ID');
    expect(message).toContain('HTTP 400');
  });
});
