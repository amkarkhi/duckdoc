package main

import (
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/russross/blackfriday/v2"
)

type TreeNode struct {
	Name         string
	Path         string
	Children     []*TreeNode
	CompletePath string // Stores the full path from the root to this node
}

type TOCItem struct {
	Level int
	Text  string
	ID    string
}

type PageData struct {
	Title       string
	Navbar      *TreeNode
	Content     template.HTML
	TOC         []TOCItem
	CurrentFile string
}

func main() {
	http.HandleFunc("/", serveMarkdown)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	http.Handle("/content/", http.StripPrefix("/content/", http.FileServer(http.Dir("content"))))

	port := ":8080"
	log.Printf("Server started on http://localhost%s", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal(err)
	}
}

func serveMarkdown(w http.ResponseWriter, r *http.Request) {
	dir := "content"
	navbarTree := &TreeNode{Name: "root", Path: "", Children: []*TreeNode{}}

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		ext := filepath.Ext(path)
		if ext == ".md" || ext == ".yaml" || ext == ".yml" {
			relPath, _ := filepath.Rel(dir, path)
			log.Printf("Processing file: %s", relPath)

			// Ensure each file node has a full path
			parts := strings.Split(filepath.ToSlash(relPath), "/")
			current := navbarTree
			var fullPath string
			for i, part := range parts {
				var parentPath string
				parentPath = current.CompletePath
				fullPath = parentPath
				found := false
				for _, child := range current.Children {
					if child.Name == part {
						current = child
						current.CompletePath = filepath.Join(current.CompletePath, part)
						found = true
						break
					}
				}
				if !found {
					var nodePath string
					if i == len(parts)-1 {
						// This is a file, use the relative path from content directory
						nodePath = "/" + relPath
					} else {
						// This is a directory, store the partial path for search purposes
						folderPath := strings.Join(parts[:i+1], "/")
						nodePath = "/" + folderPath
						fullPath = filepath.Join(parentPath, part)
						log.Printf("Setting fullPath: %s", fullPath)
					}
					newNode := &TreeNode{Name: part, Path: nodePath, Children: []*TreeNode{}, CompletePath: fullPath}
					current.Children = append(current.Children, newNode)
					current = newNode
					current.CompletePath = filepath.Join(current.CompletePath, part)
					log.Printf("Added node: %s with path: %s", part, nodePath)
				}
			}
		}
		return nil
	})
	if err != nil {
		log.Printf("Error walking the directory: %v", err)
		http.Error(w, "Error reading content", http.StatusInternalServerError)
		return
	}

	// Get the search query from the request
	searchQuery := r.URL.Query().Get("search")

	// Filter the document tree if a search query is present
	if searchQuery != "" {
		filterTree(navbarTree, searchQuery)
	}

	// Get the requested file path from the URL
	requestedPath := r.URL.Path
	var content string
	var relPath string
	var isSwagger bool

	if requestedPath == "/" {
		// Home page - render README.md from root folder
		readmePath := "README.md"
		if contentBytes, err := os.ReadFile(readmePath); err == nil {
			content = string(contentBytes)
			relPath = "README.md"
		} else {
			content = "# Welcome to DuckDoc\n\nThe README file could not be found."
			relPath = "README.md"
		}
	} else {
		// Remove leading slash and construct full path
		relPath = strings.TrimPrefix(requestedPath, "/")
		contentPath := filepath.Join(dir, relPath)

		if contentBytes, err := os.ReadFile(contentPath); err == nil {
			content = string(contentBytes)
			// Check if this is a Swagger/OpenAPI file
			ext := filepath.Ext(relPath)
			if ext == ".yaml" || ext == ".yml" {
				// Check if it's a Swagger file by looking for 'openapi' or 'swagger' at the start
				if strings.HasPrefix(strings.TrimSpace(content), "openapi:") || strings.HasPrefix(strings.TrimSpace(content), "swagger:") {
					isSwagger = true
				}
			}
		} else {
			// If file not found, show default content
			content = "# File not found\n\nThe requested file could not be found."
		}
	}

	// Handle Swagger files differently
	if isSwagger {
		renderSwagger(w, relPath, navbarTree)
		return
	}

	log.Printf("Content being passed to extractTOC: %s", content)
	toc := extractTOC(content)

	// Process content to fix image paths
	processedContent := processImagePaths(content, relPath)
	htmlContent := template.HTML(blackfriday.Run([]byte(processedContent), blackfriday.WithExtensions(blackfriday.CommonExtensions|blackfriday.AutoHeadingIDs)))
	tmpl, err := template.New("layout").Funcs(template.FuncMap{
		"defineTree": func(node *TreeNode) template.HTML {
			log.Printf("defineTree called with node: %+v", node)
			var renderTree func(*TreeNode) string
			renderTree = func(node *TreeNode) string {
				output := ""
				if node != nil {
					if node.Name == "root" {
						log.Printf("Root node has %d children", len(node.Children))
						// For root node, render all children directly
						for _, child := range node.Children {
							output += renderTree(child)
						}
					} else {
						if len(node.Children) > 0 {
							output += "<li class=\"folder\" data-full-path=\"" + node.CompletePath + "\"><span class=\"folder-name\">" + node.Name + "</span><ul>"
							for _, child := range node.Children {
								output += renderTree(child)
							}
							output += "</ul></li>"
						} else {
							output += "<li class=\"file\" data-full-path=\"" + node.CompletePath + "\"><a href=\"" + node.Path + "\">" + node.Name + "</a></li>"
						}
					}
				}
				return output
			}
			result := renderTree(node)
			log.Printf("Generated tree HTML: %s", result)
			return template.HTML(result)
		},
	}).ParseFiles("templates/layout.html", "templates/sidebar.html")
	if err != nil {
		log.Printf("Template parsing error: %v", err)
		http.Error(w, "Error loading templates", http.StatusInternalServerError)
		return
	}

	page := PageData{
		Title:       "Markdown Viewer",
		Navbar:      navbarTree,
		Content:     htmlContent,
		TOC:         toc,
		CurrentFile: relPath,
	}

	log.Printf("About to execute template with navbar tree: %+v", navbarTree)
	if err := tmpl.Execute(w, page); err != nil {
		log.Printf("Template execution error: %v", err)
		http.Error(w, "Error rendering page", http.StatusInternalServerError)
	}
}

// Function to extract table of contents (headers) from markdown
func extractTOC(content string) []TOCItem {
	var toc []TOCItem
	lines := strings.Split(content, "\n")
	headerRegex := regexp.MustCompile(`^(#{1,6})\s+(.*)`)
	for _, line := range lines {
		if matches := headerRegex.FindStringSubmatch(line); matches != nil {
			headingLevel := len(matches[1])
			headingText := matches[2]
			headingID := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(headingText, ".", "-"), " ", "-"), "#", ""))
			toc = append(toc, TOCItem{Level: headingLevel, Text: headingText, ID: headingID})
		}
	}
	return toc
}

// Helper function to filter the tree based on the search query
func filterTree(node *TreeNode, query string) bool {
	matches := false
	log.Println("DEBUG: filterTree called for node:", node.Name, ", with query:", query)

	// Check if current node (folder or file) matches the query
	nodeMatches := matchesQuery(node.Name, node.CompletePath, query)
	log.Println("Checking node:", node.Name, "Matches:", nodeMatches, "Query:", query)
	if nodeMatches {
		matches = true
	}

	// Always filter children recursively, even if current node matches
	// This allows us to find nested matches and show full context
	filteredChildren := []*TreeNode{}
	for _, child := range node.Children {
		if filterTree(child, query) {
			filteredChildren = append(filteredChildren, child)
			matches = true
		}
	}

	// If this node matches, we want to show it and its filtered children
	// If this node doesn't match but has matching children, we still show it as context
	node.Children = filteredChildren

	return matches
}

// Helper function to check if a string matches the query
func matchesQuery(name, completePath, query string) bool {
	queryLower := strings.ToLower(query)

	// Check if the name matches
	if strings.Contains(strings.ToLower(name), queryLower) {
		log.Println("DEBUG: matchesQuery found match in name:", name)
		return true
	}

	// Check if the complete path matches (for folders and files)
	if strings.Contains(strings.ToLower(completePath), queryLower) {
		log.Println("DEBUG: matchesQuery found match in completePath:", completePath)
		return true
	}

	return false
}

// processImagePaths processes markdown content to fix relative image paths
func processImagePaths(content, relPath string) string {
	// Regular expression to match markdown image syntax: ![alt](path)
	imageRegex := regexp.MustCompile(`!\[([^\]]*)\]\(([^)]+)\)`)

	// Get the directory of the current file
	var baseDir string
	if relPath == "README.md" {
		// For README.md in root, images should be looked up relative to content directory
		baseDir = "content"
	} else {
		// For other files, get the directory of the current file
		baseDir = filepath.Dir(relPath)
		if baseDir == "." {
			baseDir = ""
		}
	}

	// Process the content and replace image paths
	processedContent := imageRegex.ReplaceAllStringFunc(content, func(match string) string {
		// Extract the alt text and image path
		matches := imageRegex.FindStringSubmatch(match)
		if len(matches) != 3 {
			return match // Return original if parsing fails
		}

		altText := matches[1]
		imagePath := matches[2]

		// Skip if it's already an absolute URL or starts with /
		if strings.HasPrefix(imagePath, "http://") || strings.HasPrefix(imagePath, "https://") || strings.HasPrefix(imagePath, "/") {
			return match
		}

		// Handle relative paths
		var newPath string
		if after, ok := strings.CutPrefix(imagePath, "./"); ok {
			// Remove ./ prefix
			imagePath = after

			if relPath == "README.md" {
				// For README.md, images are in the content directory
				newPath = "/content/" + imagePath
			} else {
				// For other files, resolve relative to the file's directory
				if baseDir == "" {
					newPath = "/content/" + imagePath
				} else {
					newPath = "/content/" + baseDir + "/" + imagePath
				}
			}
		} else {
			// Handle paths without ./ prefix
			if relPath == "README.md" {
				newPath = "/content/" + imagePath
			} else {
				if baseDir == "" {
					newPath = "/content/" + imagePath
				} else {
					newPath = "/content/" + baseDir + "/" + imagePath
				}
			}
		}

		log.Printf("Converted image path: %s -> %s (relPath: %s, baseDir: %s)", imagePath, newPath, relPath, baseDir)
		log.Printf("Debug: Updated image tag: ![%s](%s)", altText, newPath)
		return "![" + altText + "](" + newPath + ")"
	})

	log.Printf("Debug: Finished processing content for relPath: %s\nProcessed Content:\n%s", relPath, processedContent)
	return processedContent
}

// renderSwagger renders a Swagger/OpenAPI specification file
func renderSwagger(w http.ResponseWriter, relPath string, navbarTree *TreeNode) {
	tmpl, err := template.New("layout").Funcs(template.FuncMap{
		"defineTree": func(node *TreeNode) template.HTML {
			var renderTree func(*TreeNode) string
			renderTree = func(node *TreeNode) string {
				output := ""
				if node != nil {
					if node.Name == "root" {
						// For root node, render all children directly
						for _, child := range node.Children {
							output += renderTree(child)
						}
					} else {
						if len(node.Children) > 0 {
							output += "<li class=\"folder\" data-full-path=\"" + node.CompletePath + "\"><span class=\"folder-name\">" + node.Name + "</span><ul>"
							for _, child := range node.Children {
								output += renderTree(child)
							}
							output += "</ul></li>"
						} else {
							output += "<li class=\"file\" data-full-path=\"" + node.CompletePath + "\"><a href=\"" + node.Path + "\">" + node.Name + "</a></li>"
						}
					}
				}
				return output
			}
			return template.HTML(renderTree(node))
		},
	}).ParseFiles("templates/layout.html", "templates/sidebar.html", "templates/swagger.html")
	if err != nil {
		log.Printf("Template parsing error: %v", err)
		http.Error(w, "Error loading templates", http.StatusInternalServerError)
		return
	}

	page := PageData{
		Title:       "API Documentation",
		Navbar:      navbarTree,
		Content:     template.HTML(""), // Content will be rendered by Swagger UI
		TOC:         []TOCItem{},
		CurrentFile: relPath,
	}

	if err := tmpl.Execute(w, page); err != nil {
		log.Printf("Template execution error: %v", err)
		http.Error(w, "Error rendering page", http.StatusInternalServerError)
	}
}
