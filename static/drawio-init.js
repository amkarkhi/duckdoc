// draw.io diagram rendering.
//
// The server routes .drawio/.dio files to templates/drawio.html, which leaves an
// empty #drawio-diagram carrying the source URL in data-src. This script fetches
// that XML, hands it to the vendored viewer (GraphViewer from
// drawio-viewer.min.js), and wraps it in our own chrome: page tabs, zoom / fit /
// fullscreen controls, drag-to-pan, and keyboard shortcuts.
//
// We drive the viewer through createViewerForElement rather than
// processElements, because only the former hands back the GraphViewer instance —
// and without that instance there is no way to zoom or fit from our own toolbar.

(function () {
  var host = document.getElementById("drawio-diagram");
  if (!host) return;

  var stage = document.getElementById("drawio-stage");
  var tabs = document.getElementById("drawio-pages");
  var selectWrap = document.getElementById("drawio-pages-select-wrap");
  var select = document.getElementById("drawio-pages-select");
  var zoomLabel = document.getElementById("drawio-zoom-reset");

  var xml = null; // the raw <mxfile> document, fetched once
  var pageIndex = 0;
  var viewer = null; // current GraphViewer instance
  var names = [];

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function graph() {
    return viewer && viewer.graph;
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
    setToolbarEnabled(false);
  }

  function setToolbarEnabled(on) {
    ["drawio-zoom-in", "drawio-zoom-out", "drawio-zoom-reset", "drawio-fit"].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (el) el.disabled = !on;
      },
    );
  }

  function showZoom() {
    var g = graph();
    if (!g || !zoomLabel) return;
    zoomLabel.textContent = Math.round(g.view.scale * 100) + "%";
  }

  // Page names live on the <diagram> elements of an <mxfile>. A bare
  // <mxGraphModel> (a single-page export) has none, so this returns [].
  function pageNames(doc) {
    var diagrams = doc.getElementsByTagName("diagram");
    var out = [];
    for (var i = 0; i < diagrams.length; i++) {
      out.push(diagrams[i].getAttribute("name") || "Page-" + (i + 1));
    }
    return out;
  }

  function goToPage(i) {
    if (i === pageIndex || i < 0 || i >= names.length) return;
    pageIndex = i;
    syncPageControls();
    render();
  }

  // Both controls are built every time; CSS decides which one is visible at the
  // current width, so there is no resize listener to keep in sync.
  function buildPageControls() {
    if (names.length < 2) {
      if (tabs) tabs.hidden = true;
      if (selectWrap) selectWrap.hidden = true;
      return;
    }

    if (tabs) {
      tabs.hidden = false;
      tabs.textContent = "";
      names.forEach(function (name, i) {
        var btn = document.createElement("button");
        btn.className = "drawio-page";
        btn.type = "button";
        btn.textContent = name;
        btn.addEventListener("click", function () {
          goToPage(i);
        });
        tabs.appendChild(btn);
      });
    }

    if (select) {
      selectWrap.hidden = false;
      select.textContent = "";
      names.forEach(function (name, i) {
        var opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = name;
        select.appendChild(opt);
      });
      select.addEventListener("change", function () {
        goToPage(parseInt(select.value, 10));
      });
    }

    syncPageControls();
  }

  function syncPageControls() {
    if (tabs) {
      var btns = tabs.children;
      for (var i = 0; i < btns.length; i++) {
        var on = i === pageIndex;
        btns[i].classList.toggle("active", on);
        btns[i].setAttribute("aria-current", on ? "true" : "false");
      }
    }
    if (select) select.value = String(pageIndex);
  }

  // Drag anywhere on the canvas to pan. The viewer's own panning only kicks in
  // for lightbox mode, so scroll position is moved directly instead.
  function enablePan() {
    if (!stage) return;
    var down = false;
    var startX = 0;
    var startY = 0;
    var scrollX = 0;
    var scrollY = 0;

    stage.addEventListener("pointerdown", function (e) {
      // Let clicks on diagram links and the viewer's own controls through.
      if (e.target.closest("a, .geHint, .mxToolbar")) return;
      down = true;
      startX = e.clientX;
      startY = e.clientY;
      scrollX = stage.scrollLeft;
      scrollY = stage.scrollTop;
      stage.classList.add("is-panning");
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener("pointermove", function (e) {
      if (!down) return;
      stage.scrollLeft = scrollX - (e.clientX - startX);
      stage.scrollTop = scrollY - (e.clientY - startY);
    });

    function end(e) {
      if (!down) return;
      down = false;
      stage.classList.remove("is-panning");
      if (stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId)) {
        stage.releasePointerCapture(e.pointerId);
      }
    }
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
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
    // arguments. Its built-in toolbar is suppressed ("toolbar": null) because
    // this page supplies its own, which stays consistent with the site chrome
    // and remains usable on small screens.
    var config = {
      highlight: "#0f766e",
      nav: true,
      resize: true,
      toolbar: null,
      lightbox: false,
      page: pageIndex,
      xml: xml,
    };

    var mount = document.createElement("div");
    mount.className = "mxgraph";
    mount.setAttribute("data-mxgraph", JSON.stringify(config));
    host.appendChild(mount);

    try {
      // GraphViewer builds its mxGraph asynchronously (it waits on stylesheets
      // and fonts), so the instance handed to this callback does not have
      // .graph yet. viewerInitialized fires once the graph really exists — that
      // is the only safe moment to zoom or fit.
      window.GraphViewer.viewerInitialized = function (v) {
        viewer = v;
        setToolbarEnabled(true);
        fit();
      };
      window.GraphViewer.createViewerForElement(mount);
    } catch (err) {
      fail(
        "Diagram failed to render: " + (err && err.message ? err.message : err),
      );
    }
  }

  // Scale the diagram to the stage, but never magnify past 100% — blowing a
  // small diagram up to fill a wide monitor just looks broken.
  function fit() {
    var g = graph();
    if (!g || !stage) return;
    try {
      var bounds = g.getGraphBounds();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;
      var pad = 48;
      var sx = (stage.clientWidth - pad) / (bounds.width / g.view.scale);
      var sy = (stage.clientHeight - pad) / (bounds.height / g.view.scale);
      g.zoomTo(Math.min(1, Math.max(0.1, Math.min(sx, sy))));
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    } catch (e) {
      /* bounds unavailable — leave the current scale alone */
    }
    showZoom();
  }

  function zoomBy(factor) {
    var g = graph();
    if (!g) return;
    g.zoomTo(Math.min(4, Math.max(0.1, g.view.scale * factor)));
    showZoom();
  }

  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }

  on("drawio-zoom-in", function () { zoomBy(1.2); });
  on("drawio-zoom-out", function () { zoomBy(1 / 1.2); });
  on("drawio-zoom-reset", function () {
    var g = graph();
    if (g) { g.zoomTo(1); showZoom(); }
  });
  on("drawio-fit", fit);

  on("drawio-fullscreen", function () {
    var target = document.querySelector(".drawio-container");
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (target.requestFullscreen) {
      target.requestFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", function () {
    var target = document.querySelector(".drawio-container");
    if (target) target.classList.toggle("is-fullscreen", !!document.fullscreenElement);
    // The stage changed size, so the previous fit is no longer right.
    setTimeout(fit, 100);
  });

  // Ctrl/Cmd + wheel zooms, matching the gesture people expect on a canvas.
  // A plain wheel keeps scrolling the stage.
  if (stage) {
    stage.addEventListener(
      "wheel",
      function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      },
      { passive: false },
    );
  }

  document.addEventListener("keydown", function (e) {
    // Never steal keys from the sidebar search or any other input.
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.2); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.2); }
    else if (e.key === "0") { e.preventDefault(); var g = graph(); if (g) { g.zoomTo(1); showZoom(); } }
    else if (e.key === "f" || e.key === "F") { e.preventDefault(); fit(); }
    else if (e.key === "v" || e.key === "V") {
      e.preventDefault();
      var btn = document.getElementById("drawio-fullscreen");
      if (btn) btn.click();
    } else if (e.key === "ArrowRight" && names.length > 1) { goToPage(pageIndex + 1); }
    else if (e.key === "ArrowLeft" && names.length > 1) { goToPage(pageIndex - 1); }
  });

  // Re-fit when the pane changes width (sidebar toggle, window resize) so the
  // diagram keeps filling the space instead of stranding it in a corner.
  if (window.ResizeObserver && stage) {
    var last = 0;
    var timer = null;
    new ResizeObserver(function () {
      if (Math.abs(stage.clientWidth - last) < 24) return;
      last = stage.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(fit, 150);
    }).observe(stage);
  }

  setToolbarEnabled(false);
  enablePan();

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
      names = pageNames(doc);
      buildPageControls();
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
