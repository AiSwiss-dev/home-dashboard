(function () {
  "use strict";

  const A4_WIDTH = 595;
  const A4_HEIGHT = 842;
  const ITEMS_PER_PAGE = 20;

  function dateLabel() {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date());
  }

  function fileDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function formatListText(labels) {
    return [`Einkaufsliste – ${dateLabel()}`, "", ...labels.map((label) => `☐ ${label}`)].join("\n");
  }

  function toWinAnsi(value) {
    const replacements = { "€": "\u0080", "‚": "\u0082", "ƒ": "\u0083", "„": "\u0084", "…": "\u0085", "†": "\u0086", "‡": "\u0087", "ˆ": "\u0088", "‰": "\u0089", "Š": "\u008a", "‹": "\u008b", "Œ": "\u008c", "Ž": "\u008e", "‘": "\u0091", "’": "\u0092", "“": "\u0093", "”": "\u0094", "•": "\u0095", "–": "\u0096", "—": "\u0097", "˜": "\u0098", "™": "\u0099", "š": "\u009a", "›": "\u009b", "œ": "\u009c", "ž": "\u009e", "Ÿ": "\u009f" };
    return [...String(value)].map((character) => {
      if (replacements[character]) return replacements[character];
      return character.charCodeAt(0) <= 255 ? character : "?";
    }).join("");
  }

  function pdfText(value) {
    return toWinAnsi(value).replace(/([\\()])/g, "\\$1");
  }

  function truncate(value, maxLength = 62) {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
  }

  function pageStream(labels, pageIndex, pageCount) {
    const commands = [
      "q",
      "0.10 0.22 0.38 rg",
      `BT /F1 28 Tf 56 770 Td (${pdfText("Einkaufsliste")}) Tj ET`,
      "0.39 0.47 0.55 rg",
      `BT /F1 11 Tf 56 746 Td (${pdfText(dateLabel())}) Tj ET`,
      "0.86 0.90 0.93 RG 0.8 w 56 727 m 539 727 l S"
    ];

    labels.forEach((label, index) => {
      const y = 690 - (index * 31);
      commands.push(
        "0.20 0.45 0.73 RG 1.2 w",
        `56 ${y - 3} 14 14 re S`,
        "0.10 0.16 0.25 rg",
        `BT /F1 14 Tf 84 ${y} Td (${pdfText(truncate(label))}) Tj ET`,
        "0.92 0.94 0.96 RG 0.5 w",
        `56 ${y - 12} m 539 ${y - 12} l S`
      );
    });

    commands.push(
      "0.50 0.56 0.62 rg",
      `BT /F1 9 Tf 56 38 Td (${pdfText(`Home Dashboard · Seite ${pageIndex + 1} von ${pageCount}`)}) Tj ET`,
      "Q"
    );
    return commands.join("\n");
  }

  function binaryBytes(value) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
    return bytes;
  }

  function createShoppingPdf(labels) {
    const pages = [];
    for (let index = 0; index < labels.length; index += ITEMS_PER_PAGE) {
      pages.push(labels.slice(index, index + ITEMS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);

    const fontObject = 3 + (pages.length * 2);
    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    const pageReferences = pages.map((_, index) => `${3 + (index * 2)} 0 R`).join(" ");
    objects[2] = `<< /Type /Pages /Kids [${pageReferences}] /Count ${pages.length} >>`;

    pages.forEach((pageItems, index) => {
      const pageObject = 3 + (index * 2);
      const contentObject = pageObject + 1;
      const stream = pageStream(pageItems, index, pages.length);
      objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
      objects[contentObject] = `<< /Length ${binaryBytes(stream).length} >>\nstream\n${stream}\nendstream`;
    });
    objects[fontObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

    let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
    const offsets = [0];
    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = binaryBytes(pdf).length;
      pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = binaryBytes(pdf).length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([binaryBytes(pdf)], { type: "application/pdf" });
  }

  window.HomeExport = {
    createShoppingPdf,
    formatListText,
    pdfFilename: () => `Einkaufsliste-${fileDate()}.pdf`,
    textFilename: () => `Einkaufsliste-${fileDate()}.txt`
  };
})();
