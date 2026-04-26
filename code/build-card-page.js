#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "cards.json");
const PAGE_PATH = path.join(ROOT, "card.html");

const htmlEscapes = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapes[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\r?\n/g, " ");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatDateLabel(dateValue) {
  const value = String(dateValue || "");
  const fullDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const monthMatch = value.match(/^(\d{4})-(\d{2})$/);

  const formatMonth = (date) => new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);

  if (fullDateMatch) {
    const year = Number(fullDateMatch[1]);
    const month = Number(fullDateMatch[2]);
    const day = Number(fullDateMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return formatMonth(date);
    }
  }

  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    const date = new Date(Date.UTC(year, month - 1, 1));

    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1) {
      return formatMonth(date);
    }
  }

  return "";
}

function getCardDateLabel(card) {
  if (!card.date) {
    return "";
  }

  return formatDateLabel(card.date) || card.date;
}

function replaceGeneratedSection(html, name, content) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing generated section markers for ${name}`);
  }

  return html.slice(0, startIndex + start.length) + "\n" + content + "\n" + html.slice(endIndex);
}

function assertUniqueIds(items, label) {
  const seen = new Set();

  items.forEach((item) => {
    if (!item.id) {
      throw new Error(`${label} entry is missing an id`);
    }
    if (seen.has(item.id)) {
      throw new Error(`Duplicate ${label} id: ${item.id}`);
    }
    seen.add(item.id);
  });

  return seen;
}

function validateData(data) {
  if (!Array.isArray(data.banks) || !Array.isArray(data.types) || !Array.isArray(data.networks) || !Array.isArray(data.cards)) {
    throw new Error("cards.json must contain banks, types, networks, and cards arrays");
  }

  const bankIds = assertUniqueIds(data.banks, "bank");
  const typeIds = assertUniqueIds(data.types, "type");
  const networkIds = assertUniqueIds(data.networks, "network");

  data.banks.forEach((bank) => {
    if (!bank.name || !bank.shortName) {
      throw new Error(`Bank ${bank.id} must include shortName and name`);
    }

    if (bank.logo) {
      const logoPath = path.join(ROOT, bank.logo.replace(/^\//, ""));
      if (!fs.existsSync(logoPath)) {
        throw new Error(`Logo not found for ${bank.id}: ${bank.logo}`);
      }
    }
  });

  data.cards.forEach((card) => {
    if (!card.title) {
      throw new Error("A card entry is missing a title");
    }
    if (!bankIds.has(card.bank)) {
      throw new Error(`Unknown bank for ${card.title}: ${card.bank}`);
    }
    if (!typeIds.has(card.type)) {
      throw new Error(`Unknown type for ${card.title}: ${card.type}`);
    }
    if (!Array.isArray(card.networks)) {
      throw new Error(`Card networks must be an array for ${card.title}`);
    }

    card.networks.forEach((network) => {
      if (!networkIds.has(network)) {
        throw new Error(`Unknown network for ${card.title}: ${network}`);
      }
    });

    if (!card.image) {
      throw new Error(`Missing image for ${card.title}`);
    }

    if (card.date && !formatDateLabel(card.date)) {
      throw new Error(`Invalid date for ${card.title}: ${card.date}. Use YYYY-MM or YYYY-MM-DD.`);
    }

    const imagePath = path.join(ROOT, card.image.replace(/^\//, ""));
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found for ${card.title}: ${card.image}`);
    }
  });
}

function renderFilterButton(group, option, active) {
  const classes = active ? "filter-button active" : "filter-button";
  const pressed = active ? "true" : "false";

  return `            <button class="${classes}" type="button" data-filter-group="${escapeAttribute(group)}" data-filter-value="${escapeAttribute(option.id)}" aria-pressed="${pressed}">${escapeHtml(option.label)}</button>`;
}

function renderFilterGroup(group, legend, options) {
  const allOption = { id: "all", label: "All" };
  const buttons = [allOption].concat(options).map((option) => renderFilterButton(group, option, option.id === "all"));

  return [
    `        <fieldset data-filter-control="${escapeAttribute(group)}">`,
    `          <legend>${escapeHtml(legend)}</legend>`,
    "          <div class=\"filter-options\">",
    buttons.join("\n"),
    "          </div>",
    "        </fieldset>"
  ].join("\n");
}

function renderFilterPanel(data) {
  const bankOptions = data.banks.map((bank) => ({ id: bank.id, label: bank.shortName }));
  const totalCards = data.cards.length;
  const noun = totalCards === 1 ? "card" : "cards";

  return [
    "      <div class=\"card-toolbar\">",
    "        <label class=\"card-search-control\" for=\"card-search\">",
    "          <span>Search</span>",
    "          <input id=\"card-search\" type=\"search\" autocomplete=\"off\" placeholder=\"Card, bank, code\">",
    "        </label>",
    "",
    "        <label class=\"card-sort-control\" for=\"card-sort\">",
    "          <span>Sort</span>",
    "          <select id=\"card-sort\">",
    "            <option value=\"default\">Collection order</option>",
    "            <option value=\"newest\">Newest first</option>",
    "            <option value=\"oldest\">Oldest first</option>",
    "            <option value=\"name\">Name</option>",
    "            <option value=\"type\">Type</option>",
    "          </select>",
    "        </label>",
    "",
    "        <div class=\"card-view-control\" aria-label=\"Catalog view\">",
    "          <span>View</span>",
    "          <div class=\"card-view-options\" role=\"group\" aria-label=\"Catalog view\">",
    "            <button class=\"view-button active\" type=\"button\" data-card-view-button=\"banks\" aria-pressed=\"true\">Banks</button>",
    "            <button class=\"view-button\" type=\"button\" data-card-view-button=\"timeline\" aria-pressed=\"false\">Timeline</button>",
    "          </div>",
    "        </div>",
    "      </div>",
    "",
    "      <div class=\"card-filter-groups\">",
    renderFilterGroup("bank", "Bank", bankOptions),
    "",
    renderFilterGroup("type", "Type", data.types),
    "",
    renderFilterGroup("network", "Network", data.networks),
    "      </div>",
    "",
    "      <div class=\"filter-status-row\">",
    `        <p id="filter-count" class="filter-count" aria-live="polite">Showing ${totalCards} of ${totalCards} ${noun}</p>`,
    "        <button id=\"reset-filters\" class=\"filter-reset\" type=\"button\" hidden>Reset</button>",
    "      </div>"
  ].join("\n");
}

function toSearchText(card, bank, typeLabel, networkLabels) {
  return [
    card.title,
    card.alt,
    bank.shortName,
    bank.name,
    typeLabel,
    networkLabels,
    card.date,
    getCardDateLabel(card),
    card.active ? "Active" : "",
    card.note,
    card.code
  ].filter(Boolean).join(" ").toLowerCase();
}

function toBadgeClass(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderCardBadges(card, typeLabel, networkLabelsById) {
  const badges = [
    `<span class="card-badge card-badge-type ${escapeAttribute(card.type)}">${escapeHtml(typeLabel)}</span>`
  ];

  card.networks.forEach((network) => {
    const label = networkLabelsById.get(network) || network;
    badges.push(`<span class="card-badge card-badge-network card-badge-${escapeAttribute(toBadgeClass(network))}">${escapeHtml(label)}</span>`);
  });

  if (card.note) {
    badges.push(`<span class="card-badge card-badge-note">${escapeHtml(card.note)}</span>`);
  }

  if (card.active) {
    badges.push("<span class=\"card-badge card-badge-active\">Active</span>");
  }

  return badges.map((badge) => `              ${badge}`).join("\n");
}

function renderCardDate(card) {
  if (!card.date) {
    return "";
  }

  return `            <p class="card-date"><time datetime="${escapeAttribute(card.date)}">${escapeHtml(getCardDateLabel(card))}</time></p>`;
}

function renderCard(card, index, bank, typeLabels, networkLabelsById, options = {}) {
  const networks = card.networks.join(" ");
  const typeLabel = typeLabels.get(card.type) || card.type;
  const networkLabels = card.networks.map((network) => networkLabelsById.get(network) || network).join(", ");
  const searchText = toSearchText(card, bank, typeLabel, networkLabels);
  const dateLabel = getCardDateLabel(card);
  const styles = [];

  if (card.imagePosition) {
    styles.push(`--card-image-position: ${card.imagePosition};`);
  }
  if (card.imageScale) {
    styles.push(`--card-image-scale: ${card.imageScale};`);
  }

  const styleAttr = styles.length > 0 ? ` style="${escapeAttribute(styles.join(" "))}"` : "";
  const sizeAttrs = [
    card.width ? `width="${escapeAttribute(card.width)}"` : "",
    card.height ? `height="${escapeAttribute(card.height)}"` : ""
  ].filter(Boolean).join(" ");
  const eagerLimit = options.eagerLimit ?? 4;
  const loadingAttrs = index < eagerLimit ? "loading=\"eager\" fetchpriority=\"high\"" : "loading=\"lazy\"";
  const imageAttrs = [
    "class=\"card-cover\"",
    `src="${escapeAttribute(card.image)}"`,
    `alt="${escapeAttribute(card.alt || "")}"`,
    sizeAttrs,
    loadingAttrs,
    "decoding=\"async\""
  ].filter(Boolean).join(" ");

  return [
    `        <article class="card-entry" data-card-index="${index}" data-card-bank="${escapeAttribute(card.bank)}" data-card-bank-label="${escapeAttribute(bank.shortName)}" data-card-bank-name="${escapeAttribute(bank.name)}" data-card-type="${escapeAttribute(card.type)}" data-card-type-label="${escapeAttribute(typeLabel)}" data-card-network="${escapeAttribute(networks)}" data-card-network-labels="${escapeAttribute(networkLabels)}" data-card-title="${escapeAttribute(card.title)}" data-card-image="${escapeAttribute(card.image)}" data-card-alt="${escapeAttribute(card.alt || "")}" data-card-date="${escapeAttribute(card.date || "")}" data-card-date-label="${escapeAttribute(dateLabel)}" data-card-note="${escapeAttribute(card.note || "")}" data-card-code="${escapeAttribute(card.code || "")}" data-card-search="${escapeAttribute(searchText)}"${styleAttr}>`,
    `          <button class="card-preview-button" type="button" aria-label="View ${escapeAttribute(card.title)}">`,
    "            <span class=\"card-frame\">",
    `              <img ${imageAttrs}>`,
    "            </span>",
    "          </button>",
    "          <div class=\"card-caption\">",
    `            <h3>${escapeHtml(card.title)}</h3>`,
    "            <p class=\"card-bank-name\">",
    `              <span>${escapeHtml(bank.name)}</span>`,
    "            </p>",
    "            <div class=\"card-badges\" aria-label=\"Card tags\">",
    renderCardBadges(card, typeLabel, networkLabelsById),
    "            </div>",
    renderCardDate(card),
    "          </div>",
    "        </article>"
  ].join("\n");
}

function renderBankStyle(bank) {
  const variables = [];

  if (bank.color) {
    variables.push(`--bank-color: ${bank.color};`);
  }
  if (bank.logoHeight) {
    variables.push(`--bank-logo-height: ${bank.logoHeight};`);
  }

  return variables.length > 0 ? ` style="${escapeAttribute(variables.join(" "))}"` : "";
}

function renderBankLogo(bank) {
  if (bank.logo) {
    const logoAttrs = [
      `src="${escapeAttribute(bank.logo)}"`,
      `alt="${escapeAttribute(bank.name || bank.shortName)}"`,
      "loading=\"lazy\"",
      "decoding=\"async\""
    ].filter(Boolean).join(" ");

    return `        <span class="bank-logo"><img ${logoAttrs}></span>`;
  }

  return `        <span class="bank-monogram" aria-hidden="true">${escapeHtml(bank.shortName)}</span>`;
}

function renderBankHeading(bank) {
  if (bank.logo) {
    return [
      `      <h2 id="bank-${escapeAttribute(bank.id)}" class="bank-heading bank-heading-logo">`,
      renderBankLogo(bank),
      "      </h2>"
    ].join("\n");
  }

  return [
    `      <h2 id="bank-${escapeAttribute(bank.id)}" class="bank-heading">`,
    renderBankLogo(bank),
    "        <span class=\"bank-wordmark\">",
    `          <span class="bank-name">${escapeHtml(bank.name)}</span>`,
    "        </span>",
    "      </h2>"
  ].filter(Boolean).join("\n");
}

function getRenderContext(data) {
  return {
    banksById: new Map(data.banks.map((bank) => [bank.id, bank])),
    typeLabels: new Map(data.types.map((type) => [type.id, type.label])),
    networkLabelsById: new Map(data.networks.map((network) => [network.id, network.label]))
  };
}

function renderBankCatalog(data) {
  const context = getRenderContext(data);
  let cardIndex = 0;

  return data.banks
    .map((bank) => {
      const bankCards = data.cards.filter((card) => card.bank === bank.id);

      if (bankCards.length === 0) {
        return "";
      }

      const renderedCards = bankCards.map((card) => {
        const rendered = renderCard(card, cardIndex, bank, context.typeLabels, context.networkLabelsById);
        cardIndex += 1;
        return rendered;
      });

      return [
        `    <section class="bank-section ${escapeAttribute(bank.className || `bank-${bank.id}`)}" aria-labelledby="bank-${escapeAttribute(bank.id)}"${renderBankStyle(bank)}>`,
        renderBankHeading(bank),
        "",
        "      <div class=\"card-cover-grid\">",
        renderedCards.join("\n\n"),
        "      </div>",
        "    </section>"
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function renderTimelineCatalog(data) {
  const context = getRenderContext(data);
  const timelineCards = data.cards
    .map((card, originalIndex) => ({ card, originalIndex, bank: context.banksById.get(card.bank) }))
    .sort((a, b) => {
      const aDate = a.card.date || "";
      const bDate = b.card.date || "";

      if (aDate && !bDate) {
        return -1;
      }
      if (!aDate && bDate) {
        return 1;
      }

      return bDate.localeCompare(aDate) || a.originalIndex - b.originalIndex;
    });

  const renderedCards = timelineCards.map((item, timelineIndex) => (
    renderCard(item.card, timelineIndex, item.bank, context.typeLabels, context.networkLabelsById, { eagerLimit: 0 })
  ));

  return [
    "    <section class=\"timeline-section\" aria-label=\"Timeline\">",
    "      <div class=\"card-cover-grid timeline-grid\">",
    renderedCards.join("\n\n"),
    "      </div>",
    "    </section>"
  ].join("\n");
}

function main() {
  const data = readJson(DATA_PATH);
  validateData(data);

  let html = fs.readFileSync(PAGE_PATH, "utf8");
  html = replaceGeneratedSection(html, "card-filter-panel", renderFilterPanel(data));
  html = replaceGeneratedSection(html, "card-bank-catalog", renderBankCatalog(data));
  html = replaceGeneratedSection(html, "card-timeline-catalog", renderTimelineCatalog(data));

  fs.writeFileSync(PAGE_PATH, html, "utf8");
  console.log(`Built card.html from ${path.relative(ROOT, DATA_PATH)} (${data.cards.length} cards).`);
}

main();
