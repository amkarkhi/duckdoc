document.addEventListener("DOMContentLoaded", () => {
  const toggleSubmenu = (event) => {
    const parent = event.target.parentElement;
    parent.classList.toggle("expanded");
  };

  document.querySelectorAll(".tree-menu .folder-name").forEach((folder) => {
    folder.addEventListener("click", toggleSubmenu);
  });

  // Expand all matching folders for better visibility
  const searchedFolders = document.querySelectorAll(".tree-menu .folder-name");
  searchedFolders.forEach((folder) => {
    const parent = folder.parentElement;
    if (parent.style.display !== "none") {
      parent.classList.add("expanded");
    }
  });

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
    // Show all items when no search query
    treeItems.forEach((item) => {
      item.style.display = "block";
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
    body.classList.toggle('sidebar-collapsed');
    
    // Store the sidebar state in localStorage
    const isCollapsed = body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);
}

// Initialize sidebar state from localStorage
document.addEventListener('DOMContentLoaded', function() {
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
    }
});

// Handle window resize
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        // On desktop, remove any mobile-specific classes
        document.body.classList.remove('sidebar-mobile-open');
    }
});
