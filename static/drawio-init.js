// draw.io diagram rendering.
//
// The server routes .drawio/.dio files to templates/drawio.html, which leaves an
// empty #drawio-diagram carrying the source URL in data-src. This script fetches
// that XML, hands it to the vendored viewer (GraphViewer from
// drawio-viewer.min.js), builds a tab bar for multi-page files, and re-renders
// on light/dark theme flips.

(function () {
  var host = document.getElementById("drawio-diagram");
  if (!host) return;

  var tabs = document.getElementById("drawio-pages");
  var xml = null; // the raw <mxfile> document, fetched once
  var pageIndex = 0;

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function fail(message, detail) {
    host.className = "drawio-diagram drawio-error";
    host.textContent = "";
    var msg = document.createElement("div");
    msg.className = "drawio-error-msg";
    msg.textContent = message;
    host.appendChild(msg);
    if (detail) {
      var pre = document.createElement("pre");
      pre.textContent = detail;
      host.appendChild(pre);
    }
  }

  // Page names live on the <diagram> elements of an <mxfile>. A bare
  // <mxGraphModel> (a single-page export) has none, so this returns [].
  function pageNames(doc) {
    var diagrams = doc.getElementsByTagName("diagram");
    var names = [];
    for (var i = 0; i < diagrams.length; i++) {
      names.push(diagrams[i].getAttribute("name") || "Page-" + (i + 1));
    }
    return names;
  }

  function buildTabs(names) {
    if (!tabs) return;
    tabs.textContent = "";
    // A single page needs no tab bar — the filename in the navbar already says it.
    if (names.length < 2) return;
    names.forEach(function (name, i) {
      var btn = document.createElement("button");
      btn.className = "drawio-page" + (i === pageIndex ? " active" : "");
      btn.textContent = name;
      btn.addEventListener("click", function () {
        if (i === pageIndex) return;
        pageIndex = i;
        buildTabs(names);
        render();
      });
      tabs.appendChild(btn);
    });
  }

  function render() {
    if (!window.GraphViewer || !xml) return;

    host.textContent = "";
    // Diagrams carry their own colours — most are drawn black-on-white — so
    // inverting them for dark mode is unreliable. Instead the canvas keeps a
    // light surface and is marked so the stylesheet can frame it against the
    // dark page.
    host.className = "drawio-diagram" + (isDark() ? " drawio-dark-page" : "");

    // The viewer reads its configuration from a JSON blob rather than
    // arguments. lightbox:0 keeps it inline; resize:1 fits the container.
    var config = {
      highlight: "#3572b0",
      nav: true,
      resize: true,
      toolbar: "zoom layers lightbox",
      "toolbar-position": "inline",
      "toolbar-nohide": true,
      lightbox: false,
      page: pageIndex,
      xml: xml,
    };

    var mount = document.createElement("div");
    mount.className = "mxgraph";
    mount.style.maxWidth = "100%";
    mount.setAttribute("data-mxgraph", JSON.stringify(config));
    host.appendChild(mount);

    try {
      window.GraphViewer.processElements();
    } catch (err) {
      fail(
        "Diagram failed to render: " + (err && err.message ? err.message : err),
      );
    }
  }

  fetch(host.dataset.src, { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var doc = new DOMParser().parseFromString(text, "text/xml");
      if (doc.getElementsByTagName("parsererror").length) {
        throw new Error("the file is not valid XML");
      }
      xml = text;
      buildTabs(pageNames(doc));
      render();
    })
    .catch(function (err) {
      fail(
        "Could not load the diagram: " +
          (err && err.message ? err.message : err),
        host.dataset.src,
      );
    });

  // Re-render on theme flips so the diagram tracks the page.
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      if (muts[i].attributeName === "data-theme") {
        render();
        return;
      }
    }
  }).observe(document.documentElement, { attributes: true });
})();
