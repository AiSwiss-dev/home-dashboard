(function () {
  "use strict";

  const CLIENT_KEY = "home-dashboard.spotify.client-id.v1";
  const TOKEN_KEY = "home-dashboard.spotify.token.v1";
  const VERIFIER_KEY = "home-dashboard.spotify.verifier.v1";
  const STATE_KEY = "home-dashboard.spotify.state.v1";
  const SCOPES = "user-read-playback-state user-read-currently-playing user-modify-playback-state";
  const API = "https://api.spotify.com/v1";

  let token = null;
  let playback = null;
  let pollTimer = null;
  let els = {};

  function redirectUri() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function randomString(length = 64) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (byte) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[byte % 66]).join("");
  }

  async function codeChallenge(verifier) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function saveToken(value) {
    token = value ? { ...value, expiresAt: Date.now() + (value.expires_in || 3600) * 1000 } : null;
    if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    else localStorage.removeItem(TOKEN_KEY);
  }

  function loadToken() {
    try { token = JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch (_) { token = null; }
  }

  async function exchangeToken(parameters) {
    const clientId = localStorage.getItem(CLIENT_KEY);
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, ...parameters })
    });
    if (!response.ok) throw new Error("Spotify-Anmeldung fehlgeschlagen");
    return response.json();
  }

  async function refreshToken() {
    if (!token?.refresh_token) throw new Error("Keine gültige Spotify-Anmeldung");
    const refreshed = await exchangeToken({ grant_type: "refresh_token", refresh_token: token.refresh_token });
    saveToken({ ...token, ...refreshed, refresh_token: refreshed.refresh_token || token.refresh_token });
  }

  async function api(path, options = {}, retry = true) {
    if (!token) throw new Error("Spotify ist nicht verbunden");
    if (Date.now() >= token.expiresAt - 60000) await refreshToken();
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token.access_token}`, ...(options.headers || {}) }
    });
    if (response.status === 401 && retry) {
      await refreshToken();
      return api(path, options, false);
    }
    if (response.status === 204) return null;
    if (!response.ok) {
      const error = new Error(`Spotify antwortet mit ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const type = response.headers.get("content-type") || "";
    return type.includes("application/json") ? response.json() : null;
  }

  function setControls(enabled) {
    [els.previous, els.play, els.next].forEach((button) => { button.disabled = !enabled; });
  }

  function renderPlayback(data) {
    playback = data;
    if (!data?.item) {
      els.track.textContent = "Keine aktive Wiedergabe";
      els.artist.textContent = "Öffne Spotify und starte einen Titel.";
      els.cover.style.backgroundImage = "";
      els.cover.classList.remove("has-image");
      els.play.textContent = "▶";
      els.play.setAttribute("aria-label", "Wiedergabe fortsetzen");
      setControls(Boolean(token));
      return;
    }
    els.track.textContent = data.item.name || "Unbekannter Titel";
    els.artist.textContent = (data.item.artists || []).map((artist) => artist.name).join(", ");
    const image = data.item.album?.images?.[1]?.url || data.item.album?.images?.[0]?.url;
    els.cover.style.backgroundImage = image ? `url("${image}")` : "";
    els.cover.classList.toggle("has-image", Boolean(image));
    els.play.textContent = data.is_playing ? "Ⅱ" : "▶";
    els.play.setAttribute("aria-label", data.is_playing ? "Wiedergabe pausieren" : "Wiedergabe fortsetzen");
    setControls(true);
  }

  function showStatus(message, error = false) {
    els.status.textContent = message;
    els.status.classList.toggle("is-error", error);
  }

  async function loadPlayback() {
    if (!token) return;
    try {
      const data = await api("/me/player");
      renderPlayback(data);
      showStatus(data?.device ? `Aktiv auf ${data.device.name}` : "Verbunden · Spotify-App öffnen");
    } catch (error) {
      if (error.status === 403) showStatus("Für die Fernsteuerung wird Spotify Premium benötigt.", true);
      else {
        showStatus("Spotify-Verbindung abgelaufen. Bitte neu verbinden.", true);
        setControls(false);
      }
    }
  }

  async function control(action) {
    try {
      if (action === "play") await api(`/me/player/${playback?.is_playing ? "pause" : "play"}`, { method: "PUT" });
      else await api(`/me/player/${action}`, { method: "POST" });
      window.setTimeout(loadPlayback, 350);
    } catch (error) {
      showStatus(error.status === 404 ? "Zuerst in der Spotify-App Musik starten." : "Steuerung gerade nicht möglich.", true);
    }
  }

  function openSetup() {
    els.clientId.value = localStorage.getItem(CLIENT_KEY) || "";
    els.redirect.value = redirectUri();
    els.modal.hidden = false;
    window.setTimeout(() => els.clientId.focus(), 0);
  }

  function closeSetup() {
    els.modal.hidden = true;
    els.settings.focus();
  }

  async function connect() {
    const clientId = localStorage.getItem(CLIENT_KEY);
    if (!clientId) return openSetup();
    const verifier = randomString(80);
    const state = randomString(28);
    localStorage.setItem(VERIFIER_KEY, verifier);
    localStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri(),
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: await codeChallenge(verifier),
      state
    });
    window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
  }

  async function handleCallback() {
    const query = new URLSearchParams(window.location.search);
    const code = query.get("code");
    const error = query.get("error");
    if (!code && !error) return;
    history.replaceState({}, document.title, redirectUri());
    if (error) return showStatus("Spotify-Anmeldung wurde abgebrochen.", true);
    if (query.get("state") !== localStorage.getItem(STATE_KEY)) return showStatus("Spotify-Anmeldung konnte nicht geprüft werden.", true);
    const verifier = localStorage.getItem(VERIFIER_KEY);
    try {
      const result = await exchangeToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });
      saveToken(result);
      localStorage.removeItem(VERIFIER_KEY);
      localStorage.removeItem(STATE_KEY);
      showStatus("Spotify ist verbunden.");
    } catch (callbackError) {
      showStatus(callbackError.message, true);
    }
  }

  window.HomeSpotify = {
    async init() {
      els = {
        track: document.getElementById("spotify-track-name"), artist: document.getElementById("spotify-artist"),
        cover: document.getElementById("spotify-cover"), status: document.getElementById("spotify-status"),
        previous: document.getElementById("spotify-previous"), play: document.getElementById("spotify-play"), next: document.getElementById("spotify-next"),
        connect: document.getElementById("spotify-connect"), settings: document.getElementById("spotify-settings"),
        modal: document.getElementById("spotify-setup-modal"), clientId: document.getElementById("spotify-client-id"), redirect: document.getElementById("spotify-redirect-uri")
      };
      loadToken();
      await handleCallback();
      els.connect.addEventListener("click", token ? loadPlayback : connect);
      els.settings.addEventListener("click", openSetup);
      els.previous.addEventListener("click", () => control("previous"));
      els.play.addEventListener("click", () => control("play"));
      els.next.addEventListener("click", () => control("next"));
      document.getElementById("spotify-setup-close").addEventListener("click", closeSetup);
      document.getElementById("spotify-setup-cancel").addEventListener("click", closeSetup);
      document.getElementById("spotify-copy-redirect").addEventListener("click", async () => {
        await navigator.clipboard.writeText(redirectUri());
        document.getElementById("spotify-copy-redirect").textContent = "Kopiert";
      });
      document.getElementById("spotify-save-connect").addEventListener("click", () => {
        const value = els.clientId.value.trim();
        if (value.length < 16) {
          els.clientId.focus();
          showStatus("Bitte eine gültige Spotify Client-ID eintragen.", true);
          return;
        }
        localStorage.setItem(CLIENT_KEY, value);
        els.modal.hidden = true;
        connect();
      });
      els.modal.addEventListener("click", (event) => { if (event.target === els.modal) closeSetup(); });
      if (token) {
        els.connect.textContent = "Aktualisieren";
        await loadPlayback();
        pollTimer = window.setInterval(loadPlayback, 15000);
      }
      document.addEventListener("visibilitychange", () => { if (!document.hidden && token) loadPlayback(); });
    }
  };
})();
