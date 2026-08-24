document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  initializeSidebar();
  initializeFolderTree();
  initializeTOCScroll();
  initializeHeroSearch();
  initializeSlashFocus();
});

function initializeSidebar() {
  const isMobile = window.innerWidth <= 768;
  console.log('Initializing sidebar. Mobile:', isMobile, 'Width:', window.innerWidth);
  if (!isMobile) {
    const isCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
    console.log('Restoring sidebar state. Collapsed:', isCollapsed);
    if (isCollapsed) {
      document.body.classList.add("sidebar-collapsed");
    }
  }
  updateSidebarIcon();
}

function initializeFolderTree() {
  const savedExpanded = getSavedFolderPaths();

  document.querySelectorAll(".tree-menu .folder").forEach((folder) => {
    const path = getFolderPath(folder);
    const shouldExpand = savedExpanded.includes(path) || folder.classList.contains("active-ancestor");
    folder.classList.toggle("expanded", shouldExpand);
  });

  const activeLink = document.querySelector(".tree-menu .file a.active");
  if (activeLink) {
    activeLink.scrollIntoView({ block: "nearest" });
  }

  document.querySelectorAll(".tree-menu .folder-name").forEach((folderName) => {
    folderName.addEventListener("click", onFolderClick);
  });
}

function initializeTOCScroll() {
  const contentEl = document.querySelector(".content");
  if (!contentEl) return;

  document.querySelectorAll(".toc a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const id = link.getAttribute("href").substring(1);
      const target = document.getElementById(id);
      if (!target) return;
      contentEl.scrollTo({ top: target.offsetTop - 20, behavior: "smooth" });
    });
  });

  contentEl.addEventListener("scroll", updateTOCHighlight);
  updateTOCHighlight();
}

function updateTOCHighlight() {
  const contentEl = document.querySelector(".content");
  if (!contentEl) return;

  const sections = contentEl.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
  const tocLinks = document.querySelectorAll(".toc a");
  const scrollTop = contentEl.scrollTop;

  let current = "";
  sections.forEach((section) => {
    if (scrollTop >= section.offsetTop - 60) {
      current = section.getAttribute("id");
    }
  });

  tocLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === "#" + current);
  });
}

function onFolderClick(e) {
  try {
    e.stopPropagation();
    e.preventDefault();

    const folderName = e.currentTarget;
    const folder = folderName.parentElement;
    const path = getFolderPath(folder);
    const isCurrentlyExpanded = folder.classList.contains("expanded");

    // Toggle the expanded class
    const willBeExpanded = !isCurrentlyExpanded;
    folder.classList.toggle("expanded", willBeExpanded);

    // Save state to localStorage
    let saved = getSavedFolderPaths();
    if (willBeExpanded && !saved.includes(path)) {
      saved.push(path);
    } else if (!willBeExpanded && saved.includes(path)) {
      saved = saved.filter((p) => p !== path);
    }
    localStorage.setItem("expandedFolders", JSON.stringify(saved));

    console.log('Folder toggle:', path, 'Now:', willBeExpanded ? 'expanded' : 'collapsed');
  } catch (error) {
    console.error('Error in onFolderClick:', error);
  }
}

function getFolderPath(folderEl) {
  return (
    folderEl.getAttribute("data-full-path") ||
    folderEl.querySelector(".folder-name")?.textContent ||
    ""
  );
}

function getSavedFolderPaths() {
  return JSON.parse(localStorage.getItem("expandedFolders") || "[]");
}

// ── Smart search ─────────────────────────────────────────────────────────────

// Returns true if every token in the query appears (in order, non-contiguous)
// as a subsequence inside the target string.
function fuzzyMatch(target, tokens) {
  const t = target.toLowerCase();
  for (const token of tokens) {
    let idx = 0;
    let pos = -1;
    // Each token must appear as a subsequence
    for (let i = 0; i < token.length; i++) {
      pos = t.indexOf(token[i], idx);
      if (pos === -1) return false;
      idx = pos + 1;
    }
  }
  return true;
}

// Highlights query tokens inside text with <mark> spans.
function highlightText(text, tokens) {
  if (!tokens.length) return escapeHtml(text);
  // Build a combined alternation for all tokens (substring match for highlighting)
  const pattern = tokens.map((t) => escapeRegex(t)).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  return escapeHtml(text).replace(re, "<mark>$1</mark>");
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(query) {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

function filterTree() {
  const query = document.getElementById("search-bar")?.value || "";
  const tokens = tokenize(query);
  const countEl = document.getElementById("search-count");
  const allItems = document.querySelectorAll(".tree-menu li");

  if (!tokens.length) {
    allItems.forEach((item) => {
      item.style.display = "";
      // Remove any highlights applied during search
      const nameEl = item.querySelector(".folder-name") || item.querySelector("a");
      if (nameEl && nameEl.dataset.originalText) {
        nameEl.innerHTML = nameEl.dataset.originalText;
        delete nameEl.dataset.originalText;
      }
    });
    if (countEl) countEl.style.display = "none";
    restoreFolderStates();
    return;
  }

  allItems.forEach((item) => (item.style.display = "none"));

  let matchCount = 0;

  allItems.forEach((item) => {
    const nameEl = item.querySelector(".folder-name") || item.querySelector("a");
    const rawText = nameEl?.textContent.toLowerCase() || "";
    const rawPath = (item.dataset.fullPath || "").toLowerCase();

    if (!fuzzyMatch(rawText, tokens) && !fuzzyMatch(rawPath, tokens)) return;

    item.style.display = "block";
    matchCount++;

    // Highlight matched tokens in the label
    if (nameEl) {
      if (!nameEl.dataset.originalText) {
        nameEl.dataset.originalText = nameEl.innerHTML;
      }
      const plainText = nameEl.textContent;
      nameEl.innerHTML = highlightText(plainText, tokens);
    }

    if (item.classList.contains("folder")) {
      item.querySelectorAll("li").forEach((child) => (child.style.display = "block"));
    }

    showParents(item);
  });

  // Ensure folders with any visible children are themselves visible
  document.querySelectorAll(".tree-menu .folder").forEach((folder) => {
    const hasVisible = folder.querySelector('li:not([style*="display: none"])');
    if (hasVisible) {
      folder.style.display = "block";
      showParents(folder);
    }
  });

  // Expand folders that contain results
  document.querySelectorAll(".tree-menu .folder").forEach((folder) => {
    if (folder.style.display !== "none") {
      folder.classList.add("expanded");
    }
  });

  if (countEl) {
    if (matchCount > 0) {
      countEl.textContent = matchCount + " result" + (matchCount !== 1 ? "s" : "");
      countEl.style.display = "inline-block";
    } else {
      countEl.textContent = "No results";
      countEl.style.display = "inline-block";
    }
  }
}

function showParents(el) {
  let parent = el.parentElement;
  while (parent && !parent.classList.contains("tree-menu")) {
    if (parent.tagName === "UL" || parent.tagName === "LI") {
      parent.style.display = "block";
    }
    parent = parent.parentElement;
  }
}

function restoreFolderStates() {
  const saved = getSavedFolderPaths();
  document.querySelectorAll(".tree-menu .folder").forEach((folder) => {
    folder.classList.toggle("expanded", saved.includes(getFolderPath(folder)));
  });
}

// ── Hero page search ──────────────────────────────────────────────────────────

let heroIndex = -1;
let heroResults = [];

function initializeHeroSearch() {
  const input = document.getElementById("hero-search");
  if (!input) return;
  // Pre-build index from sidebar tree links (available even on home page)
  buildSearchIndex();
}

let searchIndex = [];

function buildSearchIndex() {
  searchIndex = [];
  document.querySelectorAll(".tree-menu .file a").forEach((a) => {
    searchIndex.push({ label: a.textContent.trim(), href: a.getAttribute("href"), path: a.closest("li")?.dataset?.fullPath || "" });
  });
}

function heroSearch(query) {
  const resultsEl = document.getElementById("hero-search-results");
  if (!resultsEl) return;

  const tokens = tokenize(query);
  if (!tokens.length) {
    resultsEl.style.display = "none";
    heroResults = [];
    heroIndex = -1;
    return;
  }

  heroResults = searchIndex.filter((item) =>
    fuzzyMatch(item.label, tokens) || fuzzyMatch(item.path, tokens)
  ).slice(0, 10);

  heroIndex = -1;

  if (!heroResults.length) {
    resultsEl.innerHTML = `<div class="hero-search-empty">No results for <em>${escapeHtml(query)}</em></div>`;
    resultsEl.style.display = "block";
    return;
  }

  resultsEl.innerHTML = heroResults.map((item, i) => {
    const label = highlightText(item.label, tokens);
    const path = item.path ? `<span class="hero-result-path">${highlightText(item.path, tokens)}</span>` : "";
    return `<a class="hero-result-item" href="${escapeHtml(item.href)}" data-idx="${i}">${label}${path}</a>`;
  }).join("");
  resultsEl.style.display = "block";

  // Also sync sidebar search
  const sidebarBar = document.getElementById("search-bar");
  if (sidebarBar) {
    sidebarBar.value = query;
    filterTree();
  }
}

function heroSearchKeydown(e) {
  const resultsEl = document.getElementById("hero-search-results");
  if (!resultsEl || resultsEl.style.display === "none") return;

  const items = resultsEl.querySelectorAll(".hero-result-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    heroIndex = Math.min(heroIndex + 1, items.length - 1);
    updateHeroResultFocus(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    heroIndex = Math.max(heroIndex - 1, 0);
    updateHeroResultFocus(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (heroIndex >= 0 && heroResults[heroIndex]) {
      window.location.href = heroResults[heroIndex].href;
    } else if (heroResults[0]) {
      window.location.href = heroResults[0].href;
    }
  } else if (e.key === "Escape") {
    resultsEl.style.display = "none";
    heroIndex = -1;
  }
}

function updateHeroResultFocus(items) {
  items.forEach((el, i) => el.classList.toggle("focused", i === heroIndex));
  if (heroIndex >= 0) items[heroIndex].scrollIntoView({ block: "nearest" });
}

// Close hero results on outside click
document.addEventListener("click", (e) => {
  const resultsEl = document.getElementById("hero-search-results");
  const input = document.getElementById("hero-search");
  if (resultsEl && !resultsEl.contains(e.target) && e.target !== input) {
    resultsEl.style.display = "none";
  }
});

// ── Keyboard shortcut: "/" focuses search ─────────────────────────────────────

function initializeSlashFocus() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
    e.preventDefault();
    const hero = document.getElementById("hero-search");
    if (hero) {
      hero.focus();
    } else {
      document.getElementById("search-bar")?.focus();
    }
  });
}

// ── Sidebar toggle ─────────────────────────────────────────────────────────────

function toggleSidebar() {
  try {
    const isMobile = window.innerWidth <= 768;
    const body = document.body;

    console.log('=== SIDEBAR TOGGLE CALLED ===');
    console.log('Mobile mode:', isMobile, 'Width:', window.innerWidth);

    if (isMobile) {
      const isOpen = body.classList.toggle("sidebar-mobile-open");
      isOpen ? createOverlay() : removeOverlay();
      console.log('✓ Mobile sidebar toggled. Open:', isOpen);
    } else {
      const wasCollapsed = body.classList.contains("sidebar-collapsed");
      body.classList.toggle("sidebar-collapsed");
      const isNowCollapsed = body.classList.contains("sidebar-collapsed");
      localStorage.setItem("sidebar-collapsed", String(isNowCollapsed));
      console.log('✓ Desktop sidebar. Was collapsed:', wasCollapsed, '→ Now collapsed:', isNowCollapsed);
      console.log('✓ Grid columns should change from: 280px 1fr 240px to: 56px 1fr 240px');
    }

    updateSidebarIcon();
    console.log('=== SIDEBAR TOGGLE COMPLETE ===');
  } catch (e) {
    console.error('❌ Error in toggleSidebar:', e);
  }
}

function createOverlay() {
  if (document.querySelector(".sidebar-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  overlay.addEventListener("click", () => {
    document.body.classList.remove("sidebar-mobile-open");
    removeOverlay();
    updateSidebarIcon();
  });
  document.body.appendChild(overlay);
}

function removeOverlay() {
  document.querySelector(".sidebar-overlay")?.remove();
}

function updateSidebarIcon() {
  const icon = document.getElementById("sidebar-icon");
  if (!icon) return;
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    icon.textContent = document.body.classList.contains("sidebar-mobile-open") ? "✕" : "☰";
  } else {
    icon.textContent = document.body.classList.contains("sidebar-collapsed") ? "→" : "☰";
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function toggleTheme() {
  const html = document.documentElement;
  const newTheme = html.getAttribute("data-theme") === "light" ? "dark" : "light";
  html.setAttribute("data-theme", newTheme);
  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = newTheme === "light" ? "🌞" : "🌙";
  localStorage.setItem("theme", newTheme);
}

function initializeTheme() {
  const icon = document.getElementById("theme-icon");
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  if (icon) icon.textContent = theme === "light" ? "🌞" : "🌙";
}

window.addEventListener("resize", () => {
  const isMobile = window.innerWidth <= 768;
  const body = document.body;

  if (isMobile) {
    body.classList.remove("sidebar-collapsed");
    removeOverlay();
  } else {
    body.classList.remove("sidebar-mobile-open");
    removeOverlay();
    const isCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
    body.classList.toggle("sidebar-collapsed", isCollapsed);
  }

  updateSidebarIcon();
});
