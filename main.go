package main

import (
	"fmt"
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
	CompletePath string
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
	BasePath    string
}

// templateFuncs is populated at request time to carry currentFile for active-state highlighting
func makeTemplateFuncs(currentFile string) template.FuncMap {
	return template.FuncMap{
		"defineTree": func(node *TreeNode) template.HTML {
			return template.HTML(renderTreeHTML(node, currentFile))
		},
	}
}

var contentDir = func() string {
	if d := os.Getenv("CONTENT_DIR"); d != "" {
		return d
	}
	return "content"
}()

// basePath is the URL prefix the app is mounted under when served from a
// sub-path of a shared host (e.g. BASE_PATH=/duckdoc behind an ingress rule
// for bigdataservices.digikala.com/duckdoc). It is normalised to either ""
// (mounted at the root) or "/segment" with no trailing slash.
var basePath = func() string {
	p := strings.TrimSpace(os.Getenv("BASE_PATH"))
	p = strings.Trim(p, "/")
	if p == "" {
		return ""
	}
	return "/" + p
}()

// url joins basePath with an absolute in-app path ("/static/styles.css").
func url(p string) string {
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	if basePath == "" {
		return p
	}
	if p == "/" {
		return basePath + "/"
	}
	return basePath + p
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/", serveMarkdown)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	mux.Handle("/content/", http.StripPrefix("/content/", http.FileServer(http.Dir(contentDir))))

	var handler http.Handler = mux
	if basePath != "" {
		// Serve every route under basePath, and redirect a bare "/duckdoc" to
		// "/duckdoc/" so StripPrefix sees a leading slash on the remainder.
		root := http.NewServeMux()
		root.Handle(basePath+"/", http.StripPrefix(basePath, mux))
		root.Handle(basePath, http.RedirectHandler(basePath+"/", http.StatusMovedPermanently))
		// Keep the app reachable at the root too, for the dedicated host
		// (duckdoc.bigdata.digikala.com) that routes "/" to the same service.
		root.Handle("/", mux)
		handler = root
	}

	port := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		port = ":" + strings.TrimPrefix(p, ":")
	}
	log.Printf("Server started on http://localhost%s%s", port, basePath)
	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatal(err)
	}
}

func serveMarkdown(w http.ResponseWriter, r *http.Request) {
	navbarTree, err := buildNavTree(contentDir)
	if err != nil {
		log.Printf("Error building nav tree: %v", err)
		http.Error(w, "Error reading content", http.StatusInternalServerError)
		return
	}

	if q := r.URL.Query().Get("search"); q != "" {
		filterTree(navbarTree, q)
	}

	requestedPath := r.URL.Path
	var content, relPath string
	var isSwagger bool

	if requestedPath == "/" {
		relPath = "README.md"
		if b, err := os.ReadFile("README.md"); err == nil {
			content = string(b)
		} else {
			content = "# Welcome to DuckDoc\n\nThe README file could not be found."
		}
	} else {
		relPath = strings.TrimPrefix(requestedPath, "/")
		if b, err := os.ReadFile(filepath.Join(contentDir, relPath)); err == nil {
			content = string(b)
			ext := filepath.Ext(relPath)
			if ext == ".yaml" || ext == ".yml" {
				trimmed := strings.TrimSpace(content)
				if strings.HasPrefix(trimmed, "openapi:") || strings.HasPrefix(trimmed, "swagger:") {
					isSwagger = true
				}
			}
			if ext == ".mmd" || ext == ".mermaid" {
				// A .mmd file is raw diagram source, not markdown. Wrap it in a
				// mermaid fence so it flows through the normal render path and
				// gets picked up client-side like an inline ```mermaid block.
				content = wrapMermaidSource(relPath, content)
			}
		} else {
			content = "# File not found\n\nThe requested file could not be found."
		}
	}

	funcs := makeTemplateFuncs(relPath)

	if isSwagger {
		renderSwagger(w, relPath, navbarTree, funcs)
		return
	}

	toc := extractTOC(content)
	processed := processImagePaths(content, relPath)
	rendered := blackfriday.Run([]byte(processed), blackfriday.WithExtensions(blackfriday.CommonExtensions|blackfriday.AutoHeadingIDs))
	htmlContent := template.HTML(promoteMermaidBlocks(string(rendered)))

	tmpl, err := template.New("layout").Funcs(funcs).ParseFiles("templates/layout.html", "templates/sidebar.html")
	if err != nil {
		log.Printf("Template parsing error: %v", err)
		http.Error(w, "Error loading templates", http.StatusInternalServerError)
		return
	}

	page := PageData{
		Title:       "DuckDoc",
		Navbar:      navbarTree,
		Content:     htmlContent,
		TOC:         toc,
		CurrentFile: relPath,
		BasePath:    basePath,
	}

	if err := tmpl.Execute(w, page); err != nil {
		log.Printf("Template execution error: %v", err)
	}
}

func buildNavTree(dir string) (*TreeNode, error) {
	root := &TreeNode{Name: "root", Path: "", Children: []*TreeNode{}}

	// EvalSymlinks resolves the git-sync symlink (/gitdocs/content -> /gitdocs/<sha>/)
	// so filepath.Walk can descend into the actual directory.
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil {
		// dir not yet created (git-sync still cloning) — return empty tree, not an error
		if os.IsNotExist(err) {
			return root, nil
		}
		return nil, err
	}

	err = filepath.Walk(resolved, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if !docExtensions[filepath.Ext(path)] {
			return nil
		}

		relPath, err := filepath.Rel(resolved, path)
		if err != nil {
			return err
		}

		parts := strings.Split(filepath.ToSlash(relPath), "/")
		current := root
		for i, part := range parts {
			found := false
			for _, child := range current.Children {
				if child.Name == part {
					current = child
					found = true
					break
				}
			}
			if !found {
				var nodePath string
				if i == len(parts)-1 {
					nodePath = "/" + relPath
				} else {
					nodePath = "/" + strings.Join(parts[:i+1], "/")
				}
				completePath := strings.Join(parts[:i+1], "/")
				newNode := &TreeNode{
					Name:         part,
					Path:         nodePath,
					Children:     []*TreeNode{},
					CompletePath: completePath,
				}
				current.Children = append(current.Children, newNode)
				current = newNode
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	collapseChains(root)
	return root, nil
}

// collapseChains merges folder nodes that have exactly one child folder into one label.
// e.g. "atlas / docs" with only folder children becomes "atlas/docs"
func collapseChains(node *TreeNode) {
	for _, child := range node.Children {
		collapseChains(child)
	}

	for i, child := range node.Children {
		// Only collapse if the child is a pure folder (no file children) with exactly one child
		for len(child.Children) == 1 && len(child.Children[0].Children) > 0 {
			only := child.Children[0]
			child.Name = child.Name + " / " + only.Name
			child.Path = only.Path
			child.CompletePath = only.CompletePath
			child.Children = only.Children
		}
		node.Children[i] = child
	}
}

// docExtensions are the file types that appear in the sidebar and can be
// rendered as a page.
var docExtensions = map[string]bool{
	".md": true, ".yaml": true, ".yml": true, ".mmd": true, ".mermaid": true,
}

// wrapMermaidSource turns a standalone diagram file into a markdown document
// containing a single mermaid fence, titled after the file. Any existing fence
// markers are stripped first so a .mmd that already wraps itself in
// ```mermaid does not end up double-fenced.
func wrapMermaidSource(relPath, source string) string {
	var lines []string
	for _, line := range strings.Split(source, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			continue
		}
		lines = append(lines, line)
	}
	body := strings.Trim(strings.Join(lines, "\n"), "\n")
	title := displayName(filepath.Base(relPath))
	return "# " + title + "\n\n```mermaid\n" + body + "\n```\n"
}

// displayName strips the file extension for cleaner sidebar labels
func displayName(name string) string {
	if ext := filepath.Ext(name); docExtensions[ext] {
		return strings.TrimSuffix(name, ext)
	}
	return name
}

func renderTreeHTML(node *TreeNode, currentFile string) string {
	if node == nil {
		return ""
	}
	if node.Name == "root" {
		var sb strings.Builder
		for _, child := range node.Children {
			sb.WriteString(renderTreeHTML(child, currentFile))
		}
		return sb.String()
	}

	fullPath := template.HTMLEscapeString(node.CompletePath)
	name := template.HTMLEscapeString(displayName(node.Name))

	if len(node.Children) > 0 {
		// Check if any descendant is the active file to pre-expand the folder
		active := containsFile(node, currentFile)
		activeClass := ""
		if active {
			activeClass = " active-ancestor"
		}
		var sb strings.Builder
		fmt.Fprintf(&sb, `<li class="folder%s" data-full-path="%s"><span class="folder-name">%s</span><ul>`, activeClass, fullPath, name)
		for _, child := range node.Children {
			sb.WriteString(renderTreeHTML(child, currentFile))
		}
		sb.WriteString("</ul></li>")
		return sb.String()
	}

	path := template.HTMLEscapeString(url(node.Path))
	isActive := strings.TrimPrefix(node.Path, "/") == currentFile
	activeClass := ""
	if isActive {
		activeClass = ` class="active"`
	}
	return fmt.Sprintf(`<li class="file" data-full-path="%s"><a href="%s"%s>%s</a></li>`, fullPath, path, activeClass, name)
}

// containsFile reports whether any file descendant matches currentFile
func containsFile(node *TreeNode, currentFile string) bool {
	if len(node.Children) == 0 {
		return strings.TrimPrefix(node.Path, "/") == currentFile
	}
	for _, child := range node.Children {
		if containsFile(child, currentFile) {
			return true
		}
	}
	return false
}

// mermaidBlockRegex matches the <pre><code class="language-mermaid">…</code></pre>
// that blackfriday emits for a ```mermaid fence. (?s) lets . span newlines and
// the body capture is lazy so consecutive diagrams stay separate.
var mermaidBlockRegex = regexp.MustCompile(`(?s)<pre><code class="language-mermaid">(.*?)</code></pre>`)

// promoteMermaidBlocks rewrites fenced mermaid code blocks into the
// <pre class="mermaid"> element mermaid-init.js renders. The body is left
// HTML-escaped on purpose: mermaid reads textContent, which decodes entities
// back to the original source, so "-->" and "<br/>" survive intact.
func promoteMermaidBlocks(html string) string {
	return mermaidBlockRegex.ReplaceAllString(html, `<pre class="mermaid">$1</pre>`)
}

// stripInlineMarkdown removes inline backtick spans, keeping the inner text,
// so that "`foo`" becomes "foo" — matching blackfriday's AutoHeadingIDs behaviour.
var backtickRegex = regexp.MustCompile("`[^`]*`")

// nonAlphanumHyphen matches anything that is not a lowercase letter, digit, or hyphen.
var nonAlphanumHyphen = regexp.MustCompile(`[^a-z0-9-]+`)

func headingToID(text string) string {
	// 1. Strip inline code backticks but keep inner text.
	id := backtickRegex.ReplaceAllStringFunc(text, func(s string) string {
		return s[1 : len(s)-1]
	})
	// 2. Lowercase.
	id = strings.ToLower(id)
	// 3. Replace spaces and word-separating punctuation with hyphens so that
	//    "ci.yml" → "ci-yml" (matching blackfriday's slugifier).
	id = strings.ReplaceAll(id, " ", "-")
	id = strings.ReplaceAll(id, ".", "-")
	// 4. Remove every remaining character that is not [a-z0-9-].
	id = nonAlphanumHyphen.ReplaceAllString(id, "")
	// 5. Collapse consecutive hyphens produced by the steps above.
	id = regexp.MustCompile(`-{2,}`).ReplaceAllString(id, "-")
	// 6. Trim leading/trailing hyphens.
	id = strings.Trim(id, "-")
	return id
}

func extractTOC(content string) []TOCItem {
	var toc []TOCItem
	headerRegex := regexp.MustCompile(`^(#{1,6})\s+(.*)`)
	for _, line := range strings.Split(content, "\n") {
		if m := headerRegex.FindStringSubmatch(line); m != nil {
			text := m[2]
			toc = append(toc, TOCItem{Level: len(m[1]), Text: text, ID: headingToID(text)})
		}
	}
	return toc
}

func filterTree(node *TreeNode, query string) bool {
	nodeMatches := matchesQuery(node.Name, node.CompletePath, query)

	var matched []*TreeNode
	for _, child := range node.Children {
		if filterTree(child, query) {
			matched = append(matched, child)
		}
	}
	node.Children = matched

	return nodeMatches || len(matched) > 0
}

func matchesQuery(name, completePath, query string) bool {
	q := strings.ToLower(query)
	return strings.Contains(strings.ToLower(name), q) ||
		strings.Contains(strings.ToLower(completePath), q)
}

func processImagePaths(content, relPath string) string {
	imageRegex := regexp.MustCompile(`!\[([^\]]*)\]\(([^)]+)\)`)

	var baseDir string
	if relPath == "README.md" {
		baseDir = "content"
	} else {
		baseDir = filepath.Dir(relPath)
		if baseDir == "." {
			baseDir = ""
		}
	}

	return imageRegex.ReplaceAllStringFunc(content, func(match string) string {
		m := imageRegex.FindStringSubmatch(match)
		if len(m) != 3 {
			return match
		}
		altText, imagePath := m[1], m[2]

		if strings.HasPrefix(imagePath, "http://") ||
			strings.HasPrefix(imagePath, "https://") ||
			strings.HasPrefix(imagePath, "/") {
			return match
		}

		imagePath = strings.TrimPrefix(imagePath, "./")

		var newPath string
		if baseDir == "" || relPath == "README.md" {
			newPath = url("/content/" + imagePath)
		} else {
			newPath = url("/content/" + baseDir + "/" + imagePath)
		}

		return "![" + altText + "](" + newPath + ")"
	})
}

func renderSwagger(w http.ResponseWriter, relPath string, navbarTree *TreeNode, funcs template.FuncMap) {
	tmpl, err := template.New("layout").Funcs(funcs).ParseFiles("templates/layout.html", "templates/sidebar.html", "templates/swagger.html")
	if err != nil {
		log.Printf("Template parsing error: %v", err)
		http.Error(w, "Error loading templates", http.StatusInternalServerError)
		return
	}

	page := PageData{
		Title:       "API Documentation",
		Navbar:      navbarTree,
		Content:     "",
		TOC:         []TOCItem{},
		CurrentFile: relPath,
		BasePath:    basePath,
	}

	if err := tmpl.Execute(w, page); err != nil {
		log.Printf("Template execution error: %v", err)
	}
}
