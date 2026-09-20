(function () {
  "use strict";

  const timeFormatter = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateFormatter = new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  let pageTrack;

  function updateClockAndTheme() {
    const now = new Date();
    const time = timeFormatter.format(now);
    const rawDate = dateFormatter.format(now);
    const isNight = now.getHours() >= 20 || now.getHours() < 7;
    document.getElementById("clock-time").textContent = time;
    document.getElementById("page-two-time").textContent = time;
    document.getElementById("clock-date").textContent = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
    document.body.dataset.theme = isNight ? "night" : "day";
    document.getElementById("night-status").textContent = isNight ? "Nachtmodus" : "Tagmodus";
    document.getElementById("theme-color").setAttribute("content", isNight ? "#0b1421" : "#edf3f8");
  }

  function updatePageNavigation(index) {
    document.querySelectorAll(".page-nav-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
      if (dotIndex === index) dot.setAttribute("aria-current", "page");
      else dot.removeAttribute("aria-current");
    });
  }

  function setPage(index, smooth = true) {
    const page = Math.max(0, Math.min(1, index));
    pageTrack.scrollTo({ left: page * pageTrack.clientWidth, behavior: smooth ? "smooth" : "auto" });
    updatePageNavigation(page);
  }

  function initPages() {
    pageTrack = document.getElementById("page-track");
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-go-page]");
      if (button) setPage(Number(button.dataset.goPage));
    });
    pageTrack.addEventListener("scroll", () => {
      if (pageTrack.clientWidth) updatePageNavigation(Math.round(pageTrack.scrollLeft / pageTrack.clientWidth));
    }, { passive: true });
    window.addEventListener("resize", () => {
      const index = Math.round(pageTrack.scrollLeft / Math.max(1, pageTrack.clientWidth));
      setPage(index, false);
    });
  }

  async function init() {
    updateClockAndTheme();
    window.setInterval(updateClockAndTheme, 30000);
    initPages();
    window.HomeWeather.render();
    window.HomeShopping.init();
    window.HomeCalendar.init();
    window.HomeRadar.init();
    await window.HomeSpotify.init();
  }

  window.HomeApp = { setPage };
  document.addEventListener("DOMContentLoaded", init);
})();
