// Export functionality for documents

function showExportMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('export-menu');
  if (!menu) return;

  const isVisible = menu.style.display !== 'none';
  menu.style.display = isVisible ? 'none' : 'block';

  if (!isVisible) {
    menu.focus();
  }
}

function exportDocument(format) {
  const html = document.documentElement;
  const basePath = html.getAttribute('data-base-path') || '';
  let fullPath = window.location.pathname.replace(basePath, '').replace(/^\//, '');

  if (!fullPath || fullPath === '/' || fullPath === '') {
    alert('Cannot export home page');
    return;
  }

  const exportUrl = `${basePath}/api/export?file=${encodeURIComponent(fullPath)}&format=${encodeURIComponent(format)}`;

  const link = document.createElement('a');
  link.href = exportUrl;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  closeExportMenu();
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
