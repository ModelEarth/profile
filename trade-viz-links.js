// Links between the trade data visualization pages, shared so each page shows the same buttons.
// Usage: renderTradeVizLinks(document.getElementById("trade-viz-links"));
// Each link gets an id (such as "state-sankey-link") so a page can update its href, for example to pass hash values.
(function () {
    // Paths are relative to this script, which resides in the profile repo root.
    const scriptSrc = document.currentScript ? document.currentScript.src : "";
    const profileBase = scriptSrc ? new URL(".", scriptSrc).href : "";

    // passHash: hash keys carried forward from the current page when it has them, e.g. footprint/#state=GA.
    // Lists pass whole (state=GA,TX). Pages showing one place use the first (TradeVizHash.first) and keep
    // the list in their hash (TradeVizHash.keepList). The state pages use 2019 data only, so they don't take year.
    const TRADE_VIZ_LINKS = [
        { id: "us-states-link", label: "US States", path: "trade/map/state.html", passHash: ["state"] },
        { id: "international-map-link", label: "International map", path: "trade/map/index.html", passHash: ["country", "year"] },
        { id: "state-sankey-link", label: "State Sankey", path: "charts/sankey/state.html", passHash: ["state"] },
        { id: "dependency-link", label: "Dependency & Advantage", path: "trade/advantage/", passHash: ["state"] },
        { id: "industries-link", label: "Industries", path: "footprint/", passHash: ["state", "country", "year"] }
    ];

    // getHash() is in localsite.js, which each page loads. Read when the link is used, since updateHash()
    // and goHashQuiet() change the hash without a hashChangeEvent.
    // href with the current hash's values for keys added, e.g. ("../info/", ["state", "geo"]) -> "../info/#state=GA&geo=US13121"
    function hashHref(href, keys) {
        href = String(href).split("#")[0];
        const hash = typeof getHash === "function" ? getHash() : {};
        const pairs = [];
        (keys || []).forEach(function (key) {
            const value = String(hash[key] || "").trim();
            if (value) pairs.push(key + "=" + encodeURIComponent(value).replace(/%2C/g, ","));
        });
        return pairs.length ? href + "#" + pairs.join("&") : href;
    }
    // Keeps a link's href passing the hash keys forward: on hashChangeEvent, and before the link is used,
    // since pages that change the hash with updateHash() don't fire hashChangeEvent.
    // Hover (the status bar URL), pointerdown (click, middle-click, right-click) and keyboard focus.
    function passHashLink(a, href, keys) {
        if (!a) return;
        const refresh = function () { a.href = hashHref(href, keys); };
        refresh();
        ["pointerenter", "pointerdown", "focus"].forEach(function (type) { a.addEventListener(type, refresh); });
        document.addEventListener("hashChangeEvent", refresh);
    }
    // The location keys localsite pages read. Not the map view values (nullschool's earth, m...) also in the hash.
    const LOCATION_HASH_KEYS = ["geoview", "country", "usregion", "state", "geo", "regiontitle"];
    // For links on other pages, such as "Local Industries" on engine/index.html:
    //   HashLinks.pass(document.getElementById("local-industries-link"));  // the link's own href, location keys
    //   HashLinks.pass(a, ["state", "year"]);                                // other keys
    window.HashLinks = {
        locationKeys: LOCATION_HASH_KEYS,
        href: hashHref,
        pass: function (a, keys) {
            if (a) passHashLink(a, a.getAttribute("href"), keys || LOCATION_HASH_KEYS);
        }
    };

    function linkHref(link) {
        const href = profileBase + link.path;
        return link.passHash ? hashHref(href, link.passHash) : href;
    }
    function refreshPassHashLinks() {
        TRADE_VIZ_LINKS.forEach(function (link) {
            const a = link.passHash && document.getElementById(link.id);
            if (a) a.href = linkHref(link);
        });
    }
    // hashChangeEvent fires for goHash() and direct hash edits
    document.addEventListener("hashChangeEvent", refreshPassHashLinks);

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

    // For pages that show one place from a hash list such as state=GA,TX (passed whole by these links)
    window.TradeVizHash = {
        // The first value of a comma-separated hash value: "GA,TX" -> "GA"
        first: function (value) {
            return String(value || "").split(",")[0].trim();
        },
        // The hash value to write for the chosen place: the hash's list while it still starts with
        // that place (GA,TX stays for GA), otherwise the chosen place alone
        keepList: function (hashValue, chosen) {
            const list = String(hashValue || "").trim();
            const pick = String(chosen || "").trim();
            return pick && list.split(",")[0].trim().toUpperCase() === pick.toUpperCase() ? list : pick;
        }
    };

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
            a.href = linkHref(link);
            if (profileBase && pagePath(new URL(a.href).pathname) === pagePath(window.location.pathname)) {
                a.classList.add("is-current");
                a.setAttribute("aria-current", "page");
            }
            if (link.passHash) {
                // Re-read the hash before the link is used (see passHashLink)
                ["pointerenter", "pointerdown", "focus"].forEach(function (type) {
                    a.addEventListener(type, function () { a.href = linkHref(link); });
                });
            }
            container.appendChild(a);
        });
    };
})();
