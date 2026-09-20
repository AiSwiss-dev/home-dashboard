(function () {
  "use strict";

  const STORAGE_KEY = "home-dashboard.google-calendar.embed.v1";
  let modal;
  let input;
  let frameWrap;

  function extractUrl(value) {
    const trimmed = value.trim().replace(/&amp;/g, "&");
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    const candidate = match ? match[1] : trimmed;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" || !url.hostname.endsWith("calendar.google.com")) return null;
      if (!url.pathname.includes("/calendar/embed") && url.searchParams.has("cid")) {
        const encodedId = url.searchParams.get("cid").replace(/-/g, "+").replace(/_/g, "/");
        const calendarId = atob(encodedId);
        const embedUrl = new URL("https://calendar.google.com/calendar/embed");
        embedUrl.searchParams.set("src", calendarId);
        return embedUrl.toString();
      }
      if (!url.pathname.includes("/calendar/embed")) return null;
      return url.toString();
    } catch (_) {
      return null;
    }
  }

  function render(url) {
    if (!url) return;
    const calendarUrl = new URL(url);
    calendarUrl.searchParams.set("hl", "de");
    calendarUrl.searchParams.set("ctz", "Europe/Zurich");
    calendarUrl.searchParams.set("showTitle", "0");
    calendarUrl.searchParams.set("showPrint", "0");
    calendarUrl.searchParams.set("showCalendars", "0");
    calendarUrl.searchParams.set("wkst", "2");
    frameWrap.innerHTML = `<iframe class="calendar-frame" title="Google Kalender Termine" src="${calendarUrl.toString().replace(/"/g, "%22")}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  }

  function openSetup() {
    input.value = localStorage.getItem(STORAGE_KEY) || "";
    modal.hidden = false;
    window.setTimeout(() => input.focus(), 0);
  }

  function closeSetup() {
    modal.hidden = true;
    document.getElementById("calendar-settings").focus();
  }

  window.HomeCalendar = {
    init() {
      modal = document.getElementById("calendar-setup-modal");
      input = document.getElementById("calendar-embed-url");
      frameWrap = document.getElementById("calendar-frame-wrap");
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const normalized = extractUrl(saved);
        if (normalized) {
          localStorage.setItem(STORAGE_KEY, normalized);
          render(normalized);
        }
      }

      document.getElementById("calendar-settings").addEventListener("click", openSetup);
      document.getElementById("calendar-connect")?.addEventListener("click", openSetup);
      document.getElementById("calendar-setup-close").addEventListener("click", closeSetup);
      document.getElementById("calendar-setup-cancel").addEventListener("click", closeSetup);
      document.getElementById("calendar-save").addEventListener("click", () => {
        const url = extractUrl(input.value);
        if (!url) {
          input.setCustomValidity("Bitte einen gültigen Google-Kalender-Einbettungslink eintragen.");
          input.reportValidity();
          return;
        }
        input.setCustomValidity("");
        localStorage.setItem(STORAGE_KEY, url);
        render(url);
        closeSetup();
      });
      input.addEventListener("input", () => input.setCustomValidity(""));
      modal.addEventListener("click", (event) => { if (event.target === modal) closeSetup(); });
    }
  };
})();
