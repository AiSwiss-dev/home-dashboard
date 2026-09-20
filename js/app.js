(function () {
  "use strict";

  const timeFormatter = new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const dateFormatter = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  function updateClock() {
    const now = new Date();
    document.getElementById("clock-time").textContent = timeFormatter.format(now);
    const rawDate = dateFormatter.format(now);
    document.getElementById("clock-date").textContent = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  }

  function init() {
    updateClock();
    window.setInterval(updateClock, 1000);
    window.HomeWeather.render();
    window.HomeShopping.init();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
