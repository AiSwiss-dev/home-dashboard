(function () {
  "use strict";

  const STORAGE_KEY = "home-dashboard.shopping.v1";
  const starterItems = [
    { id: "starter-milch", label: "Milch", done: false },
    { id: "starter-brot", label: "Brot", done: false },
    { id: "starter-kaffee", label: "Kaffee", done: true }
  ];

  let items = [];
  let listElement;
  let countElement;
  let emptyElement;
  let clearButton;
  let noteButton;
  let pdfButton;
  let toastElement;
  let toastTextElement;
  let undoButton;
  let purchaseModal;
  let purchaseChoices;
  let purchaseConfirm;
  let purchaseSelection = new Set();
  let toastTimer;
  let undoSnapshot = null;

  function loadItems() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      items = saved ? JSON.parse(saved) : starterItems;
      if (!Array.isArray(items)) items = starterItems;
    } catch (error) {
      console.warn("Einkaufsliste konnte nicht geladen werden.", error);
      items = starterItems;
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.warn("Einkaufsliste konnte nicht gespeichert werden.", error);
    }
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  function openLabels() {
    return items.filter((item) => !item.done).map((item) => item.label);
  }

  function render() {
    listElement.innerHTML = items.map((item) => `
      <li class="shopping-item${item.done ? " is-done" : ""}" data-id="${item.id}">
        <button class="item-toggle" type="button" aria-label="${item.done ? "Als offen markieren" : "Als erledigt markieren"}" data-action="toggle"></button>
        <p class="item-label">${escapeHtml(item.label)}</p>
        <button class="delete-button" type="button" aria-label="${escapeHtml(item.label)} löschen" data-action="delete">×</button>
      </li>
    `).join("");

    const openCount = openLabels().length;
    const completedCount = items.length - openCount;
    countElement.textContent = `${openCount} offen`;
    emptyElement.hidden = items.length !== 0;
    clearButton.disabled = items.length === 0;
    noteButton.disabled = openCount === 0;
    pdfButton.disabled = openCount === 0;
  }

  function addItem(label) {
    items.unshift({
      id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: label.trim(),
      done: false
    });
    saveItems();
    render();
  }

  function showToast(message, allowUndo = false) {
    window.clearTimeout(toastTimer);
    toastTextElement.textContent = message;
    undoButton.hidden = !allowUndo;
    toastElement.hidden = false;
    toastTimer = window.setTimeout(() => {
      toastElement.hidden = true;
      undoSnapshot = null;
    }, allowUndo ? 8000 : 3500);
  }

  function handleListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("[data-id]");
    const itemIndex = items.findIndex((item) => item.id === row.dataset.id);
    if (itemIndex === -1) return;

    if (button.dataset.action === "toggle") {
      items[itemIndex].done = !items[itemIndex].done;
    } else if (button.dataset.action === "delete") {
      items.splice(itemIndex, 1);
    }
    saveItems();
    render();
  }

  function renderPurchaseChoices() {
    purchaseChoices.innerHTML = items.map((item) => {
      const selected = purchaseSelection.has(item.id);
      return `
        <li>
          <button class="purchase-choice-button" type="button" data-purchase-id="${item.id}" aria-pressed="${selected}">
            <span class="purchase-choice-check" aria-hidden="true">${selected ? "✓" : ""}</span>
            <span>${escapeHtml(item.label)}</span>
          </button>
        </li>`;
    }).join("");
    purchaseConfirm.disabled = purchaseSelection.size === 0;
    purchaseConfirm.textContent = purchaseSelection.size === 0
      ? "Artikel auswählen"
      : `${purchaseSelection.size} ${purchaseSelection.size === 1 ? "Artikel" : "Artikel"} übernehmen`;
  }

  function openPurchaseDialog() {
    purchaseSelection = new Set(items.filter((item) => item.done).map((item) => item.id));
    renderPurchaseChoices();
    purchaseModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => document.getElementById("purchase-close").focus(), 0);
  }

  function closePurchaseDialog() {
    purchaseModal.hidden = true;
    document.body.style.overflow = "";
    purchaseSelection.clear();
    clearButton.focus();
  }

  function togglePurchaseChoice(event) {
    const button = event.target.closest("[data-purchase-id]");
    if (!button) return;
    const id = button.dataset.purchaseId;
    if (purchaseSelection.has(id)) purchaseSelection.delete(id);
    else purchaseSelection.add(id);
    renderPurchaseChoices();
  }

  function confirmPurchased() {
    const completedCount = purchaseSelection.size;
    if (completedCount === 0) return;
    undoSnapshot = items.map((item) => ({ ...item }));
    items = items
      .filter((item) => !purchaseSelection.has(item.id))
      .map((item) => ({ ...item, done: false }));
    saveItems();
    render();
    closePurchaseDialog();
    showToast(`${completedCount} ${completedCount === 1 ? "Artikel" : "Artikel"} als eingekauft entfernt`, true);
  }

  function undoClear() {
    if (!undoSnapshot) return;
    items = undoSnapshot;
    undoSnapshot = null;
    saveItems();
    render();
    showToast("Einkaufsliste wiederhergestellt");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function sharePdf() {
    const labels = openLabels();
    if (labels.length === 0) return;
    const blob = window.HomeExport.createShoppingPdf(labels);
    const filename = window.HomeExport.pdfFilename();
    const file = new File([blob], filename, { type: "application/pdf" });

    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        showToast("PDF zum Teilen bereitgestellt");
      } else {
        downloadBlob(blob, filename);
        showToast("PDF wurde gespeichert");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        downloadBlob(blob, filename);
        showToast("PDF wurde gespeichert");
      }
    }
  }

  async function shareNote() {
    const labels = openLabels();
    if (labels.length === 0) return;
    const text = window.HomeExport.formatListText(labels);

    try {
      if (navigator.share) {
        await navigator.share({ title: "Einkaufsliste", text });
        showToast("Einkaufsliste zum Teilen bereitgestellt");
      } else {
        downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), window.HomeExport.textFilename());
        showToast("Notiz wurde als Textdatei gespeichert");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), window.HomeExport.textFilename());
        showToast("Notiz wurde als Textdatei gespeichert");
      }
    }
  }

  window.HomeShopping = {
    init() {
      const form = document.getElementById("shopping-form");
      const input = document.getElementById("shopping-input");
      listElement = document.getElementById("shopping-list");
      countElement = document.getElementById("item-count");
      emptyElement = document.getElementById("empty-state");
      clearButton = document.getElementById("clear-completed-button");
      noteButton = document.getElementById("share-note-button");
      pdfButton = document.getElementById("share-pdf-button");
      toastElement = document.getElementById("shopping-toast");
      toastTextElement = document.getElementById("shopping-toast-text");
      undoButton = document.getElementById("undo-button");
      purchaseModal = document.getElementById("purchase-modal");
      purchaseChoices = document.getElementById("purchase-choices");
      purchaseConfirm = document.getElementById("purchase-confirm");

      loadItems();
      render();

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) return;
        addItem(value);
        input.value = "";
        input.focus();
      });
      listElement.addEventListener("click", handleListClick);
      clearButton.addEventListener("click", openPurchaseDialog);
      undoButton.addEventListener("click", undoClear);
      noteButton.addEventListener("click", shareNote);
      pdfButton.addEventListener("click", sharePdf);
      purchaseChoices.addEventListener("click", togglePurchaseChoice);
      purchaseConfirm.addEventListener("click", confirmPurchased);
      document.getElementById("purchase-cancel").addEventListener("click", closePurchaseDialog);
      document.getElementById("purchase-close").addEventListener("click", closePurchaseDialog);
      purchaseModal.addEventListener("click", (event) => {
        if (event.target === purchaseModal) closePurchaseDialog();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !purchaseModal.hidden) closePurchaseDialog();
      });
    }
  };
})();
