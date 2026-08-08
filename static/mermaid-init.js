// Mermaid diagram rendering.
//
// The server turns both ```mermaid fences and standalone .mmd files into
// <pre class="mermaid"> elements (see promoteMermaidBlocks in main.go). This
// script renders them, wraps each one in a figure with zoom / fit / fullscreen
// controls, keeps them in sync with the light/dark theme toggle, and shows the
// raw source if a diagram fails to parse.
//
// Unlike the draw.io view — one diagram filling a dedicated pane — mermaid
// diagrams are inline in prose and there may be many on a page. So each figure
// owns its own zoom state, and the toolbar stays quiet until hover/focus.

(function () {
  // The vendored bundle assigns globalThis.mermaid on load.
  var mermaid = window.mermaid;
  if (!mermaid) return;

  var MIN_SCALE = 0.2;
  var MAX_SCALE = 4;
  // Floor for the automatic fit on load. Below roughly this scale mermaid's
  // label text stops being readable, so a very wide diagram is left larger
  // than its container and scrolled instead of shrunk into illegibility.
  var MIN_AUTO_FIT = 0.55;

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
      // Mermaid lays out node boxes by measuring labels at this size. It must
      // match what the label actually renders at, or long labels overflow the
      // foreignObject and get clipped — which is what happens if the label is
      // left to inherit the 16px body size.
      fontSize: 14,
      // On a parse failure mermaid otherwise draws its "bomb" graphic into the
      // document; this page shows the source in an error box instead.
      suppressErrorRendering: true,
      // useMaxWidth stays on: mermaid measures htmlLabels against it when it
      // lays out node boxes, and turning it off makes long labels overflow
      // their foreignObject and get clipped. Zooming is applied as a CSS
      // transform on top of whatever mermaid produces, so it does not need the
      // SVG to be at its natural size.
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true },
    });
  }

  // Stash the original source on first sight. mermaid replaces the element's
  // innerHTML with SVG, so re-rendering on theme change needs the source back.
  function sources() {
    var blocks = document.querySelectorAll(
      "pre.mermaid, pre.mermaid-rendered, .mermaid-figure > pre",
    );
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (el.dataset.src === undefined) el.dataset.src = el.textContent;
    }
    return blocks;
  }

  function icon(paths) {
    var svg =
      '<svg viewBox="0 0 16 16" aria-hidden="true">' + paths + "</svg>";
    return svg;
  }

  var ICONS = {
    out: '<path d="M3.5 8h9"/>',
    in: '<path d="M8 3.5v9M3.5 8h9"/>',
    fit: '<path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10"/>',
    full: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
  };

  function button(cls, title, paths, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mermaid-btn " + cls;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = icon(paths);
    if (label) {
      var span = document.createElement("span");
      span.className = "mermaid-btn-label";
      span.textContent = label;
      b.appendChild(span);
    }
    return b;
  }

  // Wrap a rendered diagram in <figure> with its own toolbar and viewport.
  // Returns the figure so the caller can swap it in for the <pre>.
  function buildFigure(svgMarkup, src) {
    var figure = document.createElement("figure");
    figure.className = "mermaid-figure";

    var viewport = document.createElement("div");
    viewport.className = "mermaid-viewport";

    var canvas = document.createElement("div");
    canvas.className = "mermaid-canvas";
    canvas.innerHTML = svgMarkup;
    viewport.appendChild(canvas);

    var bar = document.createElement("div");
    bar.className = "mermaid-toolbar";

    var zoomGroup = document.createElement("div");
    zoomGroup.className = "mermaid-zoom";
    var bOut = button("", "Zoom out", ICONS.out);
    var bLevel = document.createElement("button");
    bLevel.type = "button";
    bLevel.className = "mermaid-btn mermaid-zoom-level";
    bLevel.title = "Reset zoom to 100%";
    bLevel.setAttribute("aria-label", "Reset zoom");
    bLevel.textContent = "100%";
    var bIn = button("", "Zoom in", ICONS.in);
    zoomGroup.appendChild(bOut);
    zoomGroup.appendChild(bLevel);
    zoomGroup.appendChild(bIn);

    var bFit = button("", "Fit diagram to width", ICONS.fit, "Fit");
    var bFull = button("", "Fullscreen", ICONS.full, "Full");

    bar.appendChild(zoomGroup);
    bar.appendChild(bFit);
    bar.appendChild(bFull);

    figure.appendChild(bar);
    figure.appendChild(viewport);

    // ── per-figure state ────────────────────────────────────────────────────
    var scale = 1;
    var natural = { w: 0, h: 0 };

    var svg = canvas.querySelector("svg");
    if (svg) {
      // The viewBox carries the diagram's intrinsic size. Pin the SVG to it so
      // the element has a stable, known box to scale — mermaid's useMaxWidth
      // otherwise leaves width:100%, which would make every zoom step relative
      // to the column rather than to the diagram.
      var vb = svg.viewBox && svg.viewBox.baseVal;
      natural.w = (vb && vb.width) || svg.getBoundingClientRect().width || 0;
      natural.h = (vb && vb.height) || svg.getBoundingClientRect().height || 0;
      if (natural.w && natural.h) {
        svg.style.maxWidth = "none";
        svg.style.width = natural.w + "px";
        svg.style.height = natural.h + "px";
      }
    }

    function apply() {
      canvas.style.transform = "scale(" + scale + ")";
      // The transform does not affect layout, so the viewport is told the
      // scaled size explicitly — otherwise scrollbars never appear.
      if (natural.w && natural.h) {
        canvas.style.width = natural.w * scale + "px";
        canvas.style.height = natural.h * scale + "px";
      }
      bLevel.textContent = Math.round(scale * 100) + "%";
      figure.classList.toggle("is-zoomed", Math.abs(scale - 1) > 0.01);
    }

    function setScale(next) {
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      apply();
    }

    // Set once the reader zooms by hand, so a window resize stops re-fitting
    // and clobbering the scale they chose.
    var userZoomed = false;
    function userSetScale(next) {
      userZoomed = true;
      setScale(next);
    }

    // Fit scales to the viewport, and never magnifies past 100% — a small
    // diagram blown up to fill the column just looks broken.
    //
    // `floor` guards the automatic fit on load: a very wide diagram would
    // otherwise land around 20%, where the labels are unreadable. Pressing Fit
    // explicitly passes no floor, so the button always does what it says and
    // shows the whole diagram however wide it is.
    function fit(floor) {
      if (!natural.w) return;
      var avail = viewport.clientWidth - 24;
      if (avail <= 0) return;
      var target = avail / natural.w;
      // In fullscreen, height is the binding constraint more often than width.
      if (document.fullscreenElement === figure && natural.h) {
        var availH = viewport.clientHeight - 24;
        if (availH > 0) target = Math.min(target, availH / natural.h);
      }
      target = Math.min(1, target);
      if (floor) target = Math.max(target, floor);
      setScale(target);
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }

    bOut.addEventListener("click", function () { userSetScale(scale / 1.2); });
    bIn.addEventListener("click", function () { userSetScale(scale * 1.2); });
    bLevel.addEventListener("click", function () { userSetScale(1); });
    bFit.addEventListener("click", function () { userZoomed = true; fit(); });

    bFull.addEventListener("click", function () {
      if (document.fullscreenElement === figure) {
        document.exitFullscreen();
      } else if (figure.requestFullscreen) {
        figure.requestFullscreen();
      }
    });

    // Ctrl/Cmd + wheel zooms this figure; a plain wheel scrolls the page.
    viewport.addEventListener(
      "wheel",
      function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        userSetScale(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      },
      { passive: false },
    );

    // Drag to pan whenever the diagram overflows its viewport.
    var down = false, sx = 0, sy = 0, sl = 0, st = 0;
    viewport.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a")) return;
      if (viewport.scrollWidth <= viewport.clientWidth &&
          viewport.scrollHeight <= viewport.clientHeight) return;
      down = true;
      sx = e.clientX; sy = e.clientY;
      sl = viewport.scrollLeft; st = viewport.scrollTop;
      viewport.classList.add("is-panning");
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener("pointermove", function (e) {
      if (!down) return;
      viewport.scrollLeft = sl - (e.clientX - sx);
      viewport.scrollTop = st - (e.clientY - sy);
    });
    function endPan(e) {
      if (!down) return;
      down = false;
      viewport.classList.remove("is-panning");
      if (viewport.hasPointerCapture && viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
    }
    viewport.addEventListener("pointerup", endPan);
    viewport.addEventListener("pointercancel", endPan);

    figure.addEventListener("fullscreenchange", function () {
      var on = document.fullscreenElement === figure;
      figure.classList.toggle("is-fullscreen", on);
      setTimeout(fit, 60);
    });

    // Keep the source around for the theme-change re-render. _autoFit is what
    // the resize handler uses, so a width change re-fits under the same floor
    // the diagram was first laid out with rather than shrinking it further.
    figure.dataset.src = src;
    figure._autoFit = function () {
      if (!userZoomed) fit(MIN_AUTO_FIT);
    };

    // Wide diagrams start fitted so their shape is visible at a glance — but
    // never below MIN_AUTO_FIT, because a 3400px diagram squeezed into an
    // 800px column lands around 23%, where the labels are unreadable. Past
    // that floor it is better to keep the text legible and let the reader
    // scroll (or hit Full), which is what the toolbar is for.
    requestAnimationFrame(function () {
      if (natural.w && natural.w > viewport.clientWidth - 24) fit(MIN_AUTO_FIT);
      else apply();
    });

    return figure;
  }

  function renderError(target, src, err) {
    var box = document.createElement("div");
    box.className = "mermaid-error";
    var msg = document.createElement("div");
    msg.className = "mermaid-error-msg";
    msg.textContent =
      "Diagram failed to render: " + (err && err.message ? err.message : err);
    var pre = document.createElement("pre");
    pre.textContent = src;
    box.appendChild(msg);
    box.appendChild(pre);
    box.dataset.src = src;
    target.replaceWith(box);
  }

  async function render() {
    // Re-rendering (theme flip) replaces figures, so collect current targets:
    // un-rendered <pre> blocks plus any figure/error box built earlier.
    var targets = [];
    sources();
    document
      .querySelectorAll("pre.mermaid, pre.mermaid-rendered, .mermaid-figure, .mermaid-error")
      .forEach(function (el) {
        targets.push(el);
      });
    if (!targets.length) return;

    init();

    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var src = el.dataset.src || el.textContent || "";
      if (!src.trim()) continue;

      try {
        var id = "mmd-" + i + "-" + Math.random().toString(36).slice(2, 8);
        var out = await mermaid.render(id, src);
        var figure = buildFigure(out.svg, src);
        el.replaceWith(figure);
        if (out.bindFunctions) out.bindFunctions(figure);
      } catch (err) {
        renderError(el, src, err);
      }
    }

    // Belt and braces for suppressErrorRendering: older mermaid builds still
    // leave the failed diagram's SVG (the "bomb" graphic) parked in the body.
    document
      .querySelectorAll('body > svg[id^="mmd-"], body > svg[id^="d" i][aria-roledescription="error"]')
      .forEach(function (orphan) {
        orphan.remove();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  // Re-fit fitted diagrams when the content column changes width.
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll(".mermaid-figure").forEach(function (f) {
        if (f._autoFit) f._autoFit();
      });
    }, 150);
  });

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
