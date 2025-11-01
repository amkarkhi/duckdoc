# DuckDoc

DuckDoc is a comprehensive documentation viewing and management application. It enables users to explore, view, and interact with markdown files and Swagger/OpenAPI specifications stored in a structured directory (`content` folder). The application provides functionality such as a tree-view navbar, table of contents (TOC), interactive API documentation, and file search, making document navigation seamless and user-friendly.

## Features

1. **Tree View Navigation**:
   - Displays files and folders in a hierarchical structure on the left side.
   - Supports expand/collapse functionality for folders.

2. **Markdown Viewer**:
   - Renders markdown content in the main area.
   - Supports heading navigation via clickable TOC.

3. **Swagger/OpenAPI Documentation Viewer**:
   - Automatically detects and renders Swagger/OpenAPI specification files (`.yaml`, `.yml`).
   - Interactive API documentation with Swagger UI.
   - Try-it-out functionality for testing API endpoints.
   - Special icon (📋) for YAML files in the sidebar.

4. **Table of Contents (TOC)**:
   - Displays an overview of all headers and subheaders.
   - Sticky TOC on the right side for quick navigation.

5. **Search Functionality**:
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

## Requirements

- Go programming language installed.

## Author

Developed by AMK.
