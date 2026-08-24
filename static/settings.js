// Settings management for DuckDoc
const DEFAULT_SETTINGS = {
  fontSize: 16,
  lineHeight: 1.6,
  contentWidth: 'normal',
  showSidebar: true,
  showTOC: true,
  focusMode: false,
  compactMode: false,
};

// Load settings from localStorage
function loadSettings() {
  try {
    const saved = localStorage.getItem('duckdoc-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Save settings to localStorage
function saveSettings(settings) {
  try {
    localStorage.setItem('duckdoc-settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

// Apply all settings to the DOM
function applySettings(settings = loadSettings()) {
  // Font size - apply to content and main text elements only (not documentElement which causes zoom)
  document.body.style.fontSize = settings.fontSize + 'px';
  const content = document.querySelector('.content');
  if (content) content.style.fontSize = settings.fontSize + 'px';

  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeValue = document.getElementById('font-size-value');
  if (fontSizeSlider) fontSizeSlider.value = settings.fontSize;
  if (fontSizeValue) fontSizeValue.textContent = settings.fontSize + 'px';

  // Line height - apply to body and content for text readability
  document.body.style.lineHeight = settings.lineHeight;
  const content2 = document.querySelector('.content');
  if (content2) content2.style.lineHeight = settings.lineHeight;

  const lineHeightSlider = document.getElementById('line-height-slider');
  const lineHeightValue = document.getElementById('line-height-value');
  if (lineHeightSlider) lineHeightSlider.value = settings.lineHeight;
  if (lineHeightValue) lineHeightValue.textContent = settings.lineHeight.toFixed(1);

  // Content width
  setContentWidth(settings.contentWidth);

  // Sidebar visibility
  document.getElementById('sidebar-toggle').checked = settings.showSidebar;
  if (!settings.showSidebar) {
    document.body.classList.add('toc-hidden');
  } else {
    document.body.classList.remove('toc-hidden');
  }

  // TOC visibility
  document.getElementById('toc-toggle').checked = settings.showTOC;
  if (!settings.showTOC) {
    document.body.classList.add('sidebar-hidden');
  } else {
    document.body.classList.remove('sidebar-hidden');
  }

  // Focus mode
  document.getElementById('focus-mode').checked = settings.focusMode;
  if (settings.focusMode) {
    document.body.classList.add('focus-mode');
  } else {
    document.body.classList.remove('focus-mode');
  }

  // Compact mode
  document.getElementById('compact-mode').checked = settings.compactMode;
  if (settings.compactMode) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }
}

// Settings panel toggle
function toggleSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

// Font size functions
function changeFontSize(delta) {
  const slider = document.getElementById('font-size-slider');
  const newSize = Math.max(12, Math.min(20, parseInt(slider.value) + delta));
  slider.value = newSize;
  setFontSize(newSize);
}

function setFontSize(size) {
  document.body.style.fontSize = size + 'px';
  const content = document.querySelector('.content');
  if (content) content.style.fontSize = size + 'px';

  const fontSizeValue = document.getElementById('font-size-value');
  if (fontSizeValue) fontSizeValue.textContent = size + 'px';
  const settings = loadSettings();
  settings.fontSize = parseInt(size);
  saveSettings(settings);
}

// Line height functions
function changeLineHeight(delta) {
  const slider = document.getElementById('line-height-slider');
  const newHeight = Math.max(1.4, Math.min(2.0, parseFloat(slider.value) + delta));
  slider.value = newHeight;
  setLineHeight(newHeight);
}

function setLineHeight(height) {
  document.body.style.lineHeight = height;
  const content = document.querySelector('.content');
  if (content) content.style.lineHeight = height;

  const lineHeightValue = document.getElementById('line-height-value');
  if (lineHeightValue) lineHeightValue.textContent = height.toFixed(1);
  const settings = loadSettings();
  settings.lineHeight = parseFloat(height);
  saveSettings(settings);
}

// Content width
function setContentWidth(width) {
  // Update button states
  document.querySelectorAll('[data-width]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-width') === width);
  });

  // Apply width class
  document.body.classList.remove('content-narrow', 'content-normal', 'content-wide');
  document.body.classList.add(`content-${width}`);

  // Save
  const settings = loadSettings();
  settings.contentWidth = width;
  saveSettings(settings);
}

// Sidebar visibility
function toggleSidebarView() {
  const checked = document.getElementById('sidebar-toggle').checked;
  if (checked) {
    document.body.classList.remove('toc-hidden');
  } else {
    document.body.classList.add('toc-hidden');
  }
  const settings = loadSettings();
  settings.showSidebar = checked;
  saveSettings(settings);
}

// TOC visibility
function toggleTOCView() {
  const checked = document.getElementById('toc-toggle').checked;
  if (checked) {
    document.body.classList.remove('sidebar-hidden');
  } else {
    document.body.classList.add('sidebar-hidden');
  }
  const settings = loadSettings();
  settings.showTOC = checked;
  saveSettings(settings);
}

// Focus mode (hide sidebars)
function toggleFocusMode() {
  const checked = document.getElementById('focus-mode').checked;
  if (checked) {
    document.body.classList.add('focus-mode');
  } else {
    document.body.classList.remove('focus-mode');
  }
  const settings = loadSettings();
  settings.focusMode = checked;
  saveSettings(settings);
}

// Compact mode
function toggleCompactMode() {
  const checked = document.getElementById('compact-mode').checked;
  if (checked) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }
  const settings = loadSettings();
  settings.compactMode = checked;
  saveSettings(settings);
}

// Reset to defaults
function resetSettings() {
  if (confirm('Reset all settings to defaults?')) {
    localStorage.removeItem('duckdoc-settings');
    applySettings(DEFAULT_SETTINGS);
  }
}

// Initialize immediately since this script is at the end of body
// All DOM elements should be available
applySettings();

// Close settings panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('settings-panel');
  const settingsBtn = document.querySelector('.navbar-settings-btn');
  if (panel && settingsBtn && panel.style.display !== 'none') {
    if (!panel.contains(e.target) && !settingsBtn.contains(e.target)) {
      panel.style.display = 'none';
    }
  }
});
