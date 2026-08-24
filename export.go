package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/russross/blackfriday/v2"
)

func isValidPath(p string) bool {
	abs, err := filepath.Abs(p)
	if err != nil {
		return false
	}
	contentAbs, err := filepath.Abs(contentDir)
	if err != nil {
		return false
	}
	return strings.HasPrefix(abs, contentAbs)
}

func apiExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := r.URL.Query().Get("file")
	format := r.URL.Query().Get("format")
	if path == "" || format == "" {
		http.Error(w, "Missing file or format parameter", http.StatusBadRequest)
		return
	}

	if format != "markdown" && format != "html" {
		http.Error(w, "Unsupported format. Supported: markdown, html", http.StatusBadRequest)
		return
	}

	path = strings.TrimPrefix(path, "/")
	var content string

	if path == "README.md" || path == "" || path == "/" {
		if b, err := os.ReadFile("README.md"); err == nil {
			content = string(b)
		} else {
			http.Error(w, "README not found", http.StatusNotFound)
			return
		}
	} else {
		filePath := filepath.Join(contentDir, path)
		if !isValidPath(filePath) {
			http.Error(w, "Invalid file path", http.StatusBadRequest)
			return
		}
		b, err := os.ReadFile(filePath)
		if err != nil {
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}
		content = string(b)
	}

	filename := filepath.Base(path)
	if filename == "" {
		filename = "readme"
	}

	if format == "markdown" {
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		w.Write([]byte(content))
		return
	}

	if format == "html" {
		processed := processImagePaths(content, path)
		rendered := blackfriday.Run([]byte(processed), blackfriday.WithExtensions(blackfriday.CommonExtensions|blackfriday.AutoHeadingIDs))
		htmlContent := promoteMermaidBlocks(string(rendered))

		htmlDoc := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>%s</title>
	<style>
		* { box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			line-height: 1.6;
			color: #1a1a1a;
			background: #fafbfc;
			margin: 0;
			padding: 20px;
			max-width: 900px;
			margin: 0 auto;
		}
		h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
		h1 { font-size: 2em; }
		h2 { font-size: 1.5em; }
		h3 { font-size: 1.25em; }
		code {
			background: #ebebf0;
			padding: 2px 6px;
			border-radius: 4px;
			font-family: "Space Mono", monospace;
			font-size: 0.9em;
		}
		pre {
			background: #ebebf0;
			padding: 16px;
			border-radius: 8px;
			overflow-x: auto;
		}
		pre code {
			background: none;
			padding: 0;
			border-radius: 0;
		}
		a { color: #ee5a24; text-decoration: none; }
		a:hover { text-decoration: underline; }
		blockquote {
			border-left: 4px solid #ee5a24;
			padding-left: 16px;
			color: #404040;
			margin: 1em 0;
		}
		table {
			border-collapse: collapse;
			width: 100%;
			margin: 1em 0;
		}
		th, td {
			border: 1px solid #e0e0e0;
			padding: 8px 12px;
			text-align: left;
		}
		th {
			background: #f3f4f6;
			font-weight: 600;
		}
		img { max-width: 100%; height: auto; }
		.mermaid { background: white; padding: 16px; border-radius: 8px; }
		@media print {
			body { background: white; }
		}
	</style>
	<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
	<script>mermaid.initialize({ startOnLoad: true });</script>
</head>
<body>
	%s
</body>
</html>`, filename, htmlContent)

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.html"`, strings.TrimSuffix(filename, filepath.Ext(filename))))
		w.Write([]byte(htmlDoc))
		return
	}
}
