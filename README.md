# DuckDoc

DuckDoc is a comprehensive documentation viewing and management application. It enables users to explore, view, and interact with markdown files and Swagger/OpenAPI specifications stored in a structured directory (`content` folder). The application provides functionality such as a tree-view navbar, table of contents (TOC), interactive API documentation, and file search, making document navigation seamless and user-friendly.

## Features

1. **Tree View Navigation**:
   - Displays files and folders in a hierarchical structure on the left side.
   - Supports expand/collapse functionality for folders.

2. **Markdown Viewer**:
   - Renders markdown content in the main area.
   - Supports heading navigation via clickable TOC.
   - Mermaid diagram support for visualizations.

3. **Swagger/OpenAPI Documentation Viewer**:
   - Automatically detects and renders Swagger/OpenAPI specification files (`.yaml`, `.yml`).
   - Interactive API documentation with Swagger UI.
   - Try-it-out functionality for testing API endpoints.
   - Special icon (📋) for YAML files in the sidebar.

4. **Table of Contents (TOC)**:
   - Displays an overview of all headers and subheaders.
   - Sticky TOC on the right side for quick navigation.

5. **Global Full-Text Search** ✨ *NEW*:
   - Search across all documentation files instantly.
   - Fuzzy matching on filename and content.
   - Live results as you type.
   - **Keyboard shortcut**: `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to search from anywhere.
   - RESTful API: `GET /api/search?q=query`

6. **Breadcrumb Navigation** ✨ *NEW*:
   - Shows your location in the documentation hierarchy.
   - Clickable breadcrumbs to jump to parent folders.
   - Auto-generated from file path.

7. **Beautiful Design** ✨ *NEW*:
   - Warm, professional color palette (#FCFBF9 background, #A8563C accent).
   - Dark mode support with inverted warm palette.
   - Inspired by Markdown Reader for optimal reading experience.
   - Responsive design for mobile, tablet, and desktop.

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

## Using Swagger/OpenAPI Files

DuckDoc automatically detects and renders OpenAPI/Swagger specification files. Simply place your `.yaml` or `.yml` files in the `content` directory with the following structure:

```yaml
openapi: 3.0.0
info:
  title: Your API
  version: 1.0.0
paths:
  # Your API paths here
```

The file will be automatically detected and rendered with an interactive Swagger UI interface. Features include:

- **Interactive Documentation**: Browse all API endpoints with detailed descriptions
- **Request/Response Examples**: View example payloads and responses
- **Try It Out**: Test API endpoints directly from the documentation
- **Model Schemas**: Explore data models and their properties
- **Server Selection**: Switch between different API environments (production, staging, etc.)

Example Swagger files can be found in `content/search-gateway/doc/swagger.yaml`.

## New Features (v2.0)

### Full-Text Search API

- **Endpoint**: `GET /api/search?q=<query>`
- **Behavior**: Indexes all `.md` and `.mmd` files on startup, enables instant search
- **Usage**: Type in the navbar search bar or press `Cmd+K` / `Ctrl+K` to focus search
- **Response**: JSON array with `path`, `name`, and `preview` for up to 20 results

```bash
# Example API call
curl 'http://localhost:8080/api/search?q=api'
```

### Breadcrumb Navigation

- Auto-generated from file path
- Appears below navbar on every page (except home)
- Clickable links to navigate to parent folders
- Example: `Home / atlas / docs / README`

### Design System

- **Color Palette**: Warm, earthy tones inspired by Markdown Reader
  - Primary background: #FCFBF9
  - Accent: #A8563C (warm brown/rust)
  - Text: #171614 (nearly black)
- **Dark Mode**: Automatically inverts palette while maintaining readability
- **Responsive**: Adapts to mobile, tablet, and desktop screens

## Requirements

- Go programming language installed.

## Recent Changes

- ✨ Added full-text search across all documentation
- ✨ Added breadcrumb navigation for context
- 🎨 Updated design palette to warm, professional theme
- ⌨️ Added Cmd+K / Ctrl+K search shortcut
- 📱 Improved responsive design

## Author

Developed by AMK and enhanced with search, breadcrumbs, and design improvements.

