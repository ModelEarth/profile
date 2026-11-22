// Shared Leaflet choropleth map for the profile pages: the map, its light or dark basemap, the tooltip, the legend,
// color scales, and the US state and world country shapes. CSS in ../css/profile-map.css.
// Used by trade/advantage/ (US states) and footprint/ (world countries, with the US states over them).
// Needs Leaflet, d3 and topojson-client loaded first.
//
//   const map = ProfileMap.createMap("map");
//   const tiles = ProfileMap.basemap(map, { attributionPrefix: "Data: ... | " }); // tiles.sync() after a theme change
//   const tooltip = ProfileMap.tooltip(document.getElementById("map-tooltip"));     // .show(event, html) .move(event) .hide()
//   const states = await ProfileMap.stateFeatures();    // GeoJSON features, properties.code = "GA"
//   const countries = await ProfileMap.countryFeatures(); // GeoJSON features, properties.iso3 = "IND"
(function () {
    const US_STATES_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
    const WORLD_COUNTRIES_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

    const FIPS_TO_CODE = {
        "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
        "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
        "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
        "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
        "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
        "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
        "54": "WV", "55": "WI", "56": "WY"
    };

    // world-atlas ids are ISO 3166 numeric codes. Each with its 3-letter code, e.g. 356IND.
    const NUMERIC_TO_ISO3 = new Map(("004AFG 008ALB 012DZA 024AGO 031AZE 032ARG 036AUS 040AUT 044BHS 050BGD 051ARM 056BEL 064BTN "
        + "068BOL 070BIH 072BWA 076BRA 084BLZ 090SLB 096BRN 100BGR 104MMR 108BDI 112BLR 116KHM 120CMR 124CAN 140CAF 144LKA 148TCD "
        + "152CHL 156CHN 158TWN 170COL 178COG 180COD 188CRI 191HRV 192CUB 196CYP 203CZE 204BEN 208DNK 214DOM 218ECU 222SLV 226GNQ "
        + "231ETH 232ERI 233EST 238FLK 242FJI 246FIN 250FRA 260ATF 262DJI 266GAB 268GEO 270GMB 275PSE 276DEU 288GHA 300GRC 304GRL "
        + "320GTM 324GIN 328GUY 332HTI 340HND 348HUN 352ISL 356IND 360IDN 364IRN 368IRQ 372IRL 376ISR 380ITA 384CIV 388JAM 392JPN "
        + "398KAZ 400JOR 404KEN 408PRK 410KOR 414KWT 417KGZ 418LAO 422LBN 426LSO 428LVA 430LBR 434LBY 440LTU 442LUX 450MDG 454MWI "
        + "458MYS 466MLI 478MRT 484MEX 496MNG 498MDA 499MNE 504MAR 508MOZ 512OMN 516NAM 524NPL 528NLD 540NCL 548VUT 554NZL 558NIC "
        + "562NER 566NGA 578NOR 586PAK 591PAN 598PNG 600PRY 604PER 608PHL 616POL 620PRT 624GNB 626TLS 630PRI 634QAT 642ROU 643RUS "
        + "646RWA 682SAU 686SEN 688SRB 694SLE 703SVK 704VNM 705SVN 706SOM 710ZAF 716ZWE 724ESP 728SSD 729SDN 732ESH 740SUR 748SWZ "
        + "752SWE 756CHE 760SYR 762TJK 764THA 768TGO 780TTO 784ARE 788TUN 792TUR 795TKM 800UGA 804UKR 807MKD 818EGY 826GBR 834TZA "
        + "840USA 854BFA 858URY 860UZB 862VEN 887YEM 894ZMB").split(" ").map(function (pair) { return [pair.slice(0, 3), pair.slice(3)]; }));
    // Shapes without a numeric id
    const NAME_TO_ISO3 = { "Kosovo": "XXK", "Somaliland": "SOM", "N. Cyprus": "CYP" };

    function isDark() {
        return document.body.classList.contains("dark");
    }
    function cssVar(name) {
        return getComputedStyle(document.body).getPropertyValue(name).trim();
    }

    // A Leaflet map without scroll-wheel zoom (so the page scrolls past it), with the zoom buttons at the lower right
    // (options.zoomPosition to move them). localsite hides Leaflet's lower right corner, so the profile-map class
    // lets ../css/profile-map.css show it again.
    function createMap(element, options) {
        options = options || {};
        const map = L.map(element, Object.assign({ scrollWheelZoom: false, zoomSnap: 0.25, minZoom: 2, zoomControl: false }, options.leaflet || {}));
        map.getContainer().classList.add("profile-map");
        L.control.zoom({ position: options.zoomPosition || "bottomright" }).addTo(map);
        return map;
    }

    // CARTO light and dark basemaps with localsite's key, or Esri gray canvas tiles when the key fails (cartoOrEsri in
    // localsite.js), or OpenStreetMap without localsite. sync() swaps them to match the site's light or dark mode.
    function basemap(map, options) {
        const prefix = (options && options.attributionPrefix) || "";
        const layers = {};
        let current = null;
        function layerFor(dark) {
            const key = dark ? "dark" : "light";
            if (!layers[key]) {
                layers[key] = typeof cartoOrEsri === "function"
                    ? cartoOrEsri(dark ? "dark_all" : "light_all", dark
                        ? ["World_Dark_Gray_Base", "World_Dark_Gray_Reference"]
                        : ["World_Light_Gray_Base", "World_Light_Gray_Reference"], { attributionPrefix: prefix })
                    : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "OpenStreetMap contributors | " + prefix });
            }
            return layers[key];
        }
        function sync() {
            const next = layerFor(isDark());
            if (next === current) return;
            if (current) map.removeLayer(current);
            current = next.addTo(map);
        }
        sync();
        return { sync: sync };
    }

    // Calls back when the site switches between light and dark
    function watchTheme(callback) {
        let dark = isDark();
        new MutationObserver(function () {
            if (isDark() === dark) return;
            dark = isDark();
            callback(dark);
        }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    // A tooltip that follows the pointer and stays inside the window (.map-tooltip in profile-map.css)
    function tooltip(element) {
        function move(event) {
            const source = event && event.originalEvent ? event.originalEvent : event;
            if (!source || typeof source.clientX !== "number") return;
            const pad = 14;
            const x = source.clientX + pad + element.offsetWidth > window.innerWidth ? source.clientX - element.offsetWidth - pad : source.clientX + pad;
            const y = source.clientY + element.offsetHeight + pad > window.innerHeight ? source.clientY - element.offsetHeight - pad : source.clientY + pad;
            element.style.left = x + "px";
            element.style.top = y + "px";
        }
        return {
            show: function (event, html) {
                element.innerHTML = html;
                element.style.display = "block";
                move(event);
            },
            move: move,
            hide: function () { element.style.display = "none"; }
        };
    }

    // Clicks, drags and wheel turns on a panel over the map stay off the map
    function keepOffMap(element) {
        if (!element) return;
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
    }

    // The middle of a shape's bounds, for its label. Shapes crossing the 180th meridian (Alaska's Aleutian Islands,
    // Russia, Fiji) stretch around the globe, so for one spanning more than half the globe use its largest piece.
    // options.largestPiece uses the largest piece for any shape (the contiguous US, rather than a center pulled toward Alaska).
    function shapeCenter(layer, options) {
        const bounds = layer.getBounds();
        if (!(options && options.largestPiece) && bounds.getEast() - bounds.getWest() <= 180) return bounds.getCenter();
        let largest = null;
        let largestArea = -1;
        (function walk(latlngs) {
            if (!Array.isArray(latlngs) || !latlngs.length) return;
            if (latlngs[0] instanceof L.LatLng) {
                const pieceBounds = L.latLngBounds(latlngs);
                const area =(pieceBounds.getEast() - pieceBounds.getWest()) * (pieceBounds.getNorth() - pieceBounds.getSouth());
                if (area > largestArea) { largest = pieceBounds; largestArea = area; }
                return;
            }
            latlngs.forEach(walk);
        })(layer.getLatLngs());
        return largest ? largest.getCenter() : bounds.getCenter();
    }

    // A d3 color scale over the values: sequential from colors[0] to the last, or diverging around options.center
    // (colors[0] below it, the last color above it). A function returning null when there are no values.
    function colorScale(colors, values, options) {
        options = options || {};
        const min = d3.min(values);
        const max = d3.max(values);
        const interpolator = d3.interpolateRgbBasis(colors);
        if (min == null) return function () { return null; };
        if (options.diverging) {
            const center = options.center || 0;
            const low = Math.min(min, center - 1e-9);
            const high = Math.max(max, center + 1e-9);
            if (options.symmetric) { // The same distance each side, so equal changes up and down get equal color
                const reach = Math.max(center - low, high - center);
                return d3.scaleDiverging(interpolator).domain([center - reach, center, center + reach]);
            }
            return d3.scaleDiverging(interpolator).domain([low, center, high]);
        }
        return d3.scaleSequential(interpolator).domain([min, max === min ? min + 1e-9 : max]);
    }

    // The legend's color ramp with its labels below (.legend-ramp and .legend-scale in profile-map.css)
    function legendRamp(colors, labels) {
        return '<div class="legend-ramp" style="background:linear-gradient(90deg,' + colors.join(", ") + ')"></div>' +
            '<div class="legend-scale">' + labels.map(function (label) { return "<span>" + label + "</span>"; }).join("") + "</div>";
    }

    const jsonCache = {};
    function loadJson(url) {
        if (!jsonCache[url]) {
            jsonCache[url] = fetch(url).then(function (response) {
                if (!response.ok) throw new Error("Unable to load " + url + " (" + response.status + ")");
                return response.json();
            }).catch(function (error) { delete jsonCache[url]; throw error; });
        }
        return jsonCache[url];
    }

    // US states from us-atlas, each with properties.code, e.g. "GA"
    function stateFeatures() {
        return loadJson(US_STATES_URL).then(function (topo) {
            return topojson.feature(topo, topo.objects.states).features.map(function (feature) {
                feature.properties = Object.assign({}, feature.properties, { code: FIPS_TO_CODE[String(feature.id).padStart(2, "0")] || "" });
                return feature;
            });
        });
    }

    // Rings crossing the 180th meridian (Fiji, and Russia's Chukotka and Wrangel Island) jump from 180 to -180, which
    // Leaflet draws as a band across the whole map. Their points west of it move past 180 (-179 becomes 181), so the
    // shape stays whole. Antarctica's ring circles the pole and draws correctly as it is, so rings reaching below
    // 60 degrees south are left alone.
    function unwrapAntimeridian(geometry) {
        if (!geometry) return geometry;
        const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
        polygons.forEach(function (polygon) {
            polygon.forEach(function (ring) {
                let west = Infinity, east = -Infinity, south = Infinity;
                ring.forEach(function (point) {
                    west = Math.min(west, point[0]);
                    east = Math.max(east, point[0]);
                    south = Math.min(south, point[1]);
                });
                if (east - west <= 180 || south < -60) return;
                ring.forEach(function (point) { if (point[0] < 0) point[0] += 360; });
            });
        });
        return geometry;
    }

    // World countries from world-atlas (Natural Earth 1:110m), each with properties.iso3, e.g. "IND". Antarctica has none.
    function countryFeatures() {
        return loadJson(WORLD_COUNTRIES_URL).then(function (topo) {
            return topojson.feature(topo, topo.objects.countries).features.map(function (feature) {
                unwrapAntimeridian(feature.geometry);
                const name = feature.properties && feature.properties.name;
                feature.properties = Object.assign({}, feature.properties, {
                    iso3: NUMERIC_TO_ISO3.get(String(feature.id)) || NAME_TO_ISO3[name] || ""
                });
                return feature;
            });
        });
    }

    window.ProfileMap = {
        US_STATES_URL: US_STATES_URL,
        WORLD_COUNTRIES_URL: WORLD_COUNTRIES_URL,
        FIPS_TO_CODE: FIPS_TO_CODE,
        isDark: isDark,
        cssVar: cssVar,
        createMap: createMap,
        basemap: basemap,
        watchTheme: watchTheme,
        tooltip: tooltip,
        keepOffMap: keepOffMap,
        shapeCenter: shapeCenter,
        colorScale: colorScale,
        legendRamp: legendRamp,
        loadJson: loadJson,
        stateFeatures: stateFeatures,
        countryFeatures: countryFeatures
    };
})();
