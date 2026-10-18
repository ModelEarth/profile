// Links between the trade data visualization pages, shared so each page shows the same buttons.
// Usage: renderTradeVizLinks(document.getElementById("trade-viz-links"));
// Each link gets an id (such as "state-sankey-link") so a page can update its href, for example to pass hash values.
(function () {
    // Paths are relative to this script, which resides in the profile repo root.
    const scriptSrc = document.currentScript ? document.currentScript.src : "";
    const profileBase = scriptSrc ? new URL(".", scriptSrc).href : "";

    const TRADE_VIZ_LINKS = [
        { id: "us-states-link", label: "US States", path: "trade/map/state.html" },
        { id: "international-map-link", label: "International map", path: "trade/map/index.html" },
        { id: "state-sankey-link", label: "State Sankey", path: "charts/sankey/state.html" },
        // exiobase is a sibling repo of profile in the webroot
        { id: "trade-data-link", label: "Trade Data", path: "../exiobase/tradeflow/" }
    ];

    function addStyles() {
        if (document.getElementById("trade-viz-links-style")) return;
        const style = document.createElement("style");
        style.id = "trade-viz-links-style";
        style.textContent = [
            ".trade-viz-links { display: flex; flex-wrap: wrap; gap: 8px; }",
            // Text colors are !important so the site's link colors (such as .content a:link in localsite base.css) don't turn the buttons blue
            // line-height: .content in localsite base.css sets 1.5em (22.5px), which made the buttons taller on pages using it
            ".trade-viz-link { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 600; line-height: 1.5;",
            "  color: #22314c !important; background: #fff; cursor: pointer; text-decoration: none !important;",
            "  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; }",
            ".trade-viz-link:hover { background: #f1f5fb; border-color: #94a3b8; }",
            ".trade-viz-link:active { background: #e2e8f0; }",
            ".trade-viz-link.is-current { background: #22314c; border-color: #22314c; color: #fff !important; cursor: default; }",
            ".dark .trade-viz-link { background: #333; border-color: #555; color: #ddd !important; }",
            ".dark .trade-viz-link:hover { background: #444; border-color: #777; }",
            ".dark .trade-viz-link:active { background: #222; }",
            ".dark .trade-viz-link.is-current { background: #ddd; border-color: #ddd; color: #222 !important; }"
        ].join("\n");
        document.head.appendChild(style);
    }

    // Treat "folder/" and "folder/index.html" as the same page
    function pagePath(pathname) {
        return pathname.replace(/\/index\.html$/i, "/");
    }

    window.renderTradeVizLinks = function (container) {
        if (!container) return;
        addStyles();
        container.classList.add("trade-viz-links");
        container.innerHTML = "";
        TRADE_VIZ_LINKS.forEach(function (link) {
            const a = document.createElement("a");
            a.id = link.id;
            a.className = "trade-viz-link";
            a.textContent = link.label;
            a.href = profileBase + link.path;
            if (profileBase && pagePath(new URL(a.href).pathname) === pagePath(window.location.pathname)) {
                a.classList.add("is-current");
                a.setAttribute("aria-current", "page");
            }
            container.appendChild(a);
        });
    };
})();
