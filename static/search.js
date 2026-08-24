// Get basePath from data attribute or default
const basePath = document.documentElement.getAttribute('data-base-path') || '';

let searchAbortController = null;

function getBasePath() {
  // Try to get from element first, then fallback to relative detection
  const attr = document.documentElement.getAttribute('data-base-path');
  if (attr !== null) return attr;

  // Fallback: if current URL has a subpath before /api/search or similar
  const path = window.location.pathname;
  if (path.includes('/content/') || path.includes('/static/')) {
    const match = path.match(/^([^/]*\/[^/]*)\//);
    return match ? match[1] : '';
  }
  return '';
}

async function navbarSearch(query) {
  const resultsContainer = document.getElementById('navbar-search-results');

  if (!query.trim()) {
    resultsContainer.style.display = 'none';
    return;
  }

  // Cancel previous request if still pending
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();

  try {
    const bp = getBasePath();
    const url = `${bp}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: searchAbortController.signal });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      resultsContainer.innerHTML = '<div style="padding: 12px; color: var(--text-tertiary); text-align: center;">No results found</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    resultsContainer.innerHTML = results.map(result => `
      <a href="${bp}${result.path}" class="navbar-search-result">
        <div class="navbar-search-result-name">${escapeHtml(result.name)}</div>
        <div class="navbar-search-result-preview">${escapeHtml(result.preview)}</div>
      </a>
    `).join('');
    resultsContainer.style.display = 'block';
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Search error:', err);
      resultsContainer.innerHTML = '<div style="padding: 12px; color: var(--error-color);">Search failed</div>';
      resultsContainer.style.display = 'block';
    }
  }
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.navbar-search-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('navbar-search-results').style.display = 'none';
  }
});

// Keyboard navigation in search results
document.getElementById('navbar-search')?.addEventListener('keydown', (e) => {
  const results = document.querySelectorAll('.navbar-search-result');
  if (e.key === 'ArrowDown' && results.length > 0) {
    e.preventDefault();
    results[0].focus();
  }
});

// Cmd+K or Ctrl+K to focus search
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.getElementById('navbar-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
