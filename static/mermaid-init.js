// Mermaid diagram rendering.
//
// The server turns both ```mermaid fences and standalone .mmd files into
// <pre class="mermaid"> elements (see promoteMermaidBlocks in main.go). This
// script renders them, keeps them in sync with the light/dark theme toggle,
// and shows the raw source if a diagram fails to parse.

(function () {
  // The vendored bundle assigns globalThis.mermaid on load.
  var mermaid = window.mermaid;
  if (!mermaid) return;

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "default";
  }

  function init() {
    mermaid.initialize({
      startOnLoad: false,
      theme: currentTheme(),
      securityLevel: "strict",
      fontFamily: "inherit",
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true },
    });
  }

  // Stash the original source on first sight. mermaid replaces the element's
  // innerHTML with SVG, so re-rendering on theme change needs the source back.
  function sources() {
    var blocks = document.querySelectorAll("pre.mermaid, pre.mermaid-rendered");
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (el.dataset.src === undefined) el.dataset.src = el.textContent;
    }
    return blocks;
  }

  async function render() {
    var blocks = sources();
    if (!blocks.length) return;

    init();

    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      var src = el.dataset.src || "";
      if (!src.trim()) continue;

      // Reset to a pristine, mermaid-processable state.
      el.className = "mermaid";
      el.removeAttribute("data-processed");
      el.textContent = src;

      try {
        var id = "mmd-" + i + "-" + Math.random().toString(36).slice(2, 8);
        var out = await mermaid.render(id, src);
        el.innerHTML = out.svg;
        if (out.bindFunctions) out.bindFunctions(el);
        el.className = "mermaid-rendered";
      } catch (err) {
        // Fall back to readable source rather than a blank box.
        el.className = "mermaid-error";
        var msg = document.createElement("div");
        msg.className = "mermaid-error-msg";
        msg.textContent = "Diagram failed to render: " + (err && err.message ? err.message : err);
        var pre = document.createElement("pre");
        pre.textContent = src;
        el.textContent = "";
        el.appendChild(msg);
        el.appendChild(pre);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  // Re-render on theme flips so diagram colours track the page.
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      if (muts[i].attributeName === "data-theme") {
        render();
        return;
      }
    }
  }).observe(document.documentElement, { attributes: true });
})();
