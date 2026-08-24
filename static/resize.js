// Resizable sidebar and TOC functionality

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const MIN_TOC_WIDTH = 180;
const MAX_TOC_WIDTH = 400;
const STORAGE_KEY_SIDEBAR = 'duckdoc-sidebar-width';
const STORAGE_KEY_TOC = 'duckdoc-toc-width';

let isResizingSidebar = false;
let isResizingTOC = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

function initializeResize() {
  const sidebar = document.querySelector('.sidebar');
  const toc = document.querySelector('.toc');

  if (!sidebar || !toc) return;

  // Restore saved widths
  const savedSidebarWidth = localStorage.getItem(STORAGE_KEY_SIDEBAR);
  const savedTOCWidth = localStorage.getItem(STORAGE_KEY_TOC);

  if (savedSidebarWidth) {
    document.body.style.gridTemplateColumns = `${savedSidebarWidth}px 1fr ${savedTOCWidth || '240px'}px`;
  }

  if (savedTOCWidth) {
    toc.style.width = savedTOCWidth + 'px';
  }

  // Create resize handles
  addSidebarResizeHandle(sidebar);
  addTOCResizeHandle(toc);
}

function addSidebarResizeHandle(sidebar) {
  const handle = document.createElement('div');
  handle.className = 'resize-handle sidebar-resize';
  sidebar.appendChild(handle);

  handle.addEventListener('mousedown', startResizeSidebar);
}

function addTOCResizeHandle(toc) {
  const handle = document.createElement('div');
  handle.className = 'resize-handle toc-resize';
  toc.appendChild(handle);

  handle.addEventListener('mousedown', startResizeTOC);
}

function startResizeSidebar(e) {
  e.preventDefault();
  isResizingSidebar = true;
  resizeStartX = e.clientX;
  resizeStartWidth = document.querySelector('.sidebar').offsetWidth;
  document.body.classList.add('resizing');
  document.documentElement.style.cursor = 'col-resize';
  e.target.classList.add('active');

  document.addEventListener('mousemove', resizeSidebar);
  document.addEventListener('mouseup', stopResizeSidebar);
}

function startResizeTOC(e) {
  e.preventDefault();
  isResizingTOC = true;
  resizeStartX = e.clientX;
  resizeStartWidth = document.querySelector('.toc').offsetWidth;
  document.body.classList.add('resizing');
  document.documentElement.style.cursor = 'col-resize';
  e.target.classList.add('active');

  document.addEventListener('mousemove', resizeTOC);
  document.addEventListener('mouseup', stopResizeTOC);
}

function resizeSidebar(e) {
  if (!isResizingSidebar) return;

  const delta = e.clientX - resizeStartX;
  const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, resizeStartWidth + delta));

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.style.width = newWidth + 'px';
    localStorage.setItem(STORAGE_KEY_SIDEBAR, newWidth);
    updateGridLayout();
  }
}

function resizeTOC(e) {
  if (!isResizingTOC) return;

  const delta = resizeStartX - e.clientX;
  const newWidth = Math.max(MIN_TOC_WIDTH, Math.min(MAX_TOC_WIDTH, resizeStartWidth + delta));

  const toc = document.querySelector('.toc');
  if (toc) {
    toc.style.width = newWidth + 'px';
    localStorage.setItem(STORAGE_KEY_TOC, newWidth);
    updateGridLayout();
  }
}

function stopResizeSidebar() {
  if (!isResizingSidebar) return;
  isResizingSidebar = false;
  document.body.classList.remove('resizing');
  document.documentElement.style.cursor = '';
  document.querySelector('.sidebar-resize').classList.remove('active');
  document.removeEventListener('mousemove', resizeSidebar);
  document.removeEventListener('mouseup', stopResizeSidebar);
}

function stopResizeTOC() {
  if (!isResizingTOC) return;
  isResizingTOC = false;
  document.body.classList.remove('resizing');
  document.documentElement.style.cursor = '';
  document.querySelector('.toc-resize').classList.remove('active');
  document.removeEventListener('mousemove', resizeTOC);
  document.removeEventListener('mouseup', stopResizeTOC);
}

function updateGridLayout() {
  const sidebar = document.querySelector('.sidebar');
  const toc = document.querySelector('.toc');

  if (sidebar && toc) {
    const sidebarWidth = sidebar.offsetWidth;
    const tocWidth = toc.offsetWidth;
    document.body.style.gridTemplateColumns = `${sidebarWidth}px 1fr ${tocWidth}px`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeResize);
} else {
  initializeResize();
}
