document.addEventListener("DOMContentLoaded", () => {
  // Initialize theme
  initializeTheme();
  
  // Wait a bit to ensure all HTML is rendered
  setTimeout(() => {
    // Restore expanded folder states from localStorage
    const expandedFolders = JSON.parse(localStorage.getItem('expandedFolders') || '[]');
    
    // First, ensure all folders start collapsed, then restore saved states
    const allFolders = document.querySelectorAll(".tree-menu .folder");
    allFolders.forEach((folder) => {
      const folderName = folder.querySelector(".folder-name");
      const folderPath = folder.getAttribute("data-full-path") || folderName?.textContent || "";
      
      // Remove any existing expanded class
      folder.classList.remove("expanded");
      
      // Explicitly set the ul to be hidden
      const ul = folder.querySelector("ul");
      if (ul) {
        ul.style.maxHeight = "0";
        ul.style.overflow = "hidden";
      }
      
      // Restore expanded state if it was previously expanded
      if (expandedFolders.includes(folderPath)) {
        folder.classList.add("expanded");
        if (ul) {
          ul.style.maxHeight = "1000px";
        }
      }
    });

    // Then set up click handlers with state saving
    const toggleSubmenu = (event) => {
      event.stopPropagation();
      event.preventDefault();
      
      const folderElement = event.target.parentElement;
      const ul = folderElement.querySelector("ul");
      const folderPath = folderElement.getAttribute("data-full-path") || event.target.textContent || "";
      
      // Get current expanded folders
      let expandedFolders = JSON.parse(localStorage.getItem('expandedFolders') || '[]');
      
      if (folderElement.classList.contains("expanded")) {
        // Collapse
        folderElement.classList.remove("expanded");
        if (ul) {
          ul.style.maxHeight = "0";
        }
        // Remove from expanded folders list
        expandedFolders = expandedFolders.filter(path => path !== folderPath);
      } else {
        // Expand
        folderElement.classList.add("expanded");
        if (ul) {
          ul.style.maxHeight = "1000px";
        }
        // Add to expanded folders list
        if (!expandedFolders.includes(folderPath)) {
          expandedFolders.push(folderPath);
        }
      }
      
      // Save updated state to localStorage
      localStorage.setItem('expandedFolders', JSON.stringify(expandedFolders));
    };

    // Add click listeners to ALL folder names
    const folderNames = document.querySelectorAll(".tree-menu .folder-name");
    folderNames.forEach((folder) => {
      folder.addEventListener("click", toggleSubmenu);
      // Make sure it's styled as clickable
      folder.style.cursor = "pointer";
    });
    
  }, 200);

  // Smooth scroll for TOC
  const tocLinks = document.querySelectorAll(".toc a");
  tocLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
});

// Function to filter the tree based on search input
function filterTree() {
  const searchInput = document.getElementById("search-bar");
  const query = searchInput.value.toLowerCase();
  const treeItems = document.querySelectorAll(".tree-menu li");

  if (query === "") {
    // Show all items when no search query and restore saved folder states
    treeItems.forEach((item) => {
      item.style.display = "block";
    });
    
    // Restore expanded folder states from localStorage instead of collapsing all
    const expandedFolders = JSON.parse(localStorage.getItem('expandedFolders') || '[]');
    const allFolders = document.querySelectorAll(".tree-menu .folder");
    
    allFolders.forEach((folder) => {
      const folderPath = folder.getAttribute("data-full-path") || folder.querySelector(".folder-name")?.textContent || "";
      const ul = folder.querySelector("ul");
      
      if (expandedFolders.includes(folderPath)) {
        folder.classList.add("expanded");
        if (ul) {
          ul.style.maxHeight = "1000px";
        }
      } else {
        folder.classList.remove("expanded");
        if (ul) {
          ul.style.maxHeight = "0";
        }
      }
    });
    return;
  }

  // First, hide all items
  treeItems.forEach((item) => {
    item.style.display = "none";
  });

  // Then show items that match and handle folder/children logic
  treeItems.forEach((item) => {
    const folderName = item.querySelector(".folder-name");
    const fileLink = item.querySelector("a");
    const isFolder = item.classList.contains("folder");
    
    let itemText = "";
    let itemPath = "";
    
    if (folderName) {
      itemText = folderName.textContent.toLowerCase();
      itemPath = item.dataset.fullPath ? item.dataset.fullPath.toLowerCase() : "";
    } else if (fileLink) {
      itemText = fileLink.textContent.toLowerCase();
      itemPath = item.dataset.fullPath ? item.dataset.fullPath.toLowerCase() : "";
    }

    const isMatch = itemText.includes(query) || itemPath.includes(query);

    if (isMatch) {
      item.style.display = "block";
      
      // If this is a folder that matches, show ALL its children
      if (isFolder) {
        const childItems = item.querySelectorAll("li");
        childItems.forEach((child) => {
          child.style.display = "block";
        });
      }
      
      // Show all parent folders up to the root
      let parent = item.parentElement;
      while (parent) {
        if (parent.tagName === "UL") {
          parent.style.display = "block";
          parent = parent.parentElement;
        } else if (parent.tagName === "LI") {
          parent.style.display = "block";
          parent = parent.parentElement;
        } else {
          break;
        }
      }
    }
  });

  // Second pass: ensure folders with visible children are also visible
  const folders = document.querySelectorAll(".tree-menu .folder");
  folders.forEach((folder) => {
    const visibleChildren = folder.querySelectorAll('li:not([style*="display: none"])');
    if (visibleChildren.length > 0) {
      folder.style.display = "block";
      
      // Also ensure parent folders are visible
      let parent = folder.parentElement;
      while (parent) {
        if (parent.tagName === "UL") {
          parent.style.display = "block";
          parent = parent.parentElement;
        } else if (parent.tagName === "LI") {
          parent.style.display = "block";
          parent = parent.parentElement;
        } else {
          break;
        }
      }
    }
  });
}

// Toggle sidebar functionality
function toggleSidebar() {
    const body = document.body;
    const sidebarIcon = document.getElementById('sidebar-icon');
    
    body.classList.toggle('sidebar-collapsed');
    
    // Update icon based on state
    const isCollapsed = body.classList.contains('sidebar-collapsed');
    if (sidebarIcon) {
        sidebarIcon.textContent = isCollapsed ? '→' : '☰';
    }
    
    // Store the sidebar state in localStorage
    localStorage.setItem('sidebar-collapsed', isCollapsed);
}

// Theme toggle functionality
function toggleTheme() {
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    themeIcon.textContent = newTheme === 'light' ? '🌞' : '🌙';
    
    // Store the theme preference in localStorage
    localStorage.setItem('theme', newTheme);
}

// Initialize theme from localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    
    html.setAttribute('data-theme', savedTheme);
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'light' ? '🌞' : '🌙';
    }
}

// Initialize sidebar state from localStorage
document.addEventListener('DOMContentLoaded', function() {
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    const sidebarIcon = document.getElementById('sidebar-icon');
    
    if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
    }
    
    // Set the correct icon based on collapsed state
    if (sidebarIcon) {
        sidebarIcon.textContent = isCollapsed ? '→' : '☰';
    }
    
    // Initialize theme if not already done
    if (!document.documentElement.getAttribute('data-theme')) {
        initializeTheme();
    }
});

// Handle window resize
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        // On desktop, remove any mobile-specific classes
        document.body.classList.remove('sidebar-mobile-open');
    }
});

// Utility function to clear saved folder states (for debugging)
function clearFolderStates() {
    localStorage.removeItem('expandedFolders');
    console.log('Folder states cleared');
}

// Utility function to get current folder states (for debugging)
function getFolderStates() {
    const expandedFolders = JSON.parse(localStorage.getItem('expandedFolders') || '[]');
    console.log('Current expanded folders:', expandedFolders);
    return expandedFolders;
}
