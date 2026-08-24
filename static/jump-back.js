// Jump Back - Recently Viewed Documents Tracker
const JUMP_BACK_KEY = 'duckdoc-jump-back';
const MAX_ITEMS = 5;

// Track when user views a document
function trackDocumentView(filePath, fileName) {
  // Don't track the home page
  if (filePath === '/' || filePath === '/README.md' || !filePath) {
    return;
  }

  try {
    let history = JSON.parse(localStorage.getItem(JUMP_BACK_KEY)) || [];

    // Remove if already exists (we'll add it to top)
    history = history.filter(item => item.path !== filePath);

    // Add to beginning
    history.unshift({
      path: filePath,
      name: fileName || pathToName(filePath),
      timestamp: Date.now()
    });

    // Keep only recent items
    history = history.slice(0, MAX_ITEMS);

    localStorage.setItem(JUMP_BACK_KEY, JSON.stringify(history));
    updateJumpBackDisplay();
  } catch (e) {
    console.warn('Failed to track document view:', e);
  }
}

// Convert path to readable name
function pathToName(path) {
  const parts = path.split('/').filter(p => p);
  if (parts.length === 0) return 'Home';
  const lastPart = parts[parts.length - 1];
  return lastPart.replace(/\.[^.]+$/, '').replace(/-/g, ' ').replace(/_/g, ' ');
}

// Update the jump back display
function updateJumpBackDisplay() {
  const container = document.getElementById('jump-back-list');
  if (!container) return;

  try {
    let history = JSON.parse(localStorage.getItem(JUMP_BACK_KEY)) || [];

    if (history.length === 0) {
      container.innerHTML = '<div class="jump-back-empty">No recently viewed documents</div>';
      return;
    }

    container.innerHTML = history.map(item => `
      <a href="${item.path}" class="jump-back-item" title="${item.name}">
        <span class="jump-back-icon">📄</span>
        <div class="jump-back-content">
          <div class="jump-back-name">${escapeHtml(item.name)}</div>
          <div class="jump-back-path">${escapeHtml(item.path)}</div>
        </div>
      </a>
    `).join('');
  } catch (e) {
    console.warn('Failed to update jump back display:', e);
  }
}

// Helper to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize jump back on page load
document.addEventListener('DOMContentLoaded', () => {
  updateJumpBackDisplay();

  // Track current document if not on home page
  const currentFile = document.querySelector('[data-current-file]');
  if (currentFile) {
    const filePath = currentFile.getAttribute('data-current-file');
    const fileName = currentFile.getAttribute('data-file-name');
    if (filePath && filePath !== 'README.md') {
      trackDocumentView(filePath, fileName);
    }
  }

  // Also track via current breadcrumb if available
  const breadcrumbs = document.querySelectorAll('.breadcrumb-current');
  if (breadcrumbs.length > 0) {
    const currentPageName = breadcrumbs[breadcrumbs.length - 1].textContent;
    const currentPath = window.location.pathname;
    if (currentPath && currentPath !== '/' && currentPageName) {
      trackDocumentView(currentPath, currentPageName);
    }
  }
});

// Track on every page load by checking URL
window.addEventListener('load', () => {
  const path = window.location.pathname;
  if (path && path !== '/' && !path.includes('/static/') && !path.includes('/content/')) {
    const breadcrumbs = document.querySelectorAll('.breadcrumb-current');
    const name = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].textContent : pathToName(path);
    trackDocumentView(path, name);
  }
});

// Expose for manual tracking from other scripts
window.jumpBack = {
  track: trackDocumentView,
  clear: () => {
    try {
      localStorage.removeItem(JUMP_BACK_KEY);
      updateJumpBackDisplay();
    } catch (e) {
      console.warn('Failed to clear jump back:', e);
    }
  }
};
