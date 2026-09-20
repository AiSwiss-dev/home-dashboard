(function () {
  "use strict";

  const LATITUDE = 47.566664;
  const LONGITUDE = 9.166658;
  const MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

  let modal;
  let map;
  let radarLayer;
  let previewMap;
  let previewLayer;
  let frames = [];
  let frameIndex = 0;
  let animationTimer;
  let loaded = false;
  let playing = true;

  function formatTime(unixTime) {
    return new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date(unixTime * 1000));
  }

  function radarImageUrl(frame) {
    return `${frame.host}${frame.path}/512/7/${LATITUDE}/${LONGITUDE}/2/1_1.png`;
  }

  function radarBounds(targetMap) {
    const zoom = 7;
    const half = 256;
    const center = targetMap.project(window.L.latLng(LATITUDE, LONGITUDE), zoom);
    const southWest = targetMap.unproject([center.x - half, center.y + half], zoom);
    const northEast = targetMap.unproject([center.x + half, center.y - half], zoom);
    return window.L.latLngBounds(southWest, northEast);
  }

  function setRadarImage(targetMap, currentLayer, frame) {
    if (currentLayer) targetMap.removeLayer(currentLayer);
    return window.L.imageOverlay(radarImageUrl(frame), radarBounds(targetMap), {
      opacity: 0.72,
      zIndex: 4
    }).addTo(targetMap);
  }

  async function fetchFrames() {
    const response = await fetch(MAPS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Radar-API nicht erreichbar");
    const data = await response.json();
    const allFrames = data.radar?.past || [];
    const latestTime = allFrames.length ? allFrames[allFrames.length - 1].time : 0;
    frames = allFrames
      .filter((frame) => frame.time >= latestTime - 60 * 60)
      .map((frame) => ({ ...frame, host: data.host }));
    if (!frames.length) throw new Error("Keine Radarbilder verfügbar");
  }

  function setFrame(index) {
    if (!frames.length || !map) return;
    frameIndex = (index + frames.length) % frames.length;
    const frame = frames[frameIndex];
    radarLayer = setRadarImage(map, radarLayer, frame);
    document.getElementById("radar-time").textContent = formatTime(frame.time);
  }

  function startAnimation() {
    window.clearInterval(animationTimer);
    playing = true;
    document.getElementById("radar-play").textContent = "Ⅱ";
    document.getElementById("radar-play").setAttribute("aria-label", "Radar-Animation pausieren");
    animationTimer = window.setInterval(() => setFrame(frameIndex + 1), 850);
  }

  function stopAnimation() {
    window.clearInterval(animationTimer);
    playing = false;
    document.getElementById("radar-play").textContent = "▶";
    document.getElementById("radar-play").setAttribute("aria-label", "Radar-Animation starten");
  }

  async function loadRadar() {
    if (!window.L) throw new Error("Kartenmodul konnte nicht geladen werden");
    if (!map) {
      map = window.L.map("radar-map", { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([LATITUDE, LONGITUDE], 7);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        zIndex: 1
      }).addTo(map);
      window.L.circleMarker([LATITUDE, LONGITUDE], {
        radius: 5, color: "#ffffff", weight: 2, fillColor: "#2474d1", fillOpacity: 1
      }).addTo(map).bindTooltip("Berg TG", { permanent: false, direction: "top" });
    }
    map.invalidateSize();

    if (!frames.length) await fetchFrames();
    frameIndex = frames.length - 1;
    setFrame(frameIndex);
    document.getElementById("radar-loading").hidden = true;
    startAnimation();
  }

  async function loadPreview() {
    if (!window.L) throw new Error("Kartenmodul konnte nicht geladen werden");
    previewMap = window.L.map("radar-inline-map", {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      scrollWheelZoom: false
    }).setView([LATITUDE, LONGITUDE], 7);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, zIndex: 1 }).addTo(previewMap);
    await fetchFrames();
    const latest = frames[frames.length - 1];
    previewLayer = setRadarImage(previewMap, previewLayer, latest);
    document.getElementById("radar-inline-time").textContent = `${formatTime(latest.time)} Uhr`;
  }

  async function loadForecast() {
    const params = new URLSearchParams({
      latitude: LATITUDE,
      longitude: LONGITUDE,
      minutely_15: "precipitation",
      forecast_minutely_15: "5",
      timezone: "auto"
    });
    const response = await fetch(`${FORECAST_URL}?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Niederschlagsprognose nicht erreichbar");
    const data = await response.json();
    const points = data.minutely_15.time.slice(1, 5).map((time, index) => ({
      time: time.slice(11, 16),
      amount: Number(data.minutely_15.precipitation[index + 1] || 0)
    }));
    const total = points.reduce((sum, point) => sum + point.amount, 0);
    document.getElementById("rain-summary").textContent = total < 0.05 ? "Voraussichtlich trocken" : `${total.toFixed(1)} mm erwartet`;
    document.getElementById("rain-forecast-grid").innerHTML = points.map((point) => `
      <div class="rain-point${point.amount >= 0.1 ? " has-rain" : ""}">
        <span>${point.time}</span>
        <i aria-hidden="true"></i>
        <strong>${point.amount.toFixed(1)} mm</strong>
      </div>`).join("");
  }

  async function openRadar() {
    modal.hidden = false;
    document.getElementById("radar-loading").hidden = false;
    document.getElementById("radar-loading").textContent = "Radar wird geladen …";
    if (!loaded) {
      const results = await Promise.allSettled([loadRadar(), loadForecast()]);
      loaded = results.some((result) => result.status === "fulfilled");
      if (results[0].status === "rejected") {
        document.getElementById("radar-loading").hidden = false;
        document.getElementById("radar-loading").textContent = "Radar ist gerade nicht verfügbar.";
      }
      if (results[1].status === "rejected") {
        document.getElementById("rain-summary").textContent = "Prognose gerade nicht verfügbar";
      }
    } else {
      document.getElementById("radar-loading").hidden = true;
      map?.invalidateSize();
      startAnimation();
      loadForecast().catch(() => {});
    }
  }

  function closeRadar() {
    stopAnimation();
    modal.hidden = true;
    document.getElementById("radar-open").focus();
  }

  window.HomeRadar = {
    init() {
      modal = document.getElementById("radar-modal");
      document.getElementById("radar-open").addEventListener("click", openRadar);
      document.getElementById("radar-inline").addEventListener("click", openRadar);
      document.getElementById("radar-inline").addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRadar();
        }
      });
      document.getElementById("radar-close").addEventListener("click", closeRadar);
      document.getElementById("radar-previous").addEventListener("click", () => { stopAnimation(); setFrame(frameIndex - 1); });
      document.getElementById("radar-next").addEventListener("click", () => { stopAnimation(); setFrame(frameIndex + 1); });
      document.getElementById("radar-play").addEventListener("click", () => { if (playing) stopAnimation(); else startAnimation(); });
      modal.addEventListener("click", (event) => { if (event.target === modal) closeRadar(); });
      document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) closeRadar(); });
      loadPreview().catch(() => {
        document.getElementById("radar-inline-time").textContent = "Gerade nicht verfügbar";
      });
    }
  };
})();
