import type { Song } from './Song';

const clientIdKey = 'taller-player-spotify-client-id';
const accessTokenKey = 'taller-player-spotify-access-token';
const refreshTokenKey = 'taller-player-spotify-refresh-token';
const expiryKey = 'taller-player-spotify-expires-at';
const verifierKey = 'taller-player-spotify-code-verifier';
const stateKey = 'taller-player-spotify-oauth-state';
const spotifyTrackPattern = /^spotify:track:[A-Za-z0-9]+$/;

export interface SpotifyClientState {
  clientId: string;
  authenticated: boolean;
  message: string;
}

const clientIdPattern = /^[A-Za-z0-9]{20,64}$/;

interface SpotifyTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  error_description?: unknown;
}

/** Cliente de Spotify Web API con PKCE, pensado para una SPA sin Client Secret. */
export class SpotifyClient {
  private clientIdValue: string;
  private accessToken = '';
  private refreshToken = '';
  private expiresAt = 0;
  private authenticated = false;
  private message = 'Configura tu Client ID de Spotify para conectar tu cuenta Premium.';
  private readonly listeners = new Set<(state: SpotifyClientState) => void>();

  public constructor(defaultClientId = '') {
    const storedClientId = readStorage(localStorage, clientIdKey) ?? '';
    this.clientIdValue = isValidClientId(defaultClientId) ? defaultClientId : storedClientId;
  }

  public get clientId(): string { return this.clientIdValue; }
  public get isAuthenticated(): boolean { return this.authenticated; }

  public subscribe(listener: (state: SpotifyClientState) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  /** Guarda el Client ID público que Spotify asigna a la aplicación. */
  public configure(clientId: string): void {
    const normalized = clientId.trim();
    if (!isValidClientId(normalized)) {
      throw new Error('El Client ID de Spotify no tiene un formato válido.');
    }
    this.clientIdValue = normalized;
    try { localStorage.setItem(clientIdKey, normalized); } catch { /* Se puede conectar durante esta sesión. */ }
    this.setMessage('Client ID guardado. Conecta Spotify para autorizar la reproducción.');
  }

  /** Completa el retorno OAuth o recupera la sesión de esta pestaña. */
  public async initialize(): Promise<void> {
    const url = new URL(window.location.href);
    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    if (error) {
      this.clearOAuthParameters(url);
      this.setMessage('No se autorizó Spotify. Puedes volver a intentarlo.');
      return;
    }

    if (code) {
      this.setMessage('Terminando de conectar con Spotify…');
      try {
        await this.exchangeAuthorizationCode(code, url.searchParams.get('state'));
        this.clearOAuthParameters(url);
        this.authenticated = true;
        this.setMessage('Spotify está conectado. Ya puedes buscar y reproducir música.');
      } catch (error) {
        this.clearOAuthParameters(url);
        this.authenticated = false;
        this.setMessage(error instanceof Error ? error.message : 'No se pudo completar la conexión con Spotify.');
      }
      return;
    }

    this.accessToken = readStorage(sessionStorage, accessTokenKey) ?? '';
    this.refreshToken = readStorage(sessionStorage, refreshTokenKey) ?? '';
    this.expiresAt = Number(readStorage(sessionStorage, expiryKey) ?? 0);
    if (this.accessToken && this.expiresAt > Date.now() + 30_000) {
      this.authenticated = true;
      this.setMessage('Spotify está conectado. Ya puedes buscar y reproducir música.');
      return;
    }
    if (this.refreshToken) {
      try {
        await this.getAccessToken();
        this.authenticated = true;
        this.setMessage('Spotify está conectado. Ya puedes buscar y reproducir música.');
        return;
      } catch (error) {
        this.authenticated = false;
        this.setMessage(error instanceof Error ? error.message : 'Vuelve a conectar tu cuenta de Spotify.');
        return;
      }
    }
    this.authenticated = false;
    this.setMessage(this.clientIdValue
      ? 'Client ID listo. Conecta Spotify para buscar música.'
      : 'Configura tu Client ID de Spotify para conectar tu cuenta Premium.');
  }

  /** Redirige a Spotify usando PKCE; el navegador nunca recibe un Client Secret. */
  public async authorize(): Promise<void> {
    if (!this.clientIdValue) throw new Error('Escribe primero tu Client ID de Spotify.');
    const verifier = randomBase64Url(64);
    const state = randomBase64Url(24);
    const challenge = await createCodeChallenge(verifier);
    sessionStorage.setItem(verifierKey, verifier);
    sessionStorage.setItem(stateKey, state);
    const params = new URLSearchParams({
      client_id: this.clientIdValue,
      response_type: 'code',
      redirect_uri: getRedirectUri(),
      scope: 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state',
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state
    });
    this.setMessage('Abriendo Spotify para que autorices el reproductor…');
    window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
  }

  /** Obtiene o renueva un access token de corta duración. */
  public async getAccessToken(): Promise<string> {
    if (this.accessToken && this.expiresAt > Date.now() + 30_000) return this.accessToken;
    if (!this.refreshToken) throw new Error('Conecta de nuevo tu cuenta de Spotify.');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientIdValue,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })
    });
    const payload = await readTokenResponse(response);
    this.storeTokens(payload);
    return this.accessToken;
  }

  /** Busca canciones y devuelve metadatos y carátulas oficiales de Spotify. */
  public async searchTracks(query: string): Promise<Song[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    const params = new URLSearchParams({ q: normalized, type: 'track', limit: '12', market: 'from_token' });
    const payload = await this.fetchAuthorized(`https://api.spotify.com/v1/search?${params.toString()}`);
    const tracks = asRecord(asRecord(payload)?.tracks)?.items;
    if (!Array.isArray(tracks)) return [];
    return tracks.flatMap((raw): Song[] => {
      const track = asRecord(raw);
      const album = asRecord(track?.album);
      const uri = track?.uri;
      const durationMs = track?.duration_ms;
      const id = track?.id;
      const title = track?.name;
      const artists = Array.isArray(track?.artists)
        ? track.artists.flatMap((artist) => typeof asRecord(artist)?.name === 'string' ? [asRecord(artist)?.name as string] : [])
        : [];
      if (typeof id !== 'string' || typeof title !== 'string' || typeof uri !== 'string'
        || !spotifyTrackPattern.test(uri) || typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return [];
      const images = Array.isArray(album?.images) ? album.images : [];
      const albumImageUrl = images
        .map((image) => asRecord(image)?.url)
        .find((value): value is string => typeof value === 'string' && /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/.test(value));
      return [{
        id: `spotify-${id}`,
        title,
        artist: artists.join(', ') || 'Artista desconocido',
        durationSec: Math.max(1, Math.round(durationMs / 1000)),
        favorite: false,
        spotifyUri: uri,
        spotifyTrackUrl: `https://open.spotify.com/track/${id}`,
        ...(albumImageUrl ? { albumImageUrl } : {})
      }];
    });
  }

  /** Inicia una canción en el dispositivo de navegador creado por Web Playback SDK. */
  public async startPlayback(uri: string, positionSec: number, deviceId: string): Promise<void> {
    if (!spotifyTrackPattern.test(uri)) throw new Error('Spotify devolvió un identificador de canción inválido.');
    const params = new URLSearchParams({ device_id: deviceId });
    await this.fetchAuthorized(`https://api.spotify.com/v1/me/player/play?${params.toString()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.floor(positionSec * 1000)) })
    });
  }

  public disconnect(): void {
    this.authenticated = false;
    this.accessToken = '';
    this.refreshToken = '';
    this.expiresAt = 0;
    for (const key of [accessTokenKey, refreshTokenKey, expiryKey]) {
      try { sessionStorage.removeItem(key); } catch { /* La sesión también puede cerrarse con la pestaña. */ }
    }
    this.setMessage('Spotify desconectado.');
  }

  private async exchangeAuthorizationCode(code: string, returnedState: string | null): Promise<void> {
    const expectedState = sessionStorage.getItem(stateKey);
    const verifier = sessionStorage.getItem(verifierKey);
    if (!expectedState || !returnedState || expectedState !== returnedState || !verifier) {
      throw new Error('La verificación segura de Spotify falló. Intenta conectarte de nuevo.');
    }
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientIdValue,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: verifier
      })
    });
    const payload = await readTokenResponse(response);
    this.storeTokens(payload);
    sessionStorage.removeItem(stateKey);
    sessionStorage.removeItem(verifierKey);
  }

  private async fetchAuthorized(url: string, init: RequestInit = {}): Promise<unknown> {
    const send = async (token: string): Promise<Response> => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...init, headers });
    };
    let response = await send(await this.getAccessToken());
    if (response.status === 401 && this.refreshToken) {
      this.accessToken = '';
      this.expiresAt = 0;
      response = await send(await this.getAccessToken());
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(retryAfter ? `Spotify limitó las búsquedas. Prueba de nuevo en ${retryAfter} segundos.` : 'Spotify limitó las búsquedas. Inténtalo más tarde.');
    }
    if (!response.ok) throw new Error(`Spotify rechazó la solicitud (HTTP ${response.status}).`);
    if (response.status === 204) return undefined;
    return response.json() as Promise<unknown>;
  }

  private storeTokens(payload: SpotifyTokenResponse): void {
    if (typeof payload.access_token !== 'string' || typeof payload.expires_in !== 'number') {
      throw new Error(typeof payload.error_description === 'string' ? payload.error_description : 'Spotify devolvió una respuesta de autenticación inválida.');
    }
    this.accessToken = payload.access_token;
    this.expiresAt = Date.now() + payload.expires_in * 1000;
    if (typeof payload.refresh_token === 'string') this.refreshToken = payload.refresh_token;
    sessionStorage.setItem(accessTokenKey, this.accessToken);
    sessionStorage.setItem(expiryKey, String(this.expiresAt));
    if (this.refreshToken) sessionStorage.setItem(refreshTokenKey, this.refreshToken);
    this.authenticated = true;
  }

  private clearOAuthParameters(url: URL): void {
    url.search = '';
    window.history.replaceState({}, document.title, `${url.pathname}${url.hash}`);
    try {
      sessionStorage.removeItem(stateKey);
      sessionStorage.removeItem(verifierKey);
    } catch { /* Los parámetros ya se retiraron de la dirección. */ }
  }

  private setMessage(message: string): void {
    this.message = message;
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }

  private snapshot(): SpotifyClientState {
    return { clientId: this.clientIdValue, authenticated: this.authenticated, message: this.message };
  }
}

async function readTokenResponse(response: Response): Promise<SpotifyTokenResponse> {
  const payload: unknown = await response.json();
  const token = asRecord(payload) as SpotifyTokenResponse | null;
  if (!response.ok || !token) {
    const message = typeof token?.error_description === 'string' ? token.error_description : `Spotify rechazó la autorización (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return token;
}

function getRedirectUri(): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

function randomBase64Url(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return toBase64Url(bytes);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function readStorage(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function isValidClientId(value: string): boolean {
  return clientIdPattern.test(value.trim());
}
