(function () {
  "use strict";

  const API_URL = "https://api.open-meteo.com/v1/forecast";
  const REFRESH_INTERVAL = 15 * 60 * 1000;
  const locations = [
    { city: "Berg TG", country: "Schweiz", latitude: 47.566664, longitude: 9.166658, primary: true },
    { city: "Rastatt", country: "Deutschland", latitude: 48.8572, longitude: 8.203, target: "weather-rastatt", id: "city-rastatt" },
    { city: "Monchique", country: "Portugal", latitude: 37.318, longitude: -8.5559, target: "weather-monchique", id: "city-monchique" }
  ];

  const fallbackData = {
    primary: {
      city: "Berg TG", temp: 18, condition: "Leicht bewölkt",
      detail: "Gefühlt 17° · Wind 8 km/h", icon: "partly-cloudy",
      forecast: [
        { day: "Heute", high: 18, low: 10, icon: "partly-cloudy" },
        { day: "Mo", high: 19, low: 11, icon: "sunny" },
        { day: "Di", high: 16, low: 9, icon: "rainy" },
        { day: "Mi", high: 17, low: 10, icon: "cloudy" },
        { day: "Do", high: 20, low: 11, icon: "sunny" }
      ],
      hourly: [
        { time: "Jetzt", temp: 18, icon: "partly-cloudy" },
        { time: "21:00", temp: 16, icon: "partly-cloudy" },
        { time: "23:00", temp: 14, icon: "cloudy" },
        { time: "01:00", temp: 13, icon: "cloudy" },
        { time: "03:00", temp: 12, icon: "cloudy" },
        { time: "05:00", temp: 11, icon: "partly-cloudy" }
      ]
    },
    secondary: [
      { target: "weather-rastatt", id: "city-rastatt", city: "Rastatt", country: "Deutschland", temp: 21, condition: "Wolkig", icon: "cloudy" },
      { target: "weather-monchique", id: "city-monchique", city: "Monchique", country: "Portugal", temp: 27, condition: "Sonnig", icon: "sunny" }
    ]
  };

  function weatherInfo(code, isDay = 1) {
    if (code === 0) return { condition: isDay ? "Sonnig" : "Klar", icon: "sunny" };
    if (code === 1) return { condition: "Überwiegend klar", icon: "partly-cloudy" };
    if (code === 2) return { condition: "Leicht bewölkt", icon: "partly-cloudy" };
    if (code === 3) return { condition: "Bedeckt", icon: "cloudy" };
    if ([45, 48].includes(code)) return { condition: "Neblig", icon: "cloudy" };
    if ([51, 53, 55, 56, 57].includes(code)) return { condition: "Nieselregen", icon: "rainy" };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { condition: "Regen", icon: "rainy" };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: "Schneefall", icon: "snowy" };
    if ([95, 96, 99].includes(code)) return { condition: "Gewitter", icon: "stormy" };
    return { condition: "Wechselhaft", icon: "partly-cloudy" };
  }

  function iconSvg(type) {
    const sun = '<circle cx="31" cy="29" r="13" fill="#FFD067"/><g stroke="#FFD067" stroke-width="4" stroke-linecap="round"><path d="M31 5v6M31 47v6M7 29h6M49 29h6M14 12l4 4M44 42l4 4M48 12l-4 4M18 42l-4 4"/></g>';
    const cloud = '<path d="M18 51h31c9 0 15-5 15-13 0-7-5-12-12-13C49 16 42 11 33 11c-11 0-19 8-20 18C5 30 0 35 0 42c0 6 6 9 18 9Z" fill="#F7FAFD"/>';
    if (type === "sunny") return `<svg viewBox="0 0 64 64" role="img" aria-label="Sonnig">${sun}</svg>`;
    if (type === "rainy") return `<svg viewBox="0 0 64 72" role="img" aria-label="Regen">${cloud}<g stroke="#6EB9F4" stroke-width="4" stroke-linecap="round"><path d="M19 59l-3 6M34 59l-3 6M49 59l-3 6"/></g></svg>`;
    if (type === "snowy") return `<svg viewBox="0 0 64 72" role="img" aria-label="Schnee">${cloud}<g fill="#9ED5F7"><circle cx="17" cy="63" r="3"/><circle cx="32" cy="59" r="3"/><circle cx="48" cy="64" r="3"/></g></svg>`;
    if (type === "stormy") return `<svg viewBox="0 0 64 76" role="img" aria-label="Gewitter">${cloud}<path d="M35 53h10L37 64h7L29 75l4-14h-8Z" fill="#FFD067"/></svg>`;
    if (type === "cloudy") return '<svg viewBox="0 0 64 64" role="img" aria-label="Wolkig"><path d="M17 54h32c9 0 15-5 15-13s-6-13-14-13C47 18 40 13 31 13c-11 0-19 8-20 19C4 33 0 38 0 44c0 7 6 10 17 10Z" fill="#DCE8F1"/><path d="M25 54h24c9 0 15-5 15-13s-6-13-14-13c-2 0-4 0-6 1-3-5-8-8-14-8-9 0-16 7-16 16-6 1-10 5-10 10 0 5 5 7 21 7Z" fill="#F8FBFD"/></svg>';
    return `<svg viewBox="0 0 72 72" role="img" aria-label="Leicht bewölkt"><g transform="translate(2 0)">${sun}</g><g transform="translate(5 16) scale(.95)">${cloud}</g></svg>`;
  }

  function renderPrimary(data) {
    document.getElementById("primary-city").textContent = data.city;
    document.getElementById("primary-temp").textContent = data.temp;
    document.getElementById("primary-condition").textContent = data.condition;
    document.getElementById("primary-detail").textContent = data.detail;
    document.getElementById("primary-icon").innerHTML = iconSvg(data.icon);
    document.getElementById("forecast").innerHTML = data.forecast.map((day) => `
      <div class="forecast-day">
        <p class="forecast-day-name">${day.day}</p>
        <div class="forecast-icon weather-icon" aria-hidden="true">${iconSvg(day.icon)}</div>
        <p class="forecast-temps"><span>${day.high}°</span><span class="forecast-low">${day.low}°</span></p>
      </div>`).join("");
    document.getElementById("hourly-forecast").innerHTML = data.hourly.map((hour) => `
      <div class="hourly-item">
        <p>${hour.time}</p>
        <div class="hourly-icon weather-icon" aria-hidden="true">${iconSvg(hour.icon)}</div>
        <strong>${hour.temp}°</strong>
      </div>`).join("");
  }

  function renderSecondary(data) {
    document.getElementById(data.target).innerHTML = `
      <div>
        <p class="compact-meta">${data.country}</p>
        <h2 class="compact-city" id="${data.id}">${data.city}</h2>
        <p class="compact-condition">${data.condition}</p>
      </div>
      <div class="compact-visual">
        <div class="compact-icon weather-icon" aria-hidden="true">${iconSvg(data.icon)}</div>
        <p class="compact-temp">${data.temp}°</p>
      </div>`;
  }

  function setStatus(mode, text, title) {
    const status = document.getElementById("weather-status");
    status.dataset.status = mode;
    status.title = title;
    document.getElementById("weather-status-text").textContent = text;
  }

  function buildApiUrl(location) {
    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "5"
    });
    if (location.primary) params.set("hourly", "temperature_2m,weather_code,is_day");
    return `${API_URL}?${params.toString()}`;
  }

  async function fetchLocation(location) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(buildApiUrl(location), { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Wetter-API: HTTP ${response.status}`);
      const data = await response.json();
      if (!data.current || !data.daily) throw new Error("Wetter-API: unvollständige Antwort");
      return { location, data };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function dayLabel(dateValue, index) {
    if (index === 0) return "Heute";
    return new Intl.DateTimeFormat("de-CH", { weekday: "short" })
      .format(new Date(`${dateValue}T12:00:00`)).replace(".", "");
  }

  function toPrimary(location, data) {
    const current = weatherInfo(data.current.weather_code, data.current.is_day);
    const startIndex = Math.max(0, data.hourly.time.findIndex((time) => time >= data.current.time));
    const hourly = Array.from({ length: 6 }, (_, step) => startIndex + step * 2)
      .filter((index) => index < data.hourly.time.length)
      .map((index, position) => ({
        time: position === 0 ? "Jetzt" : data.hourly.time[index].slice(11, 16),
        temp: Math.round(data.hourly.temperature_2m[index]),
        icon: weatherInfo(data.hourly.weather_code[index], data.hourly.is_day[index]).icon
      }));
    return {
      city: location.city,
      temp: Math.round(data.current.temperature_2m),
      condition: current.condition,
      detail: `Gefühlt ${Math.round(data.current.apparent_temperature)}° · Wind ${Math.round(data.current.wind_speed_10m)} km/h`,
      icon: current.icon,
      hourly,
      forecast: data.daily.time.map((date, index) => ({
        day: dayLabel(date, index),
        high: Math.round(data.daily.temperature_2m_max[index]),
        low: Math.round(data.daily.temperature_2m_min[index]),
        icon: weatherInfo(data.daily.weather_code[index]).icon
      }))
    };
  }

  function toSecondary(location, data) {
    const current = weatherInfo(data.current.weather_code, data.current.is_day);
    return { target: location.target, id: location.id, city: location.city, country: location.country,
      temp: Math.round(data.current.temperature_2m), condition: current.condition, icon: current.icon };
  }

  async function refresh() {
    setStatus("loading", "Wetter lädt", "Aktuelle Wetterdaten werden geladen");
    try {
      const results = await Promise.all(locations.map(fetchLocation));
      const primaryResult = results.find((result) => result.location.primary);
      renderPrimary(toPrimary(primaryResult.location, primaryResult.data));
      results.filter((result) => !result.location.primary)
        .forEach((result) => renderSecondary(toSecondary(result.location, result.data)));
      const updatedAt = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      document.getElementById("weather-updated").textContent = `Aktualisiert ${updatedAt}`;
      setStatus("live", "Live · Open-Meteo", `Aktuelle Wetterdaten · zuletzt ${updatedAt}`);
    } catch (error) {
      console.warn("Live-Wetter konnte nicht geladen werden; Beispieldaten bleiben aktiv.", error);
      document.getElementById("weather-updated").textContent = "Beispieldaten";
      setStatus("offline", "Offline · Beispieldaten", "Keine Verbindung zur Wetter-API");
    }
  }

  window.HomeWeather = {
    render() {
      renderPrimary(fallbackData.primary);
      fallbackData.secondary.forEach(renderSecondary);
      refresh();
      window.setInterval(refresh, REFRESH_INTERVAL);
    }
  };
})();
