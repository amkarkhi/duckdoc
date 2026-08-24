// Export functionality for documents

function showExportMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('export-menu');
  const btn = event.currentTarget;

  if (!menu) {
    console.warn('Export menu not found');
    return;
  }

  const isVisible = menu.style.display !== 'none';

  if (!isVisible) {
    // Position menu below button
    const rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
}

function exportDocument(format) {
  try {
    const html = document.documentElement;
    const basePath = html.getAttribute('data-base-path') || '';
    let fullPath = window.location.pathname.replace(basePath, '').replace(/^\//, '');

    if (!fullPath || fullPath === '/' || fullPath === '') {
      alert('Cannot export home page');
      return;
    }

    const exportUrl = `${basePath}/api/export?file=${encodeURIComponent(fullPath)}&format=${encodeURIComponent(format)}`;

    // Use window.location.href for cross-origin downloads
    window.location.href = exportUrl;

    closeExportMenu();
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export document. Check console for details.');
  }
}

function closeExportMenu() {
  const menu = document.getElementById('export-menu');
  if (menu) {
    menu.style.display = 'none';
  }
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('export-menu');
  const btn = document.querySelector('.navbar-export-btn');
  if (menu && btn && menu.style.display !== 'none') {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      closeExportMenu();
    }
  }
});

// Close menu on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeExportMenu();
  }
});
