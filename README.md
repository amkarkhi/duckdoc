# DuckDoc

DuckDoc is a Markdown document viewing and management application. It enables users to explore, view, and interact with markdown files stored in a structured directory (`content` folder). The application provides functionality such as a tree-view navbar, table of contents (TOC), and file search, making document navigation seamless and user-friendly.

## Features

1. **Tree View Navigation**:
   - Displays files and folders in a hierarchical structure on the left side.
   - Supports expand/collapse functionality for folders.

2. **Markdown Viewer**:
   - Renders markdown content in the main area.
   - Supports heading navigation via clickable TOC.

3. **Table of Contents (TOC)**:
   - Displays an overview of all headers and subheaders.
   - Sticky TOC on the right side for quick navigation.

4. **Search Functionality**:
   - Filters files and folders in the tree view based on user input.

## How to Run

1. Clone the repository:

   ```bash
   git clone <repository_url>
   ```

2. Navigate to the project directory:

   ```bash
   cd duckdoc
   ```

3. Run the application:

   ```bash
   go run main.go
   ```

4. Open your browser and navigate to:

   ```
   http://localhost:8080
   ```

## Directory Structure

```
/duckdoc
│
├── content/            # Folder containing markdown files
├── templates/          # HTML templates
├── static/             # Static files (CSS, JS, etc.)
├── main.go             # Application entry point
├── README.md           # Project documentation
└── ...
```

## Requirements

- Go programming language installed.

## Author

Developed by AMK.
