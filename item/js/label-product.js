// label-product.js - Product Impact Label Rendering
// Displays environmental impact data from product YAML files in FDA or Badge style

// ============================================
// Helper Functions
// ============================================

/**
 * When this label is embedded on a page other than profile/item/ itself
 * (e.g. io/template/), category links need to navigate there instead of
 * just changing the hash on the current page.
 */
function getCategoryLinkPrefix() {
    return window.location.pathname.includes("/profile/item/") ? "" : "../../profile/item/";
}

/**
 * Formats a value that might be an object into a readable string
 * @param {*} value - The value to format (can be string, object, etc.)
 * @param {boolean} showKeys - Whether to show keys in the output (default: true)
 * @returns {string} - Formatted string representation
 */
function formatValue_ObjectSafe(value, showKeys = true) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        // Walk through all properties and format as "key: value" pairs
        const pairs = [];
        for (const [key, val] of Object.entries(value)) {
            if (val === null || val === undefined || val === '') continue;

            // Format the key to be more readable (convert snake_case to Title Case)
            const readableKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Recursively format the value
            let formattedVal;
            if (typeof val === 'object') {
                formattedVal = formatValue_ObjectSafe(val, false);
            } else {
                formattedVal = String(val);
            }

            if (formattedVal) {
                pairs.push(showKeys ? `${readableKey}: ${formattedVal}` : formattedVal);
            }
        }
        return pairs.join(', ');
    }
    if (Array.isArray(value)) {
        return value.map(v => formatValue_ObjectSafe(v, showKeys)).filter(Boolean).join(', ');
    }
    return String(value);
}

/**
 * Formats owned_by object with expandable details
 * @param {*} ownedBy - The owned_by value (can be string or object)
 * @param {string} uniqueId - Unique identifier for expandable section
 * @returns {string} - HTML string with name, website, and expandable details
 */
function formatOwnedBy(ownedBy, uniqueId) {
    if (!ownedBy) return '';

    // If it's a string, just return it
    if (typeof ownedBy !== 'object') {
        return String(ownedBy);
    }

    const name = ownedBy.name || ownedBy.legal_name || '';
    const website = ownedBy.website || ownedBy.web_url || ownedBy.url || '';

    // Collect all other fields
    const otherFields = [];
    for (const [key, val] of Object.entries(ownedBy)) {
        if (val === null || val === undefined || val === '') continue;
        if (key === 'name' || key === 'legal_name' || key === 'website' || key === 'web_url' || key === 'url') continue;

        const readableKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Check if this is an image field
        const isImage = key.toLowerCase().includes('image') || key.toLowerCase().includes('img') || key.toLowerCase().includes('logo') || key.toLowerCase().includes('photo');
        // Check if this is a link field
        const isLink = key.toLowerCase().includes('link') || key.toLowerCase().includes('url');
        let formattedVal;

        if (isImage && typeof val === 'string') {
            // Show key as comment/label above image
            formattedVal = `<div style="color: #64748b; font-size: 0.8em; margin-bottom: 4px;">${readableKey}</div><img src="${val}" alt="${readableKey}" style="max-width: 200px; max-height: 200px; border-radius: 4px; border: 1px solid #e2e8f0;" />`;
            otherFields.push(`<div style="margin-top: 8px;">${formattedVal}</div>`);
        } else if (isLink && typeof val === 'string') {
            // Truncate URL for display
            const displayUrl = val.length > 40 ? val.substring(0, 37) + '...' : val;
            formattedVal = `<a href="${val}" target="_blank" class="location-link">${displayUrl} ↗</a>`;
            otherFields.push(`<div style="font-size: 0.85em; margin-top: 4px;"><strong>${readableKey}:</strong> ${formattedVal}</div>`);
        } else {
            formattedVal = String(val);
            otherFields.push(`<div style="font-size: 0.85em; margin-top: 4px;"><strong>${readableKey}:</strong> ${formattedVal}</div>`);
        }
    }

    let html = '';

    // Show name
    if (name) {
        html += name;
    }

    // Show website as link
    if (website) {
        html += ` <a href="${website}" target="_blank" class="location-link">Website ↗</a>`;
    }

    // Add expandable section for other fields
    if (otherFields.length > 0) {
        html += ` <span style="cursor: pointer; color: #3b82f6; font-size: 0.9em; margin-left: 8px;" onclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'">▼ Details</span>`;
        html += `<div id="${uniqueId}" style="display: none; margin-top: 8px; padding: 8px; background: #f8fafc; border-radius: 4px; border-left: 3px solid #3b82f6;">`;
        html += otherFields.join('');
        html += '</div>';
    }

    return html;
}

// ============================================
// Product Label Rendering
// ============================================

let productImageGalleryList = null;
let productImageResizeBound = false;
let badgefirst = true;

function adjustProductImageRect(imageRect, img) {
    if (!imageRect || !img || !img.naturalWidth || !img.naturalHeight) {
        return;
    }

    const rectWidth = imageRect.getBoundingClientRect().width;
    if (!rectWidth) {
        requestAnimationFrame(() => adjustProductImageRect(imageRect, img));
        return;
    }

    const ratio = img.naturalWidth / img.naturalHeight;
    const maxHeight = rectWidth;
    const desiredHeight = rectWidth / ratio;
    const finalHeight = Math.min(maxHeight, desiredHeight);
    imageRect.style.height = `${finalHeight}px`;
}

function renderProductLabel(profileObject, quantity = 1, options = {}) {
    const settings = typeof getLabelSettings === "function" ? getLabelSettings() : { style: "fda", verbosity: "medium" };
    const style = options.style || settings.style;
    const verbosity = options.verbosity || settings.verbosity;

    // Create wrapper div for image + label
    const wrapper = document.createElement("div");
    wrapper.className = "product-label-wrapper";

    const badgeWrapper = document.createElement("div");
    badgeWrapper.id = "itembadge";
    const badgeContent = style === "badge"
        ? renderProductBadgeStyle(profileObject, quantity, verbosity)
        : renderProductFDAStyle(profileObject, quantity, verbosity);
    badgeWrapper.appendChild(badgeContent);

    const imageRect = document.createElement("div");
    if (profileObject.priorityImage) {
        imageRect.className = "product-image-rect";
        const imageLink = document.createElement("a");
        imageLink.href = profileObject.priorityImage.url;
        imageLink.target = "_blank";
        imageLink.rel = "noopener";
        const imageOverlayBtn = document.createElement("button");
        imageOverlayBtn.type = "button";
        imageOverlayBtn.className = "product-image-rect-open";
        imageOverlayBtn.setAttribute("aria-label", "Open image");
        imageOverlayBtn.innerHTML = `<span class="material-icons">open_in_full</span>`;
        const img = document.createElement("img");
        img.src = profileObject.priorityImage.url;
        img.alt = "Product image";
        img.onload = function() {
            adjustProductImageRect(imageRect, img);
            if (!productImageResizeBound) {
                productImageResizeBound = true;
                window.addEventListener("resize", () => adjustProductImageRect(imageRect, img));
            }
        };
        img.onerror = function() {
            imageRect.style.display = 'none';
        };
        imageLink.addEventListener("click", function(event) {
            event.preventDefault();
            const fallbackList = profileObject.priorityImage ? [profileObject.priorityImage.url] : [];
            const galleryList = Array.isArray(productImageGalleryList) && productImageGalleryList.length
                ? productImageGalleryList
                : fallbackList;
            const startIndex = galleryList.indexOf(profileObject.priorityImage.url);
            openProductImageModal(
                profileObject.priorityImage.url,
                galleryList,
                Math.max(0, startIndex)
            );
        });
        imageOverlayBtn.addEventListener("click", function(event) {
            event.preventDefault();
            event.stopPropagation();
            imageLink.click();
        });
        imageLink.appendChild(img);
        imageRect.appendChild(imageLink);
        imageRect.appendChild(imageOverlayBtn);
    }

    if (badgefirst) {
        wrapper.appendChild(badgeWrapper);
        if (profileObject.priorityImage) {
            wrapper.appendChild(imageRect);
        }
    } else {
        if (profileObject.priorityImage) {
            wrapper.appendChild(imageRect);
        }
        wrapper.appendChild(badgeWrapper);
    }

    return wrapper;
}

function reRenderProductLabel(profile, data, container, settings) {
    // Find and remove old label wrapper
    const oldLabel = container.querySelector(".product-label-wrapper, .product-label, .nutrition-label:not(.aggregate)");
    if (oldLabel) {
        const newLabel = typeof renderProductLabel === "function"
            ? renderProductLabel(profile, 1, settings)
            : renderNutritionLabel(profile, 1, false);
        oldLabel.replaceWith(newLabel);
    }
}

function ensureProductImageModal() {
    let modal = document.getElementById("product-image-modal");
    if (modal) {
        return modal;
    }

    modal = document.createElement("div");
    modal.id = "product-image-modal";
    modal.className = "product-image-modal";
    modal.innerHTML = `
        <div class="product-image-modal-backdrop"></div>
        <div class="product-image-modal-content" role="dialog" aria-modal="true" aria-label="Product image preview">
            <button type="button" class="product-image-modal-close" aria-label="Close image">
                <span class="material-icons">close</span>
            </button>
            <img class="product-image-modal-img" alt="Product image preview">
            <div class="product-image-modal-nav" aria-hidden="true">
                <button type="button" class="product-image-modal-prev" aria-label="Previous image">
                    <span class="material-icons">chevron_left</span>
                </button>
                <span class="product-image-modal-counter">1 / 1</span>
                <button type="button" class="product-image-modal-next" aria-label="Next image">
                    <span class="material-icons">chevron_right</span>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeButton = modal.querySelector(".product-image-modal-close");
    const backdrop = modal.querySelector(".product-image-modal-backdrop");
    const prevButton = modal.querySelector(".product-image-modal-prev");
    const nextButton = modal.querySelector(".product-image-modal-next");

    function closeModal() {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
    }

    function stepImage(direction) {
        if (!modal._imageList || modal._imageList.length <= 1) {
            return;
        }
        const listLength = modal._imageList.length;
        modal._imageIndex = (modal._imageIndex + direction + listLength) % listLength;
        updateProductImageModal(modal);
    }

    closeButton.addEventListener("click", closeModal);
    backdrop.addEventListener("click", closeModal);
    prevButton.addEventListener("click", () => stepImage(-1));
    nextButton.addEventListener("click", () => stepImage(1));

    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape" && modal.classList.contains("active")) {
            closeModal();
        }
        if (event.key === "ArrowLeft" && modal.classList.contains("active")) {
            stepImage(-1);
        }
        if (event.key === "ArrowRight" && modal.classList.contains("active")) {
            stepImage(1);
        }
    });

    window.addEventListener("resize", () => {
        if (modal.classList.contains("active")) {
            adjustProductImageModalNav(modal);
        }
    });

    modal.setAttribute("aria-hidden", "true");
    return modal;
}

function adjustProductImageModalNav(modal) {
    const image = modal.querySelector(".product-image-modal-img");
    if (!image) {
        return;
    }

    const rect = image.getBoundingClientRect();
    const isSmall = rect.width < 400 || rect.height < 400;
    modal.classList.toggle("nav-below", isSmall);
}

function updateProductImageModal(modal) {
    const image = modal.querySelector(".product-image-modal-img");
    const counter = modal.querySelector(".product-image-modal-counter");
    const nav = modal.querySelector(".product-image-modal-nav");
    const list = modal._imageList || [];

    if (!list.length) {
        return;
    }

    const currentUrl = list[modal._imageIndex];
    image.src = currentUrl;
    counter.textContent = `${modal._imageIndex + 1} / ${list.length}`;
    nav.setAttribute("aria-hidden", list.length <= 1 ? "true" : "false");
    nav.style.display = list.length <= 1 ? "none" : "flex";
    image.onload = () => {
        requestAnimationFrame(() => adjustProductImageModalNav(modal));
    };
    adjustProductImageModalNav(modal);
}

function openProductImageModal(imageUrl, imageList = null, startIndex = null) {
    if (!imageUrl) {
        return;
    }

    const modal = ensureProductImageModal();
    const list = Array.isArray(imageList) && imageList.length ? imageList : [imageUrl];
    const resolvedIndex = typeof startIndex === "number"
        ? startIndex
        : Math.max(0, list.indexOf(imageUrl));

    modal._imageList = list;
    modal._imageIndex = resolvedIndex;
    updateProductImageModal(modal);
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
}

// ============================================
// FDA Nutrition Facts Style
// ============================================

function renderProductFDAStyle(profileObject, quantity = 1, verbosity = "medium") {
    const div = document.createElement("div");
    div.className = "nutrition-label product-label fda-style";

    const declaredUnit = profileObject.declaredUnit || "unit";
    const category = profileObject.category || "";
    const categoryLink = category ? `<a href="${getCategoryLinkPrefix()}#layout=product&cat=${category}" class="category-link">${category.replace(/_/g, ' ')}</a>` : "";

    // Header
    div.innerHTML = `
        <div class="category-header">
            <div class="category-header-left">${categoryLink || ""}</div>
            <div class="category-header-right"></div>
        </div>
        <div class="item-label-header">
            <div class="item-name">${profileObject.itemName || "Product"}</div>
        </div>
        <hr class="thick-line">
        <div class="serving-size">Impact Per ${quantity > 1 ? quantity + " " : ""}${declaredUnit}</div>
        <hr class="thin-line">
    `;

    // Filter sections based on verbosity
    const sectionsToShow = filterSectionsByVerbosity(profileObject.sections, verbosity);

    sectionsToShow.forEach(section => {
        const sectionDiv = renderFDASection(section, quantity);
        div.appendChild(sectionDiv);
        const hr = document.createElement("hr");
        hr.className = "thin-line";
        div.appendChild(hr);
    });

    const headerRight = div.querySelector(".category-header-right");
    if (headerRight && typeof createStyleToggle === "function") {
        headerRight.appendChild(createStyleToggle((newSettings) => {
            const container = document.getElementById("product-label");
            if (container) {
                reRenderProductLabel(profileObject, profileObject.rawData || {}, container, newSettings);
            }
        }));
    }

    // Footer with benchmark info
    if (verbosity !== "simple") {
        const footer = document.createElement("div");
        footer.className = "label-footer";
        footer.innerHTML = `
            <div class="disclaimer">
                * Percent of Average Impact based on industry benchmarks.
                <br>Lower values indicate better environmental performance.
            </div>
        `;
        div.appendChild(footer);
    }

    return div;
}

function renderFDASection(section, quantity) {
    const val = section.value * quantity;
    const unit = section.unit || getUnit(section.name);
    const formattedVal = formatValue(val, section.name, section.decimals || 2);
    const percentOfAvg = section.percentOfAverage ? Math.round(section.percentOfAverage * quantity) : null;

    const sectionDiv = document.createElement("div");
    sectionDiv.className = "nutrition-section";

    // Check if this is a primary/important metric
    const isPrimary = section.primary || section.name.toLowerCase().includes("global warming");

    // Get appropriate tooltip for this metric
    let tooltip = "";
    const nameLower = section.name.toLowerCase();
    if (nameLower.includes("global warming") || nameLower.includes("gwp")) {
        tooltip = createInfoIcon(METRIC_TOOLTIPS.gwp, 'tip-gwp-label');
    } else if (nameLower.includes("uncertainty")) {
        tooltip = createInfoIcon(METRIC_TOOLTIPS.uncertainty, 'tip-uncertainty-label');
    }

    sectionDiv.innerHTML = `
        <div class="section-title ${isPrimary ? 'primary-metric' : ''}">
            <span class="metric-title-row">
                ${isPrimary ? '<strong>' : ''}${section.name}${isPrimary ? '</strong>' : ''}
                ${tooltip}
            </span>
            <span class="metric-values-right">
                <span class="metric-value-inline">${formattedVal}${unit}</span>
                ${percentOfAvg ? `<span class="daily-value">${percentOfAvg}%*</span>` : ''}
            </span>
        </div>
    `;

    // Subsections
    if (section.subsections && section.subsections.length > 0) {
        section.subsections.forEach(subsection => {
            const subVal = subsection.value * quantity;
            const subUnit = subsection.unit || getUnit(subsection.name);
            const subFormattedVal = formatValue(subVal, subsection.name, subsection.decimals || 2);
            const subPercent = subsection.percentOfAverage ? Math.round(subsection.percentOfAverage * quantity) : null;

            const subDiv = document.createElement("div");
            subDiv.className = "sub-section";
            subDiv.innerHTML = `
                <span>${subsection.name}</span>
                <span class="metric-values-right">
                    <span class="value">${subFormattedVal}${subUnit}</span>
                    ${subPercent ? `<span class="daily-value">${subPercent}%*</span>` : ''}
                </span>
            `;
            sectionDiv.appendChild(subDiv);
        });
    }

    return sectionDiv;
}

// ============================================
// Environmental Badge Style
// ============================================

function renderProductBadgeStyle(profileObject, quantity = 1, verbosity = "medium") {
    const div = document.createElement("div");
    div.className = "eco-badge-label product-label badge-style";

    const declaredUnit = profileObject.declaredUnit || "unit";
    const category = profileObject.category || "";
    const categoryLink = category ? `<a href="${getCategoryLinkPrefix()}#layout=product&cat=${category}" class="category-link">${category.replace(/_/g, ' ')}</a>` : "";

    // Get primary GWP for the main badge
    const primaryGWP = profileObject.sections.find(s =>
        s.name.toLowerCase().includes("global warming") && s.primary
    );
    const gwpValue = primaryGWP ? primaryGWP.value * quantity : 0;
    const rating = getImpactRating(gwpValue, "gwp");

    // Header with product name above eco score badge
    div.innerHTML = `
        <div class="category-header">
            <div class="category-header-left">${categoryLink || ""}</div>
            <div class="category-header-right"></div>
        </div>
        <div class="eco-badge-header-vertical">
            <div class="product-info">
                <div class="product-name">${profileObject.itemName || "Product"}</div>
                <div class="declared-unit">Per ${quantity > 1 ? quantity + " " : ""}${declaredUnit}</div>
            </div>
            <hr class="badge-divider">
            <div class="eco-score-badge" style="background-color: ${rating.color}">
                <div class="score-value">${formatValue(gwpValue, "gwp", 1)}</div>
                <div class="score-unit">kgCO2e</div>
                <div class="score-label">${rating.label}</div>
            </div>
        </div>
    `;

    // Impact breakdown section
    const breakdownDiv = document.createElement("div");
    breakdownDiv.className = "eco-breakdown";

    // Filter sections based on verbosity
    const sectionsToShow = filterSectionsByVerbosity(profileObject.sections, verbosity);

    sectionsToShow.forEach(section => {
        const metricDiv = renderBadgeMetric(section, quantity);
        breakdownDiv.appendChild(metricDiv);
    });

    div.appendChild(breakdownDiv);

    const headerRight = div.querySelector(".category-header-right");
    if (headerRight && typeof createStyleToggle === "function") {
        headerRight.appendChild(createStyleToggle((newSettings) => {
            const container = document.getElementById("product-label");
            if (container) {
                reRenderProductLabel(profileObject, profileObject.rawData || {}, container, newSettings);
            }
        }));
    }

    // Composition section (if available)
    if (profileObject.composition && profileObject.composition.length > 0 && verbosity !== "simple") {
        const compositionDiv = document.createElement("div");
        compositionDiv.className = "eco-composition";
        compositionDiv.innerHTML = `<div class="composition-title">Material Composition</div>`;

        const barsDiv = document.createElement("div");
        barsDiv.className = "composition-bars";

        profileObject.composition.forEach(material => {
            const barDiv = document.createElement("div");
            barDiv.className = "composition-item";
            barDiv.innerHTML = `
                <div class="material-name">${material.name}</div>
                <div class="material-bar-wrapper">
                    <div class="material-bar" style="width: ${material.percent}%; background-color: ${getMaterialColor(material.name)}"></div>
                </div>
                <div class="material-percent">${material.percent.toFixed(1)}%</div>
            `;
            barsDiv.appendChild(barDiv);
        });

        compositionDiv.appendChild(barsDiv);
        div.appendChild(compositionDiv);
    }

    // Percentile comparison (if available)
    if (profileObject.percentiles && verbosity === "detailed") {
        const percentileDiv = renderPercentileChart(profileObject);
        div.appendChild(percentileDiv);
    }

    return div;
}

function renderBadgeMetric(section, quantity) {
    const val = section.value * quantity;
    const unit = section.unit || "";
    const rating = section.metricType ? getImpactRating(val, section.metricType) : null;

    const metricDiv = document.createElement("div");
    metricDiv.className = "eco-metric";

    const isPrimary = section.primary;

    if (isPrimary && rating) {
        metricDiv.innerHTML = `
            <div class="metric-header">
                <span class="metric-name">${section.name}</span>
                <span class="metric-indicator" style="background-color: ${rating.color}"></span>
            </div>
            <div class="metric-value-row">
                <span class="metric-value">${formatValue(val, section.name, 2)}</span>
                <span class="metric-unit">${unit}</span>
            </div>
            ${section.subsections && section.subsections.length > 0 ? renderBadgeSubmetrics(section.subsections, quantity) : ''}
        `;
    } else {
        metricDiv.innerHTML = `
            <div class="metric-row">
                <span class="metric-name">${section.name}</span>
                <span class="metric-value">${formatValue(val, section.name, 2)}${unit}</span>
            </div>
            ${section.subsections && section.subsections.length > 0 ? renderBadgeSubmetrics(section.subsections, quantity) : ''}
        `;
    }

    return metricDiv;
}

function renderBadgeSubmetrics(subsections, quantity) {
    let html = '<div class="submetrics">';
    subsections.forEach(sub => {
        const val = sub.value * quantity;
        const unit = sub.unit || "";
        html += `
            <div class="submetric-row">
                <span class="submetric-name">${sub.name}</span>
                <span class="submetric-value">${formatValue(val, sub.name, 2)}${unit}</span>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function renderPercentileChart(profileObject) {
    const div = document.createElement("div");
    div.className = "percentile-chart";

    const percentiles = profileObject.percentiles || {};
    const currentGWP = profileObject.sections.find(s => s.name.toLowerCase().includes("global warming") && s.primary)?.value || 0;

    // Find where current value falls
    let currentPercentile = 50;
    if (percentiles.p10 && currentGWP <= percentiles.p10) currentPercentile = 10;
    else if (percentiles.p20 && currentGWP <= percentiles.p20) currentPercentile = 20;
    else if (percentiles.p50 && currentGWP <= percentiles.p50) currentPercentile = 50;
    else if (percentiles.p90 && currentGWP <= percentiles.p90) currentPercentile = 90;
    else currentPercentile = 95;

    const rating = getPercentileRating(currentPercentile);

    div.innerHTML = `
        <div class="percentile-title">Category Comparison</div>
        <div class="percentile-bar-container">
            <div class="percentile-bar">
                <div class="percentile-marker" style="left: ${currentPercentile}%; background-color: ${rating.color}"></div>
                <div class="percentile-zones">
                    <div class="zone excellent" style="width: 20%"></div>
                    <div class="zone good" style="width: 20%"></div>
                    <div class="zone average" style="width: 20%"></div>
                    <div class="zone below" style="width: 20%"></div>
                    <div class="zone poor" style="width: 20%"></div>
                </div>
            </div>
            <div class="percentile-labels">
                <span>Better</span>
                <span>Worse</span>
            </div>
        </div>
        <div class="percentile-result" style="color: ${rating.color}">
            This product is in the <strong>${rating.label}</strong> for its category
        </div>
    `;

    return div;
}

// ============================================
// Utility Functions
// ============================================

function filterSectionsByVerbosity(sections, verbosity) {
    if (!sections) return [];

    switch (verbosity) {
        case "simple":
            // Only primary metrics
            return sections.filter(s => s.primary);

        case "medium":
            // Primary + important secondary metrics
            return sections.filter(s => s.primary || s.importance === "high" || s.importance === "medium");

        case "detailed":
        default:
            // All metrics
            return sections;
    }
}

function getMaterialColor(materialName) {
    const name = materialName.toLowerCase();
    if (name.includes("wool") || name.includes("cotton") || name.includes("natural")) return "#22c55e";
    if (name.includes("recycled")) return "#84cc16";
    if (name.includes("polyester") || name.includes("plastic") || name.includes("synthetic")) return "#f59e0b";
    if (name.includes("metal") || name.includes("steel") || name.includes("aluminum")) return "#6366f1";
    if (name.includes("concrete") || name.includes("cement")) return "#94a3b8";
    return "#8b5cf6";
}

// ============================================
// Product Calculator with Unit Dropdown
// ============================================

function setupProductCalculator(epdData, profileObject, parentEl) {
    const container = parentEl || document.getElementById("product-label");
    if (!container) return;

    const settings = typeof getLabelSettings === "function" ? getLabelSettings() : { calculatorUnit: "declared" };

    const baseGwp = parseNumeric(epdData.gwp);
    const massPerUnit = parseNumeric(epdData.mass_per_declared_unit);
    const declaredUnit = epdData.declared_unit || epdData.category_declared_unit || "unit";
    const pricePerUnit = parseNumeric(epdData.price_per_unit) || 100; // Default price if not specified

    if (!isFinite(baseGwp)) return;

    const wrapper = document.createElement("div");
    wrapper.className = "product-calculator";
    wrapper.innerHTML = `
        <div class="calculator-header">
            <span class="calculator-title">Impact Calculator</span>
        </div>
        <div class="calculator-controls">
            <div class="calc-row">
                <label>Quantity:</label>
                <input type="number" class="quantity-input" value="1" min="0.1" step="0.1">
            </div>
            <div class="calc-row">
                <label>Calculate per:</label>
                <select class="unit-select">
                    <option value="declared" ${settings.calculatorUnit === 'declared' ? 'selected' : ''}>Declared Unit (${declaredUnit})</option>
                    <option value="per_kg" ${settings.calculatorUnit === 'per_kg' ? 'selected' : ''}>Per Kg</option>
                    <option value="per_1000" ${settings.calculatorUnit === 'per_1000' ? 'selected' : ''}>Per $1000</option>
                </select>
            </div>
        </div>
        <div class="calculator-results"></div>
    `;

    container.appendChild(wrapper);

    const quantityInput = wrapper.querySelector(".quantity-input");
    const unitSelect = wrapper.querySelector(".unit-select");
    const resultsDiv = wrapper.querySelector(".calculator-results");

    function recalculate() {
        const qty = parseFloat(quantityInput.value) || 1;
        const unit = unitSelect.value;

        let adjustedGwp = baseGwp;
        let unitLabel = declaredUnit;

        switch (unit) {
            case "per_kg":
                if (isFinite(massPerUnit) && massPerUnit > 0) {
                    adjustedGwp = baseGwp / massPerUnit;
                    unitLabel = "kg";
                }
                break;
            case "per_1000":
                if (pricePerUnit > 0) {
                    adjustedGwp = (baseGwp / pricePerUnit) * 1000;
                    unitLabel = "$1000";
                }
                break;
            default:
                unitLabel = declaredUnit;
        }

        const totalGwp = adjustedGwp * qty;

        resultsDiv.innerHTML = `
            <div class="result-row primary">
                <span class="result-label">Total GWP:</span>
                <span class="result-value">${formatKg(totalGwp)} kgCO2e</span>
            </div>
            <div class="result-row">
                <span class="result-label">Per ${unitLabel}:</span>
                <span class="result-value">${formatKg(adjustedGwp)} kgCO2e</span>
            </div>
            ${isFinite(massPerUnit) && unit === "declared" ? `
            <div class="result-row">
                <span class="result-label">Total Mass:</span>
                <span class="result-value">${formatKg(massPerUnit * qty)} kg</span>
            </div>
            ` : ''}
        `;

        // Save unit preference
        if (typeof updateLabelSetting === "function") {
            updateLabelSetting("calculatorUnit", unit);
        }
    }

    quantityInput.addEventListener("input", recalculate);
    unitSelect.addEventListener("change", recalculate);

    recalculate();

    return wrapper;
}

// ============================================
// Travel Distance Calculator (Enhanced)
// ============================================

function setupTravelDistanceCalculatorEnhanced(epdData, parentEl) {
    const container = parentEl || document.getElementById("product-label");
    if (!container) return;

    const baseGwp = parseNumeric(epdData.gwp);
    const massPerDeclaredUnit = parseNumeric(epdData.mass_per_declared_unit);
    const defaultDistance = epdData.category
        ? parseNumeric(epdData.category.default_distance)
        : NaN;

    if (!isFinite(baseGwp) || !isFinite(massPerDeclaredUnit) || !isFinite(defaultDistance)) {
        return;
    }

    const EMISSION_FACTOR = 0.062;

    const wrapper = document.createElement("div");
    wrapper.className = "travel-calculator";
    wrapper.innerHTML = `
        <div class="calculator-header">
            <span class="calculator-title">Transportation Impact (A4)</span>
        </div>
        <div class="calculator-controls">
            <div class="calc-row">
                <label>Travel distance (km):</label>
                <input type="number" class="distance-input" value="${defaultDistance.toFixed(0)}" min="0" step="10">
            </div>
        </div>
        <div class="travel-results"></div>
        <div class="calculator-note">
            Emission factor: 0.062 kgCO2e/ton-km (truck transport)
        </div>
    `;

    container.appendChild(wrapper);

    const distanceInput = wrapper.querySelector(".distance-input");
    const resultsDiv = wrapper.querySelector(".travel-results");

    function recalc() {
        const d = Math.max(0, parseFloat(distanceInput.value) || 0);

        const defaultA4 = (defaultDistance * massPerDeclaredUnit * EMISSION_FACTOR) / 1000;
        const actualA4 = (d * massPerDeclaredUnit * EMISSION_FACTOR) / 1000;
        const adjustedGwp = baseGwp + (actualA4 - defaultA4);
        const savings = defaultA4 - actualA4;

        resultsDiv.innerHTML = `
            <div class="result-row">
                <span class="result-label">Base GWP (A1-A3):</span>
                <span class="result-value">${formatKg(baseGwp)} kgCO2e</span>
            </div>
            <div class="result-row">
                <span class="result-label">Default transport (${defaultDistance.toFixed(0)} km):</span>
                <span class="result-value">${formatKg(defaultA4)} kgCO2e</span>
            </div>
            <div class="result-row">
                <span class="result-label">Your transport (${d.toFixed(0)} km):</span>
                <span class="result-value">${formatKg(actualA4)} kgCO2e</span>
            </div>
            <div class="result-row primary">
                <span class="result-label">Adjusted Total (A1-A4):</span>
                <span class="result-value">${formatKg(adjustedGwp)} kgCO2e</span>
            </div>
            <div class="result-row ${savings >= 0 ? 'savings' : 'increase'}">
                <span class="result-label">${savings >= 0 ? 'Savings' : 'Increase'} vs default:</span>
                <span class="result-value">${formatKg(Math.abs(savings))} kgCO2e</span>
            </div>
        `;
    }

    distanceInput.addEventListener("input", recalc);
    recalc();

    return wrapper;
}

// ============================================
// Main Product Label Loader
// ============================================

async function loadProductLabel(region, category, file, container) {
    if (!container) container = document.getElementById("product-label");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading product data...</div>';

    try {
        const yamlText = await fetchText(file.download_url);
        const data = jsyaml.load(yamlText);

        const profile = createProductProfileObject(data);

        container.innerHTML = "";

        // Main label
        const label = renderProductLabel(profile, 1);
        container.appendChild(label);

        // Calculators
        setupProductCalculator(data, profile, container);
        setupTravelDistanceCalculatorEnhanced(data, container);

    } catch (e) {
        console.error("Error loading product label:", e);
        container.innerHTML = '<div class="error">Error loading product data. Please try again.</div>';
    }
}

// ============================================
// Text Formatting Utilities
// ============================================

function cleanText(text) {
    if (!text || typeof text !== "string") return text;
    return text
        .replace(/\\u2019/g, "'")
        .replace(/\\u201c/g, '"')
        .replace(/\\u201d/g, '"')
        .replace(/\\u2026/g, "...")
        .replace(/\\u00ae/g, "\u00ae")
        .replace(/\\u00a0/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\\\\/g, "")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

// ============================================
// OpenEPD Category Breadcrumb
// ============================================

function renderCategoryBreadcrumb(data) {
    const div = document.createElement("div");
    div.className = "product-title-holder";

    const hash = (typeof getHash === "function") ? getHash() : getUrlHash();
    const hashCategory = hash && hash.cat ? hash.cat : "";
    const displayName = cleanText(data.category?.display_name || "");
    const categoryLabel = displayName || (hashCategory ? hashCategory.replace(/_/g, " ") : "");

    const productName = cleanText(data.name || data.product_name || "");

    if (!categoryLabel) {
        div.style.display = "none";
        return div;
    }

    const catValue = categoryLabel.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const countryParam = hash && hash.country ? `&country=${hash.country}` : "";
    const titleContent = `
        <a href="#layout=product${countryParam}&cat=${catValue}" class="product-title breadcrumb-link">${categoryLabel}</a><br>
        ${productName ? `<span class="product-title current" style="font-size: 1.3em; font-weight: 500;">${productName}</span>` : ""}
    `;

    div.innerHTML = `
        <div style="flex: 1;">${titleContent}</div>
        <button class="circular-close-btn" aria-label="Close" title="Close" onclick="if(typeof goHash === 'function') goHash({}, 'id');">
            <i class="material-icons">cancel</i>
        </button>
    `;

    return div;
}

// ============================================
// Info Icon Tooltip Helper
// ============================================

function createInfoIcon(tooltipText, tooltipId) {
    const id = tooltipId || 'tooltip-' + Math.random().toString(36).substr(2, 9);
    return `<span class="info-icon" data-tooltip-id="${id}" aria-label="More information">
        <span class="info-icon-symbol">ⓘ</span>
        <span class="info-tooltip" id="${id}">${tooltipText}</span>
    </span>`;
}

// Tooltip definitions for various metrics
const METRIC_TOOLTIPS = {
    gwp: "Global Warming Potential (GWP) measures the total greenhouse gas emissions in kgCO2e. This includes all emissions from raw material extraction (A1), transport to factory (A2), and manufacturing (A3).",
    gwp_z: "Z-score indicates how this product compares to the category average. Negative values are better than average, positive values are worse. A Z-score of -1 means the product is 1 standard deviation below (better than) average.",
    percentile: "Percentiles show the distribution of GWP across all products in this category. The 10th percentile means only 10% of products have lower emissions (better). The 90th percentile means 90% of products have lower emissions.",
    uncertainty: "Uncertainty-adjusted values account for data quality and measurement variability. Conservative estimates assume worst-case scenarios; best practice assumes optimal conditions.",
    biogenic_carbon: "Biogenic carbon is CO2 absorbed by plants during growth. Products with high biogenic carbon (like wood) can store carbon, partially offsetting emissions.",
    transport_a4: "A4 stage covers transportation from factory to construction site. The base GWP only includes A1-A3 (cradle-to-gate). Actual transport distance affects total lifecycle emissions.",
    declared_unit: "The declared unit is the standard measurement basis for comparing products in this category (e.g., 1 m², 1 kg, 1000 sf).",
    carbon_intensity: "Grid electricity carbon intensity varies by location. Manufacturing in regions with cleaner grids results in lower product emissions.",
    pct10: "10th percentile - Only 10% of products in this category have lower GWP. This represents best-in-class performance.",
    pct50: "50th percentile (median) - Half of products have higher GWP, half have lower. This represents typical category performance.",
    pct90: "90th percentile - 90% of products have lower GWP. Products above this are among the highest emitters in the category."
};

// ============================================
// Industry Benchmark Percentile Chart (Full)
// ============================================

function renderPercentileBarChart(data) {
    const div = document.createElement("div");
    div.className = "percentile-bar-chart";

    // Extract all percentile values (pct10 through pct90) - check category too
    const percentileData = [
        { pct: 10, value: toNumber(data.gwp_per_category_declared_unit_10p) || toNumber(data.pct10_gwp) || toNumber(data.category && data.category.pct10_gwp) },
        { pct: 20, value: toNumber(data.gwp_per_category_declared_unit_20p) || toNumber(data.pct20_gwp) || toNumber(data.category && data.category.pct20_gwp) },
        { pct: 30, value: toNumber(data.gwp_per_category_declared_unit_30p) || toNumber(data.pct30_gwp) || toNumber(data.category && data.category.pct30_gwp) },
        { pct: 40, value: toNumber(data.gwp_per_category_declared_unit_40p) || toNumber(data.pct40_gwp) || toNumber(data.category && data.category.pct40_gwp) },
        { pct: 50, value: toNumber(data.gwp_per_category_declared_unit_50p) || toNumber(data.pct50_gwp) || toNumber(data.category && data.category.pct50_gwp) },
        { pct: 60, value: toNumber(data.gwp_per_category_declared_unit_60p) || toNumber(data.pct60_gwp) || toNumber(data.category && data.category.pct60_gwp) },
        { pct: 70, value: toNumber(data.gwp_per_category_declared_unit_70p) || toNumber(data.pct70_gwp) || toNumber(data.category && data.category.pct70_gwp) },
        { pct: 80, value: toNumber(data.gwp_per_category_declared_unit_80p) || toNumber(data.pct80_gwp) || toNumber(data.category && data.category.pct80_gwp) },
        { pct: 90, value: toNumber(data.gwp_per_category_declared_unit_90p) || toNumber(data.pct90_gwp) || toNumber(data.category && data.category.pct90_gwp) }
    ].filter(p => p.value !== null);

    const currentGwp = toNumber(data.gwp) || toNumber(data.gwp_per_category_declared_unit);
    const gwpZ = toNumber(data.gwp_z);

    if (percentileData.length === 0) {
        div.style.display = "none";
        return div;
    }

    const maxVal = Math.max(...percentileData.map(p => p.value), currentGwp || 0) * 1.1;

    // Color gradient from green to red
    const getPercentileColor = (pct) => {
        if (pct <= 20) return "#22c55e";
        if (pct <= 40) return "#84cc16";
        if (pct <= 60) return "#f59e0b";
        if (pct <= 80) return "#f97316";
        return "#ef4444";
    };

    // Determine where current product falls in percentiles
    let productPercentile = "N/A";
    if (currentGwp) {
        for (let i = 0; i < percentileData.length; i++) {
            if (currentGwp <= percentileData[i].value) {
                productPercentile = `≤${percentileData[i].pct}th`;
                break;
            }
        }
        if (productPercentile === "N/A" && percentileData.length > 0) {
            productPercentile = `>${percentileData[percentileData.length - 1].pct}th`;
        }
    }

    // Function to calculate marker position
    const getProductMarkerPosition = (gwp, data) => {
        if (!gwp || data.length === 0) return 0;

        // Find which percentiles the product falls between
        for (let i = 0; i < data.length - 1; i++) {
            if (gwp >= data[i].value && gwp <= data[i + 1].value) {
                // Interpolate position between these two bars
                const barWidth = 100 / (data.length + 1); // +1 for spacing
                const basePosition = (i + 0.5) * barWidth;
                const range = data[i + 1].value - data[i].value;
                const offset = ((gwp - data[i].value) / range) * barWidth;
                return basePosition + offset;
            }
        }

        // If below first percentile
        if (gwp < data[0].value) {
            return (100 / (data.length + 1)) * 0.5 * (gwp / data[0].value);
        }

        // If above last percentile
        return 100 - (100 / (data.length + 1)) * 0.5;
    };

    div.innerHTML = `
        <div class="chart-header">
            <h4>Industry Benchmark Percentiles ${createInfoIcon(METRIC_TOOLTIPS.percentile, 'tip-percentile')}</h4>
            <span class="chart-subtitle">GWP distribution across category (kgCO2e per declared unit)</span>
        </div>

        ${gwpZ !== null ? `
        <div class="zscore-indicator zscore-behind-bars">
            <div class="zscore-left">
                <span class="zscore-label">Z-Score ${createInfoIcon(METRIC_TOOLTIPS.gwp_z, 'tip-zscore')}</span>
                <span class="zscore-value ${gwpZ < 0 ? 'better' : gwpZ > 0 ? 'worse' : 'average'}">${gwpZ > 0 ? '+' : ''}${gwpZ.toFixed(2)}</span>
            </div>
            <span class="zscore-desc">${gwpZ < -0.5 ? 'Better than average' : gwpZ > 0.5 ? 'Worse than average' : 'Near average'}</span>
        </div>
        ` : ''}

        <div class="vertical-bar-chart-wrapper">
            <div class="vertical-bar-chart">
                ${percentileData.map(p => `
                    <div class="vertical-bar-column">
                        <span class="vertical-bar-value">${p.value.toFixed(0)}</span>
                        <div class="vertical-bar" style="height: ${(p.value / maxVal) * 200}px; background-color: ${getPercentileColor(p.pct)}"></div>
                        <span class="vertical-bar-label">${p.pct}th</span>
                    </div>
                `).join('')}
            </div>
            ${currentGwp ? `
                <div class="product-marker" style="left: ${getProductMarkerPosition(currentGwp, percentileData)}%;">
                    <div class="marker-line" style="height: ${(currentGwp / maxVal) * 200 + 30}px;"></div>
                    <div class="marker-label">
                        <span class="marker-value">${currentGwp.toFixed(0)}</span>
                        <span class="marker-text">This Product (${productPercentile})</span>
                    </div>
                </div>
            ` : ''}
        </div>

        <div class="chart-note">
            <small><strong>Note:</strong> The 90th percentile indicates that 90% of products perform at or below this level, while the remaining 10% have higher environmental impact. A 100th percentile value would simply be the maximum observed in the dataset and is less useful for comparison than the 90th percentile benchmark.</small>
        </div>
        <div class="chart-legend">
            <span class="legend-item"><span class="legend-color" style="background:#22c55e"></span>Best (10-20th)</span>
            <span class="legend-item"><span class="legend-color" style="background:#f59e0b"></span>Average (40-60th)</span>
            <span class="legend-item"><span class="legend-color" style="background:#ef4444"></span>Worst (80-90th)</span>
        </div>
    `;

    return div;
}

// ============================================
// Boxplot Chart
// ============================================

function renderBoxplotChart(data) {
    const div = document.createElement("div");
    div.className = "boxplot-chart-section";

    // Extract all percentile values - check both top level and category
    const percentileData = [
        { pct: 10, value: toNumber(data.pct10_gwp || (data.category && data.category.pct10_gwp)) },
        { pct: 20, value: toNumber(data.pct20_gwp || (data.category && data.category.pct20_gwp)) },
        { pct: 30, value: toNumber(data.pct30_gwp || (data.category && data.category.pct30_gwp)) },
        { pct: 40, value: toNumber(data.pct40_gwp || (data.category && data.category.pct40_gwp)) },
        { pct: 50, value: toNumber(data.pct50_gwp || (data.category && data.category.pct50_gwp)) },
        { pct: 60, value: toNumber(data.pct60_gwp || (data.category && data.category.pct60_gwp)) },
        { pct: 70, value: toNumber(data.pct70_gwp || (data.category && data.category.pct70_gwp)) },
        { pct: 80, value: toNumber(data.pct80_gwp || (data.category && data.category.pct80_gwp)) },
        { pct: 90, value: toNumber(data.pct90_gwp || (data.category && data.category.pct90_gwp)) }
    ].filter(p => p.value !== null);

    if (percentileData.length === 0) {
        div.style.display = "none";
        return div;
    }

    const values = percentileData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const q1 = percentileData.find(p => p.pct === 20)?.value || min;
    const median = percentileData.find(p => p.pct === 50)?.value || ((min + max) / 2);
    const q3 = percentileData.find(p => p.pct === 80)?.value || max;

    const currentGwp = toNumber(data.gwp) || toNumber(data.gwp_per_category_declared_unit);
    const gwpPerKg = toNumber(data.gwp_per_kg);

    const range = max - min;
    const chartMin = min - (range * 0.1);
    const chartMax = max + (range * 0.1);
    const chartRange = chartMax - chartMin;

    // Calculate positions as percentages
    const getPosition = (val) => ((val - chartMin) / chartRange) * 100;

    const categoryName = data.category?.name || data.category_name || "Category";
    const productName = data.name || data.product_name || "This Product";

    div.innerHTML = `
        <div class="chart-header">
            <h3>Greenhouse Warming Potential (GWP)</h3>
            ${currentGwp ? `
                <div style="margin-top: 8px; margin-bottom: 12px;">
                    <div style="font-size: 0.9em; color: #64748b;">All ${categoryName} products compared to</div>
                    <div style="font-size: 1.05em; font-weight: 600; color: #22c55e;">${productName}</div>
                </div>
            ` : ''}
        </div>

        <div class="boxplot-container">
            <svg class="boxplot-svg-combined" viewBox="0 0 500 130" preserveAspectRatio="xMidYMid meet">

                <!-- All Products Boxplot -->
                <!-- Whisker line (min to max) -->
                <line x1="${getPosition(min) * 4.6 + 20}" y1="70"
                      x2="${getPosition(max) * 4.6 + 20}" y2="70"
                      stroke="#666" stroke-width="2"/>

                <!-- Min whisker -->
                <line x1="${getPosition(min) * 4.6 + 20}" y1="55"
                      x2="${getPosition(min) * 4.6 + 20}" y2="85"
                      stroke="#666" stroke-width="2"/>

                <!-- Max whisker -->
                <line x1="${getPosition(max) * 4.6 + 20}" y1="55"
                      x2="${getPosition(max) * 4.6 + 20}" y2="85"
                      stroke="#666" stroke-width="2"/>

                <!-- Box (Q1 to Q3) -->
                <rect x="${getPosition(q1) * 4.6 + 20}" y="45"
                      width="${(getPosition(q3) - getPosition(q1)) * 4.6}" height="50"
                      fill="#3b82f6" fill-opacity="0.3" stroke="#3b82f6" stroke-width="2"/>

                <!-- Median line -->
                <line x1="${getPosition(median) * 4.6 + 20}" y1="45"
                      x2="${getPosition(median) * 4.6 + 20}" y2="95"
                      stroke="#ef4444" stroke-width="3"/>

                <!-- Category Labels -->
                <text x="${getPosition(min) * 4.6 + 20}" y="110" text-anchor="middle" font-size="11" fill="#666">
                    ${min.toFixed(0)}
                </text>
                <text x="${getPosition(q1) * 4.6 + 20}" y="35" text-anchor="middle" font-size="11" fill="#666">
                    Q1: ${q1.toFixed(0)}
                </text>
                <text x="${getPosition(median) * 4.6 + 20}" y="35" text-anchor="middle" font-size="11" fill="#ef4444" font-weight="bold">
                    Median: ${median.toFixed(0)}
                </text>
                <text x="${getPosition(q3) * 4.6 + 20}" y="35" text-anchor="middle" font-size="11" fill="#666">
                    Q3: ${q3.toFixed(0)}
                </text>
                <text x="${getPosition(max) * 4.6 + 20}" y="110" text-anchor="middle" font-size="11" fill="#666">
                    ${max.toFixed(0)}
                </text>

                ${currentGwp && currentGwp >= chartMin && currentGwp <= chartMax ? `
                <!-- Product value line (overlapping boxplot) -->
                <line x1="${getPosition(currentGwp) * 4.6 + 20}" y1="45"
                      x2="${getPosition(currentGwp) * 4.6 + 20}" y2="95"
                      stroke="#22c55e" stroke-width="4"/>

                <!-- Product marker -->
                <circle cx="${getPosition(currentGwp) * 4.6 + 20}" cy="70" r="8"
                        fill="#22c55e" stroke="#fff" stroke-width="2"/>

                <!-- Value label -->
                <text x="${getPosition(currentGwp) * 4.6 + 20}" y="110" text-anchor="middle" font-size="12" fill="#22c55e" font-weight="bold">
                    ${currentGwp.toFixed(0)} kgCO2e
                </text>
                ` : ''}
            </svg>
        </div>

        <div class="chart-subtitle" style="margin-top: 8px; font-size: 0.85em; color: #64748b; font-style: italic;">
            Average heat impact of atmosphere pollutants equivalent CO<sub>2</sub> over 100 years.
        </div>

        <div class="boxplot-legend">
            <div class="legend-row">
                <span class="legend-item"><span class="legend-box" style="background:#3b82f6;opacity:0.3;border:2px solid #3b82f6"></span>Interquartile Range (Q1-Q3)</span>
                <span class="legend-item"><span class="legend-line" style="background:#ef4444"></span>Median (50th percentile)</span>
            </div>
        </div>
    `;

    return div;
}

// ============================================
// Carbon Storage & Biogenic Carbon
// ============================================

function renderCarbonStorageSection(data) {
    const div = document.createElement("div");
    div.className = "carbon-storage-section";

    const biogenicZ = toNumber(data.biogenic_embodied_carbon_z);
    const storedCarbonZ = toNumber(data.stored_carbon_z);
    const useStoredCarbon = data.use_stored_carbon;
    const biogenicCarbon = toNumber(data.biogenic_embodied_carbon);

    if (biogenicZ === null && storedCarbonZ === null && biogenicCarbon === null) {
        div.style.display = "none";
        return div;
    }

    div.innerHTML = `
        <div class="section-header">
            <h4>Carbon Storage ${createInfoIcon(METRIC_TOOLTIPS.biogenic_carbon, 'tip-biogenic')}</h4>
        </div>
        <div class="carbon-metrics">
            ${biogenicCarbon !== null ? `
                <div class="carbon-metric">
                    <span class="metric-label">Biogenic Carbon</span>
                    <span class="metric-value">${biogenicCarbon.toFixed(4)} kgCO2e</span>
                </div>
            ` : ''}
            ${biogenicZ !== null ? `
                <div class="carbon-metric">
                    <span class="metric-label">Biogenic Carbon Z-Score</span>
                    <span class="metric-value ${biogenicZ > 0 ? 'positive' : 'negative'}">${biogenicZ > 0 ? '+' : ''}${biogenicZ.toFixed(4)}</span>
                    <span class="metric-desc">${biogenicZ > 0 ? 'Above average carbon storage' : 'Below average carbon storage'}</span>
                </div>
            ` : ''}
            ${storedCarbonZ !== null ? `
                <div class="carbon-metric">
                    <span class="metric-label">Stored Carbon Z-Score</span>
                    <span class="metric-value ${storedCarbonZ > 0 ? 'positive' : 'negative'}">${storedCarbonZ > 0 ? '+' : ''}${storedCarbonZ.toFixed(4)}</span>
                </div>
            ` : ''}
            ${useStoredCarbon !== undefined ? `
                <div class="carbon-metric">
                    <span class="metric-label">Stored Carbon Included</span>
                    <span class="metric-value">${useStoredCarbon ? 'Yes' : 'No'}</span>
                </div>
            ` : ''}
        </div>
    `;

    return div;
}

// ============================================
// Missing Impact Categories Warning
// ============================================

function renderMissingImpacts(data) {
    const div = document.createElement("div");
    div.className = "missing-impacts-section";

    // Check which impact categories are missing
    const impacts = [
        { key: "odp", name: "Ozone Depletion (ODP)", value: data.odp || data.ozone_depletion },
        { key: "ap", name: "Acidification (AP)", value: data.ap || data.acidification },
        { key: "ep_fresh", name: "Freshwater Eutrophication", value: data.ep_fresh || data.eutrophication_fresh },
        { key: "ep_marine", name: "Marine Eutrophication", value: data.ep_marine || data.eutrophication_marine },
        { key: "ep_terrestrial", name: "Terrestrial Eutrophication", value: data.ep_terrestrial },
        { key: "pocp", name: "Smog Formation (POCP)", value: data.pocp || data.smog_formation }
    ];

    const available = impacts.filter(i => i.value !== undefined && i.value !== null);
    const missing = impacts.filter(i => i.value === undefined || i.value === null);

    // Only show if there are missing impacts
    if (missing.length === 0) {
        div.style.display = "none";
        return div;
    }

    div.innerHTML = `
        <div class="section-header">
            <h4>Environmental Impact Coverage ${createInfoIcon("EPDs may not include all environmental impact categories. GWP (carbon footprint) is the most commonly reported metric.", 'tip-impacts')}</h4>
        </div>
        <div class="impacts-coverage">
            <div class="coverage-bar">
                <div class="coverage-fill" style="width: ${(available.length / impacts.length) * 100}%"></div>
            </div>
            <span class="coverage-text">${available.length} of ${impacts.length} impact categories reported</span>
        </div>
        ${available.length > 0 ? `
            <div class="impacts-list available">
                <span class="list-label">Available:</span>
                ${available.map(i => `<span class="impact-tag available">${i.name}</span>`).join('')}
            </div>
        ` : ''}
        <div class="impacts-list missing">
            <span class="list-label">Not reported:</span>
            ${missing.map(i => `<span class="impact-tag missing">${i.name}</span>`).join('')}
        </div>
    `;

    return div;
}

// ============================================
// Production Locations
// ============================================

function renderProductionLocations(data) {
    const div = document.createElement("div");
    div.className = "production-locations";

    const locations = [];

    // Extract plant/manufacturing location
    if (data.plant_or_group) {
        const plant = data.plant_or_group;
        locations.push({
            type: "Manufacturing Plant",
            name: cleanText(plant.name || plant.plant_name || ""),
            address: cleanText(plant.address || ""),
            city: cleanText(plant.city || ""),
            state: cleanText(plant.state || plant.province || ""),
            country: cleanText(plant.country || ""),
            latitude: plant.latitude || plant.lat,
            longitude: plant.longitude || plant.lng || plant.lon,
            carbonIntensity: toNumber(plant.electricity_carbon_intensity) || toNumber(plant.carbon_intensity),
            owned_by: plant.owned_by
        });
    }

    // Check for plants array
    if (data.plants && Array.isArray(data.plants)) {
        data.plants.forEach(plant => {
            locations.push({
                type: "Manufacturing Plant",
                name: cleanText(plant.name || ""),
                address: cleanText(plant.address || ""),
                city: cleanText(plant.city || ""),
                state: cleanText(plant.state || ""),
                country: cleanText(plant.country || ""),
                latitude: plant.latitude,
                longitude: plant.longitude,
                carbonIntensity: toNumber(plant.electricity_carbon_intensity)
            });
        });
    }

    // Check for geography/location fields
    if (data.geography || data.location) {
        const geo = data.geography || data.location;
        if (typeof geo === "string") {
            locations.push({ type: "Region", name: cleanText(geo) });
        } else if (typeof geo === "object") {
            locations.push({
                type: "Region",
                name: cleanText(geo.name || geo.region || ""),
                country: cleanText(geo.country || "")
            });
        }
    }

    // Manufacturer info
    if (data.manufacturer || data.mfr) {
        const mfr = data.manufacturer || data.mfr;
        if (typeof mfr === "object") {
            locations.push({
                type: "Manufacturer",
                name: cleanText(mfr.name || mfr.legal_name || ""),
                address: cleanText(mfr.address || ""),
                country: cleanText(mfr.country || ""),
                website: mfr.website || mfr.web_url
            });
        }
    }

    if (locations.length === 0) {
        div.style.display = "none";
        return div;
    }

    div.innerHTML = `
        <div class="section-header">
            <h4>Production & Origin ${createInfoIcon("Manufacturing location affects product carbon footprint due to local grid electricity carbon intensity and transportation distances.", 'tip-origin')}</h4>
        </div>
        <div class="locations-grid">
            ${locations.map((loc, index) => `
                <div class="location-card">
                    <div class="location-type">${loc.type}</div>
                    ${loc.name ? `<div class="location-name">${loc.name}</div>` : ''}
                    ${loc.owned_by ? `<div class="location-owner">Owned by: ${formatOwnedBy(loc.owned_by, 'owned-details-' + index)}</div>` : ''}
                    ${loc.address || loc.city || loc.state || loc.country ? `
                        <div class="location-address">
                            ${[loc.address, loc.city, loc.state, loc.country].filter(Boolean).join(", ")}
                        </div>
                    ` : ''}
                    ${loc.carbonIntensity ? `
                        <div class="location-carbon">
                            <span class="carbon-icon">\u26a1</span>
                            Grid: ${loc.carbonIntensity} kgCO2e/MWh
                            ${createInfoIcon(METRIC_TOOLTIPS.carbon_intensity, 'tip-carbon-intensity-' + Math.random().toString(36).substr(2, 5))}
                        </div>
                    ` : ''}
                    ${loc.website ? `
                        <a href="${loc.website}" target="_blank" class="location-link">Website \u2197</a>
                    ` : ''}
                    ${loc.latitude && loc.longitude ? `
                        <a href="https://maps.google.com/?q=${loc.latitude},${loc.longitude}" target="_blank" class="location-link">View Map \u2197</a>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;

    return div;
}

// ============================================
// Material Composition
// ============================================

function renderMaterialComposition(data) {
    const div = document.createElement("div");
    div.className = "material-composition-section";

    const materials = [];

    // Check multiple possible fields for composition
    const sources = [
        data.composition,
        data.materials,
        data.material_composition,
        data.components
    ];

    sources.forEach(source => {
        if (!source) return;

        if (Array.isArray(source)) {
            source.forEach(item => {
                materials.push({
                    name: cleanText(item.name || item.material || item.component || "Unknown"),
                    percent: toNumber(item.percent) || toNumber(item.percentage) || toNumber(item.mass_fraction) * 100,
                    mass: toNumber(item.mass) || toNumber(item.weight),
                    recycled: item.recycled || item.is_recycled,
                    renewable: item.renewable || item.is_renewable
                });
            });
        } else if (typeof source === "object") {
            Object.entries(source).forEach(([name, value]) => {
                if (typeof value === "object") {
                    materials.push({
                        name: cleanText(name),
                        percent: toNumber(value.percent) || toNumber(value.percentage),
                        mass: toNumber(value.mass),
                        recycled: value.recycled,
                        renewable: value.renewable
                    });
                } else {
                    materials.push({
                        name: cleanText(name),
                        percent: toNumber(value)
                    });
                }
            });
        }
    });

    // Also check for packaging info
    if (data.packaging) {
        const pkg = data.packaging;
        if (Array.isArray(pkg)) {
            pkg.forEach(item => {
                materials.push({
                    name: cleanText(item.name || item.material || "Packaging"),
                    percent: toNumber(item.percent),
                    mass: toNumber(item.mass),
                    isPackaging: true
                });
            });
        }
    }

    if (materials.length === 0) {
        div.style.display = "none";
        return div;
    }

    // Sort by percent descending
    materials.sort((a, b) => (b.percent || 0) - (a.percent || 0));

    div.innerHTML = `
        <div class="section-header">
            <h4>Material Composition ${createInfoIcon("Material breakdown shows the components of this product. Recycled and renewable materials generally have lower environmental impact.", 'tip-materials')}</h4>
        </div>
        <div class="composition-table">
            ${materials.map(mat => `
                <div class="composition-row ${mat.isPackaging ? 'packaging' : ''}">
                    <div class="material-info">
                        <span class="material-name">${mat.name}</span>
                        ${mat.recycled ? '<span class="material-badge recycled">\u267b Recycled</span>' : ''}
                        ${mat.renewable ? '<span class="material-badge renewable">\ud83c\udf3f Renewable</span>' : ''}
                        ${mat.isPackaging ? '<span class="material-badge packaging">\ud83d\udce6 Packaging</span>' : ''}
                    </div>
                    <div class="material-stats">
                        ${mat.percent ? `<span class="material-percent">${mat.percent.toFixed(1)}%</span>` : ''}
                        ${mat.mass ? `<span class="material-mass">${mat.mass.toFixed(2)} kg</span>` : ''}
                    </div>
                    ${mat.percent ? `
                        <div class="material-bar-bg">
                            <div class="material-bar-fill" style="width: ${mat.percent}%; background-color: ${getMaterialColor(mat.name)}"></div>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;

    return div;
}

// ============================================
// Certifications & Verification
// ============================================

function renderCertifications(data) {
    const div = document.createElement("div");
    div.className = "certifications-section";

    const certs = [];

    // EPD verification
    if (data.third_party_verified || data.externally_verified) {
        certs.push({
            type: "Third-Party Verified",
            icon: "\u2713",
            details: data.third_party_verifier || data.verifier || ""
        });
    }

    // Program operator
    if (data.program_operator || data.program_operator_name) {
        certs.push({
            type: "Program Operator",
            icon: "\ud83c\udfe2",
            details: cleanText(data.program_operator?.name || data.program_operator_name || "")
        });
    }

    // Standards compliance
    if (data.standard || data.pcr || data.lcia_method) {
        certs.push({
            type: "Standard",
            icon: "\ud83d\udcdc",
            details: cleanText(data.standard || data.pcr?.name || data.lcia_method || "")
        });
    }

    // Validity dates
    const issueDate = data.date_of_issue || data.issue_date;
    const expiryDate = data.date_validity_ends || data.valid_until || data.expiry_date;
    if (issueDate || expiryDate) {
        const formatDate = (d) => {
            if (!d) return "";
            const date = new Date(d);
            return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        };
        certs.push({
            type: "Validity Period",
            icon: "\ud83d\udcc5",
            details: `${formatDate(issueDate)} \u2013 ${formatDate(expiryDate)}`
        });
    }

    // Warnings/flags
    if (data.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
        certs.push({
            type: "Data Warnings",
            icon: "\u26a0\ufe0f",
            details: data.warnings.map(w => cleanText(w.message || w)).join("; "),
            isWarning: true
        });
    }

    if (certs.length === 0) {
        div.style.display = "none";
        return div;
    }

    div.innerHTML = `
        <div class="section-header">
            <h4>Certifications & Verification ${createInfoIcon("Third-party verification ensures EPD data accuracy. Program operators maintain quality standards for environmental claims.", 'tip-certs')}</h4>
        </div>
        <div class="certifications-grid">
            ${certs.map(cert => `
                <div class="cert-card ${cert.isWarning ? 'warning' : ''}">
                    <span class="cert-icon">${cert.icon}</span>
                    <div class="cert-info">
                        <div class="cert-type">${cert.type}</div>
                        ${cert.details ? `<div class="cert-details">${cert.details}</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    return div;
}

// ============================================
// Product Description
// ============================================

function extractImagesFromData(data) {
    const images = [];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

    function isImageUrl(value) {
        if (typeof value !== 'string') return false;
        const lowerValue = value.toLowerCase();
        return imageExtensions.some(ext => lowerValue.endsWith(ext)) ||
               lowerValue.startsWith('http') && imageExtensions.some(ext => lowerValue.includes(ext));
    }

    function searchForImages(obj, depth = 0, path = '') {
        if (depth > 3 || !obj || typeof obj !== 'object') return;

        for (const [key, value] of Object.entries(obj)) {
            const keyLower = key.toLowerCase();
            const currentPath = path ? `${path}.${key}` : key;

            // Check if key contains "image" or "img"
            if (keyLower.includes('image') || keyLower.includes('img')) {
                if (typeof value === 'string' && value) {
                    images.push({ url: value, path: currentPath });
                } else if (Array.isArray(value)) {
                    value.forEach((v, index) => {
                        if (typeof v === 'string' && v) {
                            images.push({ url: v, path: `${currentPath}[${index}]` });
                        }
                    });
                }
            }

            // Check if value looks like an image URL (by extension)
            if (isImageUrl(value)) {
                images.push({ url: value, path: currentPath });
            }

            // Recursively search nested objects
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                searchForImages(value, depth + 1, currentPath);
            }
        }
    }

    searchForImages(data);

    // Remove duplicates based on URL
    const uniqueImages = [];
    const seenUrls = new Set();
    for (const img of images) {
        if (!seenUrls.has(img.url)) {
            seenUrls.add(img.url);
            uniqueImages.push(img);
        }
    }

    return uniqueImages;
}

function formatImageSourcePath(path) {
    if (path.length <= 25) {
        return path;
    }

    // Find the first period
    let firstPeriodIndex = path.indexOf('.');
    if (firstPeriodIndex === -1) return path;

    // Find the second period
    let secondPeriodIndex = path.indexOf('.', firstPeriodIndex + 1);

    // If there's a second period, insert <br> after it
    // Otherwise, insert <br> after the first period
    let breakIndex = secondPeriodIndex !== -1 ? secondPeriodIndex : firstPeriodIndex;

    return path.substring(0, breakIndex + 1) + '<br>' + path.substring(breakIndex + 1);
}

function renderProductDescription(data, priorityImageUrl = null, profileObject = null) {
    const div = document.createElement("div");
    div.className = "product-description-section";

    const description = cleanText(data.description || data.product_description || data.short_description || "");
    const manufacturer = cleanText(data.manufacturer?.name || data.mfr?.name || data.manufacturer_name || "");
    const brand = cleanText(data.brand || data.brand_name || "");

    // Extract all images from data
    let allImages = extractImagesFromData(data);

    // Filter out the priority image if it exists
    if (priorityImageUrl) {
        allImages = allImages.filter(img => img.url !== priorityImageUrl);
    }

    // Build content HTML
    let contentHTML = '';

    // Manufacturer info
    if (manufacturer || brand) {
        contentHTML += '<div class="manufacturer-info">';
        if (manufacturer) contentHTML += `<span class="mfr-name">${manufacturer}</span>`;
        if (brand && brand !== manufacturer) contentHTML += `<span class="brand-name">${brand}</span>`;
        contentHTML += '</div>';
    }

    const galleryImagesRaw = priorityImageUrl
        ? [{ url: priorityImageUrl, path: 'priority_image' }, ...allImages]
        : allImages;
    const seenGalleryImages = new Set();
    const galleryImages = galleryImagesRaw.filter((img) => {
        const key = `${img.url || ""}__${img.path || ""}`;
        if (seenGalleryImages.has(key)) {
            return false;
        }
        seenGalleryImages.add(key);
        return true;
    });
    productImageGalleryList = galleryImages.map((img) => img.url);

    // Description and images in flex layout
    contentHTML += '<div class="description-content">';

    // Left side: description text
    if (description) {
        contentHTML += `<div class="description-text-wrapper"><p class="description-text">${description}</p></div>`;
    }

    // Right side: single image with navigation (if images exist)
    if (allImages.length > 0) {
        const uniqueId = 'img-nav-' + Math.random().toString(36).substr(2, 9);
        div.dataset.imageNavId = uniqueId;
        contentHTML += `
            <div class="description-images-nav" id="${uniqueId}">
                <div class="image-item" data-current-index="0">
                    <img src="${allImages[0].url}" alt="Product image" class="description-image" onerror="this.style.display='none'">
                    <div class="image-source">${formatImageSourcePath(allImages[0].path)}</div>
                </div>
                ${allImages.length > 1 ? `
                    <div class="image-nav-controls">
                        <button class="image-nav-btn image-nav-prev" aria-label="Previous image">‹</button>
                        <span class="image-counter">1 / ${allImages.length}</span>
                        <button class="image-nav-btn image-nav-next" aria-label="Next image">›</button>
                        <button class="view-gallery-btn" aria-label="View all images" title="View all images">⊞</button>
                    </div>
                ` : ''}
            </div>`;
    }

    contentHTML += '</div>';

    // Gallery view (initially hidden)
    if (allImages.length > 0) {
        const preferThreeCol = galleryImages.length % 3 === 0 || galleryImages.length === 5;
        const galleryClass = preferThreeCol ? "image-gallery three-col-prefer" : "image-gallery";
        contentHTML += `
            <div class="${galleryClass}" style="display: none;">
                <div class="gallery-header">
                    <h5>Image Gallery (${galleryImages.length})</h5>
                    <button class="circular-close-btn" aria-label="Close gallery" title="Close gallery">
                        <i class="material-icons">cancel</i>
                    </button>
                </div>
                <div class="gallery-grid">
                    ${galleryImages.map((img, index) => `
                        <div class="gallery-item" data-gallery-index="${index}">
                            <img src="${img.url}" alt="Product image" class="gallery-image" data-gallery-index="${index}" onerror="this.parentElement.style.display='none'">
                            <div class="gallery-image-source">${formatImageSourcePath(img.path)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    div.innerHTML = `
        <div class="section-header">
            <h4>Product Details</h4>
            <div class="section-header-right"></div>
        </div>
        ${contentHTML}
    `;

    const sectionHeaderRight = div.querySelector(".section-header-right");
    if (sectionHeaderRight && typeof createVerbosityToggle === "function" && profileObject) {
        sectionHeaderRight.appendChild(createVerbosityToggle((newSettings) => {
            const container = document.getElementById("product-label");
            if (container && typeof reRenderProductLabel === "function") {
                reRenderProductLabel(profileObject, data, container, newSettings);
            }
        }));
    }

    // Setup image navigation after DOM insertion
    if (allImages.length > 0) {
        const navSelector = div.dataset.imageNavId ? `#${div.dataset.imageNavId}` : null;
        if (typeof waitForElm === "function" && navSelector) {
            waitForElm(navSelector).then(() => {
                setupImageNavigation(div, allImages, galleryImages);
            });
        } else {
            setupImageNavigation(div, allImages, galleryImages);
        }
    }

    // Append additional properties inline at the bottom
    const additionalProps = renderAdditionalPropertiesInline(data);
    if (additionalProps) {
        div.appendChild(additionalProps);
    }

    return div;
}

function setupImageNavigation(container, images, galleryImages = []) {
    if (!images.length) return;

    const navContainer = container.querySelector('.description-images-nav');
    const imageItem = navContainer?.querySelector('.image-item');
    const prevBtn = navContainer?.querySelector('.image-nav-prev');
    const nextBtn = navContainer?.querySelector('.image-nav-next');
    const counter = navContainer?.querySelector('.image-counter');
    const viewGalleryBtn = navContainer?.querySelector('.view-gallery-btn');
    const gallery = container.querySelector('.image-gallery');
    const closeGalleryBtn = container.querySelector('.circular-close-btn');

    if (!navContainer || !imageItem) return;

    let currentIndex = 0;

    function updateImage() {
        const img = images[currentIndex];
        imageItem.innerHTML = `
            <img src="${img.url}" alt="Product image" class="description-image" onerror="this.style.display='none'">
            <div class="image-source">${formatImageSourcePath(img.path)}</div>
        `;
        if (counter) counter.textContent = `${currentIndex + 1} / ${images.length}`;
    }

    function openModalForCurrentImage() {
        if (!galleryImages.length) {
            openProductImageModal(images[currentIndex].url, [images[currentIndex].url], 0);
            return;
        }
        const galleryIndex = galleryImages.findIndex(entry => entry.url === images[currentIndex].url);
        openProductImageModal(
            images[currentIndex].url,
            galleryImages.map(entry => entry.url),
            Math.max(0, galleryIndex)
        );
    }

    if (prevBtn && images.length > 1) {
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            updateImage();
        });
    }

    if (nextBtn && images.length > 1) {
        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % images.length;
            updateImage();
        });
    }

    if (viewGalleryBtn && gallery) {
        viewGalleryBtn.addEventListener('click', () => {
            gallery.style.display = 'block';
            navContainer.style.display = 'none';
        });
    }

    if (closeGalleryBtn && gallery) {
        closeGalleryBtn.addEventListener('click', () => {
            gallery.style.display = 'none';
            navContainer.style.display = 'flex';
        });
    }

    imageItem.addEventListener('click', openModalForCurrentImage);

    if (galleryImages.length && gallery) {
        const galleryItems = gallery.querySelectorAll('.gallery-image');
        galleryItems.forEach((imgEl) => {
            imgEl.addEventListener('click', () => {
                const index = Number(imgEl.dataset.galleryIndex || 0);
                openProductImageModal(
                    galleryImages[index]?.url,
                    galleryImages.map(entry => entry.url),
                    index
                );
            });
        });
    }
}

// ============================================
// Charts Panel
// ============================================

function renderChartsPanel(data) {
    const panel = document.createElement("div");
    panel.id = "product-charts-panel";
    panel.className = "panel-section";

    // Add charts section - Boxplot first, then Bar chart
    const chartsWrapper = document.createElement("div");
    chartsWrapper.className = "charts-wrapper";
    chartsWrapper.appendChild(renderBoxplotChart(data));
    chartsWrapper.appendChild(renderPercentileBarChart(data));
    panel.appendChild(chartsWrapper);

    return panel;
}

// ============================================
// GWP Metrics Summary Panel
// ============================================

function renderGWPMetricsSummaryPanel(data) {
    const panel = document.createElement("div");
    panel.id = "gwp-metrics-panel";
    panel.className = "panel-section";

    const gwpPerKg = toNumber(data.gwp_per_kg);

    panel.innerHTML = `
        <div class="gwp-metrics-summary">
            <h5>GWP Metrics Summary</h5>
            <div class="metrics-grid">
                ${toNumber(data.gwp) !== null ? `
                <div class="metric-item">
                    <span class="metric-label">Total GWP</span>
                    <span class="metric-value">${toNumber(data.gwp).toFixed(2)} kgCO2e</span>
                    <span class="metric-desc">For declared unit</span>
                </div>
                ` : ''}
                ${toNumber(data.gwp_per_category_declared_unit) !== null ? `
                <div class="metric-item">
                    <span class="metric-label">GWP per Category Unit</span>
                    <span class="metric-value">${toNumber(data.gwp_per_category_declared_unit).toFixed(2)} kgCO2e</span>
                    <span class="metric-desc">Normalized to category standard</span>
                </div>
                ` : ''}
                ${gwpPerKg !== null ? `
                <div class="metric-item">
                    <span class="metric-label">GWP per Kilogram</span>
                    <span class="metric-value">${gwpPerKg.toFixed(4)} kgCO2e/kg</span>
                    <span class="metric-desc">Per unit mass</span>
                </div>
                ` : ''}
                ${toNumber(data.gwp_z) !== null ? `
                <div class="metric-item">
                    <span class="metric-label">Z-Score</span>
                    <span class="metric-value ${toNumber(data.gwp_z) < 0 ? 'better' : toNumber(data.gwp_z) > 0 ? 'worse' : 'average'}">
                        ${toNumber(data.gwp_z) > 0 ? '+' : ''}${toNumber(data.gwp_z).toFixed(2)}
                    </span>
                    <span class="metric-desc">${toNumber(data.gwp_z) < -0.5 ? 'Better than average' : toNumber(data.gwp_z) > 0.5 ? 'Worse than average' : 'Near average'}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    return panel;
}

// ============================================
// Additional Properties
// ============================================

function renderAdditionalPropertiesInline(data) {
    // Returns inline 3-column content for additional properties (no panel wrapper)
    const div = document.createElement("div");
    div.className = "additional-properties-inline";

    const properties = [];

    // Biogenic carbon
    if (data.biogenic_embodied_carbon_z !== undefined) {
        properties.push({
            label: "Biogenic Embodied Carbon",
            value: toNumber(data.biogenic_embodied_carbon_z)?.toFixed(4) || data.biogenic_embodied_carbon_z
        });
    }

    // Declared unit
    if (data.declared_unit || data.category_declared_unit) {
        properties.push({
            label: "Declared Unit",
            value: data.declared_unit || data.category_declared_unit
        });
    }

    // Reference service life
    if (data.reference_service_life) {
        properties.push({
            label: "Reference Service Life",
            value: `${data.reference_service_life} years`
        });
    }

    // Box ID / UUID
    if (data.box_id) {
        properties.push({
            label: "Box ID",
            value: data.box_id
        });
    }

    // EPD Type
    if (data.epd_type || data.type) {
        properties.push({
            label: "EPD Type",
            value: cleanText(data.epd_type || data.type)
        });
    }

    // Data source
    if (data.data_source || data.source) {
        properties.push({
            label: "Data Source",
            value: cleanText(data.data_source || data.source)
        });
    }

    if (properties.length === 0) {
        div.style.display = "none";
        return div;
    }

    div.innerHTML = `
        <hr class="details-separator">
        <div class="properties-grid-3col">
            ${properties.map(prop => `
                <div class="property-item">
                    <span class="property-label">${prop.label}</span>
                    <span class="property-value">${prop.value}</span>
                </div>
            `).join('')}
        </div>
    `;

    return div;
}

// ============================================
// Complete Product Details Panel
// ============================================

function renderProductDetailsPanel(data) {
    const panel = document.createElement("div");
    panel.className = "product-details-panel";

    // Note: Breadcrumb is rendered at the top level in label.js, not here

    // Get priority image URL to exclude from description images
    const priorityImage = typeof getPriorityImage === "function" ? getPriorityImage(data) : null;
    const priorityImageUrl = priorityImage ? priorityImage.url : null;

    // Product description
    panel.appendChild(renderProductDescription(data, priorityImageUrl, null));

    // Two-column layout for charts and locations
    const columnsDiv = document.createElement("div");
    columnsDiv.className = "details-columns";

    const leftCol = document.createElement("div");
    leftCol.className = "details-column";
    leftCol.appendChild(renderCarbonStorageSection(data));
    leftCol.appendChild(renderMissingImpacts(data)); // Environmental Impact Coverage after Carbon Storage
    leftCol.appendChild(renderMaterialComposition(data));

    const rightCol = document.createElement("div");
    rightCol.className = "details-column";
    rightCol.appendChild(renderProductionLocations(data));
    rightCol.appendChild(renderCertifications(data));

    columnsDiv.appendChild(leftCol);
    columnsDiv.appendChild(rightCol);
    panel.appendChild(columnsDiv);

    // Add charts panel after details columns
    panel.appendChild(renderChartsPanel(data));

    // Add GWP metrics summary panel after charts
    panel.appendChild(renderGWPMetricsSummaryPanel(data));

    return panel;
}

// Enhanced panel with calculators integrated into columns
function renderProductDetailsPanelWithCalculators(data, profile) {
    const panel = document.createElement("div");
    panel.className = "product-details-panel";

    // Get priority image URL to exclude from description images
    const priorityImage = typeof getPriorityImage === "function" ? getPriorityImage(data) : null;
    const priorityImageUrl = priorityImage ? priorityImage.url : null;

    // Product description
    panel.appendChild(renderProductDescription(data, priorityImageUrl, profile));

    // Two-column layout
    const columnsDiv = document.createElement("div");
    columnsDiv.className = "details-columns";

    // LEFT COLUMN: Transportation, Carbon Storage, Impact Coverage, Materials
    const leftCol = document.createElement("div");
    leftCol.className = "details-column";
    leftCol.appendChild(renderTransportationPanel(data));
    leftCol.appendChild(renderCarbonStorageSection(data));
    leftCol.appendChild(renderMissingImpacts(data)); // Environmental Impact Coverage after Carbon Storage
    leftCol.appendChild(renderMaterialComposition(data));

    // RIGHT COLUMN: Impact Calculator, Locations, Certifications
    const rightCol = document.createElement("div");
    rightCol.className = "details-column";
    rightCol.appendChild(renderImpactCalculatorPanel(data, profile));
    rightCol.appendChild(renderProductionLocations(data));
    rightCol.appendChild(renderCertifications(data));

    columnsDiv.appendChild(leftCol);
    columnsDiv.appendChild(rightCol);
    panel.appendChild(columnsDiv);

    // Add charts panel after details columns
    panel.appendChild(renderChartsPanel(data));

    // Add GWP metrics summary panel after charts
    panel.appendChild(renderGWPMetricsSummaryPanel(data));

    return panel;
}

// ============================================
// Transportation Panel (moved to column)
// ============================================

function renderTransportationPanel(data) {
    const div = document.createElement("div");
    div.className = "panel-section transportation-panel";

    const baseGwp = parseNumeric(data.gwp) ||
        parseNumeric(data.gwp_per_category_declared_unit) ||
        parseNumeric(data.gwp_per_declared_unit);

    const massPerDeclaredUnit = parseNumeric(data.mass_per_declared_unit) ||
        parseNumeric(data.mass);

    let defaultDistance = NaN;
    if (data.category && typeof data.category === "object") {
        defaultDistance = parseNumeric(data.category.default_distance);
    }
    if (!isFinite(defaultDistance)) {
        defaultDistance = parseNumeric(data.category_default_distance) ||
            parseNumeric(data.default_distance);
    }

    // If missing required data, show informational message
    if (!isFinite(baseGwp) || !isFinite(massPerDeclaredUnit) || !isFinite(defaultDistance)) {
        div.innerHTML = `
            <div class="section-header">
                <h4>Transportation to Site ${createInfoIcon(METRIC_TOOLTIPS.transport_a4, 'tip-transport')}</h4>
            </div>
            <div class="a4-explanation">
                A4 refers to the transport stage from factory to construction site in lifecycle assessment.
            </div>
            <p class="no-data-msg">Transportation calculation requires GWP, mass, and default distance data.</p>
        `;
        return div;
    }

    const EMISSION_FACTOR = 0.062;

    div.innerHTML = `
        <div class="section-header">
            <h4>Transportation to Site ${createInfoIcon(METRIC_TOOLTIPS.transport_a4, 'tip-transport')}</h4>
        </div>
        <div class="a4-explanation">
            A4 refers to the transport stage from factory to construction site in lifecycle assessment.
        </div>
        <div class="calc-row">
            <label>Travel distance (km):</label>
            <input type="number" class="transport-distance-input" value="${defaultDistance.toFixed(0)}" min="0" step="10">
        </div>
        <div class="transport-results"></div>
        <div class="calculator-note">
            Emission factor: 0.062 kgCO2e/ton-km (truck transport)
        </div>
    `;

    // Setup calculation after DOM is ready
    setTimeout(() => {
        const distanceInput = div.querySelector(".transport-distance-input");
        const resultsDiv = div.querySelector(".transport-results");

        if (!distanceInput || !resultsDiv) return;

        function recalc() {
            const d = Math.max(0, parseFloat(distanceInput.value) || 0);
            const defaultA4 = (defaultDistance * massPerDeclaredUnit * EMISSION_FACTOR) / 1000;
            const actualA4 = (d * massPerDeclaredUnit * EMISSION_FACTOR) / 1000;
            const adjustedGwp = baseGwp + (actualA4 - defaultA4);
            const savings = defaultA4 - actualA4;

            resultsDiv.innerHTML = `
                <div class="result-row">
                    <span class="result-label">Base GWP (A1-A3):</span>
                    <span class="result-value">${formatKg(baseGwp)} kgCO2e</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Default transport (${defaultDistance.toFixed(0)} km):</span>
                    <span class="result-value">${formatKg(defaultA4)} kgCO2e</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Your transport (${d.toFixed(0)} km):</span>
                    <span class="result-value">${formatKg(actualA4)} kgCO2e</span>
                </div>
                <div class="result-row primary">
                    <span class="result-label">Adjusted Total:</span>
                    <span class="result-value">${formatKg(adjustedGwp)} kgCO2e</span>
                </div>
                <div class="result-row ${savings >= 0 ? 'savings' : 'increase'}">
                    <span class="result-label">${savings >= 0 ? 'Savings' : 'Increase'} vs default:</span>
                    <span class="result-value">${formatKg(Math.abs(savings))} kgCO2e</span>
                </div>
            `;
        }

        distanceInput.addEventListener("input", recalc);
        recalc();
    }, 0);

    return div;
}

// ============================================
// Impact Calculator Panel (moved to column)
// ============================================

function renderImpactCalculatorPanel(data, profile) {
    const div = document.createElement("div");
    div.className = "panel-section impact-calculator-panel";

    const baseGwp = parseNumeric(data.gwp) ||
        parseNumeric(data.gwp_per_category_declared_unit);
    const massPerUnit = parseNumeric(data.mass_per_declared_unit);
    const declaredUnit = data.declared_unit || data.category_declared_unit ||
        (data.category && data.category.declared_unit) || "unit";
    const pricePerUnit = parseNumeric(data.price_per_unit) || 100;

    if (!isFinite(baseGwp)) {
        div.innerHTML = `
            <div class="section-header">
                <h4>Impact Calculator ${createInfoIcon("Calculate total environmental impact based on quantity and different unit bases.", 'tip-calc')}</h4>
            </div>
            <p class="no-data-msg">Calculator requires GWP data.</p>
        `;
        return div;
    }

    const settings = typeof getLabelSettings === "function" ? getLabelSettings() : { calculatorUnit: "declared" };

    div.innerHTML = `
        <div class="section-header">
            <h4>Impact Calculator ${createInfoIcon("Calculate total environmental impact based on quantity and different unit bases.", 'tip-calc')}</h4>
        </div>
        <div class="calculator-controls">
            <div class="calc-row">
                <label>Quantity:</label>
                <input type="number" class="calc-quantity-input" value="1" min="0.1" step="0.1">
            </div>
            <div class="calc-row">
                <label>Calculate per:</label>
                <select class="calc-unit-select">
                    <option value="declared" ${settings.calculatorUnit === 'declared' ? 'selected' : ''}>Declared Unit (${declaredUnit})</option>
                    <option value="per_kg" ${settings.calculatorUnit === 'per_kg' ? 'selected' : ''}>Per Kg</option>
                    <option value="per_1000" ${settings.calculatorUnit === 'per_1000' ? 'selected' : ''}>Per $1000</option>
                </select>
            </div>
        </div>
        <div class="calc-results"></div>
    `;

    setTimeout(() => {
        const quantityInput = div.querySelector(".calc-quantity-input");
        const unitSelect = div.querySelector(".calc-unit-select");
        const resultsDiv = div.querySelector(".calc-results");

        if (!quantityInput || !unitSelect || !resultsDiv) return;

        function recalculate() {
            const qty = parseFloat(quantityInput.value) || 1;
            const unit = unitSelect.value;

            let adjustedGwp = baseGwp;
            let unitLabel = declaredUnit;

            switch (unit) {
                case "per_kg":
                    if (isFinite(massPerUnit) && massPerUnit > 0) {
                        adjustedGwp = baseGwp / massPerUnit;
                        unitLabel = "kg";
                    }
                    break;
                case "per_1000":
                    if (pricePerUnit > 0) {
                        adjustedGwp = (baseGwp / pricePerUnit) * 1000;
                        unitLabel = "$1000";
                    }
                    break;
                default:
                    unitLabel = declaredUnit;
            }

            const totalGwp = adjustedGwp * qty;

            resultsDiv.innerHTML = `
                <div class="result-row primary">
                    <span class="result-label">Total GWP:</span>
                    <span class="result-value">${formatKg(totalGwp)} kgCO2e</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Per ${unitLabel}:</span>
                    <span class="result-value">${formatKg(adjustedGwp)} kgCO2e</span>
                </div>
                ${isFinite(massPerUnit) && unit === "declared" ? `
                <div class="result-row">
                    <span class="result-label">Total Mass:</span>
                    <span class="result-value">${formatKg(massPerUnit * qty)} kg</span>
                </div>
                ` : ''}
            `;

            if (typeof updateLabelSetting === "function") {
                updateLabelSetting("calculatorUnit", unit);
            }
        }

        quantityInput.addEventListener("input", recalculate);
        unitSelect.addEventListener("change", recalculate);
        recalculate();
    }, 0);

    return div;
}

// ============================================
// Export for module systems (optional)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderProductLabel,
        renderProductFDAStyle,
        renderProductBadgeStyle,
        setupProductCalculator,
        setupTravelDistanceCalculatorEnhanced,
        loadProductLabel,
        renderProductDetailsPanel,
        renderCategoryBreadcrumb,
        renderPercentileBarChart,
        renderProductionLocations,
        renderMaterialComposition,
        renderCertifications,
        cleanText
    };
}
