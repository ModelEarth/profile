// Displays a label for food nutrition or product impact.
// profileObject is built by createProfileObject() in layout-.js template.

let menuItems = []; // { profileObject, quantity }
let aggregateProfile = {};


window.rsMenuInsightsAddFeatures = function () {
  try {
    const panel = document.getElementById("insightsPanel");
    if (panel && panel.style.display === "none") {
      document.getElementById("getInsightsBtn")?.click();
    }

    const input = document.getElementById("search-input");
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });

      // focus without selecting text (prevents "replacing")
      input.focus({ preventScroll: true });

      // put cursor at end (optional, but feels nice)
      const v = input.value || "";
      input.setSelectionRange(v.length, v.length);

      return;
    }
  } catch (e) {
    console.warn("rsMenuInsightsAddFeatures failed", e);
  }
};
// Load js-yaml if missing
if (typeof jsyaml === "undefined") {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js";
    document.head.appendChild(s);
}
// Page cache used by Insights  
window.profileItemCache = window.profileItemCache || {};
// Persist across refresh
const PROFILE_ITEM_CACHE_KEY = "profileItemCache";

try {
  const saved = JSON.parse(sessionStorage.getItem(PROFILE_ITEM_CACHE_KEY) || "{}");
  window.profileItemCache = { ...saved, ...(window.profileItemCache || {}) };
} catch (e) {
  // ignore
}

function saveProfileItemCache() {
  try {
    sessionStorage.setItem(PROFILE_ITEM_CACHE_KEY, JSON.stringify(window.profileItemCache || {}));
  } catch (e) {
    // ignore
  }
}
function safeEncodeForHash(v) {
  if (v == null) return v;
  if (typeof v !== "string") return v;
  try {
    // avoid double-encoding
    return encodeURIComponent(decodeURIComponent(v));
  } catch (e) {
    return encodeURIComponent(v);
  }
}

function safeGoHash(obj, removeKeys) {
  if (typeof goHash !== "function" && typeof updateHash !== "function") return;

  const encoded = {};
  for (const k in obj) {
    encoded[k] = safeEncodeForHash(obj[k]);
  }

  if (typeof goHash === "function") {
    goHash(encoded, removeKeys);
  } else {
    updateHash(encoded, true, removeKeys);
  }
}

// Push cached USDA API url into Insights YAML/hash (so Get Insights uses it)
function syncInsightsPathFromCache() {
  try {
    const url =
    window.profileItemCache.lastFoodSearchApiUrl ||
    window.profileItemCache.lastFoodApiUrl;

if (!url) return;


    // 1) Update the YAML editor if it's present
    if (typeof applyCachedFoodApiUrlToYaml === "function") {
      applyCachedFoodApiUrlToYaml();
    }

       
    const h = (typeof getHash === "function") ? getHash() : getUrlHash();
    const existing = h && (h["features.path"] || h.features?.path);

    // Decide correct value for features.path
    const nextPath = url;


    const isProfileItem = window.location.pathname.includes('/profile/item');

const foodSearchUrl = window.profileItemCache?.lastFoodSearchApiUrl;

// Build hash update
const hashUpdate = { "features.path": nextPath };

//   Put the search endpoint into hash too 
if (foodSearchUrl) {
  hashUpdate.foodSearchUrl = foodSearchUrl;
}

 
safeGoHash(hashUpdate, isProfileItem ? "parambase,customYamlUrl" : "customYamlUrl");

try {
  document.dispatchEvent(new Event("hashChangeEvent"));
  window.dispatchEvent(new HashChangeEvent("hashchange"));
} catch (e) {
  // ignore
}



  } catch (e) {
    console.warn("syncInsightsPathFromCache failed:", e);
  }
}


let searchResults = []; // Store current search results
let lastHashSignature = null;

document.addEventListener("DOMContentLoaded", () => {
    if (document.addEventListener) {
        document.addEventListener("hashChangeEvent", loadMenu, false);
    }

      window.addEventListener("hashchange", () => {
    loadMenu();
    updateTopicSelectLinks?.();
  });
      syncInsightsPathFromCache();
    loadMenu();
    setupTopicSelect();
});

function parseNumeric(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const m = value.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }
    return NaN;
}

function updateTopicSelectLinks() {
    const hash = (typeof getHash === "function") ? getHash() : getUrlHash();
    const country = hash.country || selectedCountry || "";
    const foodLink = document.getElementById("topic-food-link");
    const buildingLink = document.getElementById("topic-building-link");
    const label = document.getElementById("topic-select-label");

    if (foodLink) {
        foodLink.href = country ? `#country=${country}` : "#";
    }
    if (buildingLink) {
        buildingLink.href = country ? `#layout=product&country=${country}` : "#layout=product";
    }
    if (label) {
        label.textContent = hash.layout === "product" ? "Building Materials" : "Food Categories";
    }
}

function clearHashExceptCountry(nextHash) {
    const hash = (typeof getHash === "function") ? getHash() : getUrlHash();
    const country = hash.country || selectedCountry || "";
    const keysToRemove = Object.keys(hash || {}).filter((key) => key !== "country");
    if (typeof goHash === "function") {
        goHash(nextHash, keysToRemove.join(","));
    } else if (typeof updateHash === "function") {
        updateHash(nextHash, true, keysToRemove.join(","));
    } else {
        window.location.hash = country ? `country=${country}` : "";
    }
}

function setupTopicSelect() {
    const topicSelect = document.getElementById("topic-select");
    const foodLink = document.getElementById("topic-food-link");
    const buildingLink = document.getElementById("topic-building-link");
    const closeLink = document.getElementById("topic-close-link");

    if (!topicSelect) {
        return;
    }

    updateTopicSelectLinks();

    topicSelect.addEventListener("click", (event) => {
        if (event.target && event.target.closest(".topic-select-dropdown")) {
            return;
        }
        topicSelect.classList.toggle("open");
    });

    document.addEventListener("click", (event) => {
        if (!topicSelect.contains(event.target)) {
            topicSelect.classList.remove("open");
        }
    });

    if (foodLink) {
        foodLink.addEventListener("click", (event) => {
            event.preventDefault();
            clearHashExceptCountry({ country: selectedCountry });
            topicSelect.classList.remove("open");
        });
    }

    if (buildingLink) {
        buildingLink.addEventListener("click", (event) => {
            event.preventDefault();
            clearHashExceptCountry({ layout: "product", country: selectedCountry });
            topicSelect.classList.remove("open");
        });
    }

    if (closeLink) {
        closeLink.addEventListener("click", (event) => {
            event.preventDefault();
            topicSelect.classList.remove("open");
            if (typeof toggleCategorySidebar === "function") {
                toggleCategorySidebar();
            }
        });
    }

    if (document.addEventListener) {
        document.addEventListener("hashChangeEvent", updateTopicSelectLinks, false);
    }
}

function titleCaseWords(text) {
    if (!text || typeof text !== "string") return text;
    const smallWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "per", "the", "to", "vs", "via"]);
    const words = text.split(/\s+/);
    return words.map((word, index) => {
        const cleaned = word.toLowerCase();
        if (index > 0 && smallWords.has(cleaned)) {
            return cleaned;
        }
        return cleaned.replace(/^[a-z]/, (c) => c.toUpperCase());
    }).join(" ");
}

function parseCSVLine(line) {
    const regex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
    return line.split(regex).map(field => field.replace(/^"(.*)"$/, "$1").trim());
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (!lines.length) return { header: [], rows: [] };

    const header = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        header.forEach((key, index) => {
            row[key] = values[index] ?? "";
        });
        return row;
    });
    return { header, rows };
}

function getRowValue(row, keys) {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
            return row[key];
        }
    }
    return "";
}

function buildAllCsvUrl(country) {
    return `${LOCAL_BASE}/${country}/all.csv`;
}

function buildCategoryCsvUrl(country, subcategoryName) {
    return `${LOCAL_BASE}/${country}/${country}-${subcategoryName}.csv`;
}

function renderProductCsvList(container, rows, country, listSourceUrl, titleText = "Products") {
    container.innerHTML = "";
    const header = document.createElement("h3");
    header.textContent = `${titleText} (${rows.length})`;
    container.appendChild(header);

    const listContainer = document.createElement("div");
    listContainer.style.marginTop = "1em";

    const list = document.createElement("div");
    list.className = "product-file-list";

    rows.forEach((row) => {
        const id = getRowValue(row, ["ID", "id", "Id", "uuid", "UUID"]);
        const name = getRowValue(row, ["name", "Name"]) || "Unnamed product";
        const gwp = getRowValue(row, ["gwp", "GWP"]);
        const gwpValue = toNumber(gwp);

        const rowDiv = document.createElement("div");
        rowDiv.className = "file-row";

        if (gwpValue !== null) {
            const rating = getImpactRating(gwpValue, "gwp");
            const gwpRect = document.createElement("div");
            gwpRect.className = "file-row-gwp";
            gwpRect.style.backgroundColor = rating.color;
            gwpRect.textContent = gwpValue.toFixed(1);
            rowDiv.appendChild(gwpRect);
        }

        const nameLink = document.createElement("a");
        const categoryValue = getRowValue(row, ["category", "Category", "cat", "Cat"]);
        const catParam = categoryValue ? `&cat=${encodeURIComponent(categoryValue)}` : "";
        nameLink.href = id ? `#layout=product&country=${country}${catParam}&id=${id}` : "#";
        nameLink.textContent = name;
        nameLink.className = "file-row-name";
        rowDiv.appendChild(nameLink);

        list.appendChild(rowDiv);
    });
    listContainer.appendChild(list);

    if (listSourceUrl) {
        const listSource = document.createElement("div");
        listSource.className = "list-source";
        listSource.innerHTML = `List Source: <a href="${listSourceUrl}" target="_blank" rel="noopener">${listSourceUrl}</a>`;
        listContainer.appendChild(listSource);
    }

    container.appendChild(listContainer);
}

async function loadCsvList(url) {
    const response = await fetch(url);
    if (!response.ok) {
        return null;
    }
    const csvText = await response.text();
    const parsed = parseCSV(csvText);
    return parsed.rows;
}

// function loadMenu() {
//     let hash = getUrlHash();

//     const searchDiv = document.getElementById("usda-search-div");
//     const searchResultsContainer = document.getElementById("search-results-container");
//     const menuContainer = document.getElementById("menu-container");
//     const header = document.getElementById("page-header");

//     if (hash.layout == "product") {
//         header.textContent = "Product Layout";
//         searchDiv.style.display = "none";
//         searchResultsContainer.style.display = "none";
//         menuContainer.style.display = "none";
//         loadProductList();
//     } else {
//         addUSDASearchBar();
//         displayInitialFoodItems();
//     }
// }

// function loadProductList() {
//     const csvUrl = "https://raw.githubusercontent.com/Sirishaupadhyayula/products-data/refs/heads/main/IN.csv";
//     const container = document.getElementById("product-container");

//     if (container) {
//         container.innerHTML = "<h3>Loading products...</h3>";

//         fetch(csvUrl)
//             .then(response => response.text())
//             .then(csvText => {
//                 const lines = csvText.split("\n");
//                 const headers = parseCSVLine(lines[0]);

//                 container.innerHTML = "<h3>Product List:</h3>";

//                 const table = document.createElement("table");
//                 table.style.width = "100%";
//                 table.style.borderCollapse = "collapse";

//                 const headerRow = document.createElement("tr");
//                 headers.forEach(header => {
//                     const th = document.createElement("th");
//                     th.textContent = header;
//                     headerRow.appendChild(th);
//                 });
//                 table.appendChild(headerRow);

//                 for (let i = 1; i < lines.length; i++) {
//                     if (lines[i].trim()) {
//                         const values = parseCSVLine(lines[i]);
//                         const row = document.createElement("tr");

//                         values.forEach(value => {
//                             const td = document.createElement("td");
//                             td.textContent = value;
//                             row.appendChild(td);
//                         });

//                         table.appendChild(row);
//                     }
//                 }

//                 container.appendChild(table);
//             })
//             .catch(error => {
//                 console.log("Error fetching products CSV:", error);
//                 container.innerHTML = "<p>Error loading products. Please try again later.</p>";
//             });
//     }
// }

// function parseCSVLine(line) {
//     // This regex splits on commas not inside quotes
//     const regex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
//     return line.split(regex).map(field => {
//         // Remove surrounding quotes and trim whitespace
//         return field.replace(/^"(.*)"$/, '$1').trim();
//     });
// }

async function loadMenu() {
    let hash = (typeof getHash === "function") ? getHash() : getUrlHash();

    const searchDiv = document.getElementById("search-div");
    const searchResultsContainer = document.getElementById("search-results-container");
    const menuContainer = document.getElementById("menu-container");
    const header = document.getElementById("page-header");
    const sidebar = document.getElementById("category-sidebar");

    //   DOM not ready when this runs on model.earth
    if (!header) {
        lastHashSignature = null;
        if (typeof waitForElm === "function") {
            waitForElm("#page-header").then(loadMenu);
        }
        return;
    }

    const hashSignature = JSON.stringify(hash || {});
    if (hashSignature === lastHashSignature) {
        return;
    }
    lastHashSignature = hashSignature;

    // Update selected country from hash
    if (hash.country) {
        selectedCountry = hash.country;
    }

    const toggleBtn = document.getElementById("menu-toggle-btn");

    if (hash.layout == "product") {
        addUSDASearchBar(); // Show search bar with country dropdown
        searchResultsContainer.style.display = "none";
        menuContainer.style.display = "none";

        // Show categories or specific product
        if (hash.id) {
            // Has product ID - load specific product and hide sidebar
            if (sidebar) sidebar.style.display = "none";
            if (toggleBtn) toggleBtn.classList.remove("dimmed");
            if (hash.cat) {
                const container = document.getElementById("product-container");
                if (container) {
                    container.innerHTML = `<h3>${hash.country} / ${hash.cat}</h3>`;
                }
                await loadYAMLProfile(hash.country, hash.cat, { name: `${hash.id}.yaml` });
            } else {
                await loadProductByCountryAndId(hash.country, hash.id);
            }
        } else {
            // No specific product ID - show product categories and sidebar
            loadProductCategorySidebar();
            if (sidebar) sidebar.style.display = "block";
            if (toggleBtn) toggleBtn.classList.add("dimmed");
            const productContainer = document.getElementById("product-container");
            const productLabel = document.getElementById("product-label");
            if (productContainer) productContainer.style.display = "none";

            // If cat parameter exists, load that subcategory
            if (hash.cat) {
                await selectProductSubcategory(selectedCountry, hash.cat);
            } else {
                const allCsvUrl = buildAllCsvUrl(selectedCountry);
                const allRows = await loadCsvList(allCsvUrl);
                if (allRows && allRows.length) {
                    renderProductCsvList(
                        document.getElementById("product-label"),
                        allRows,
                        selectedCountry,
                        allCsvUrl,
                        "All Products"
                    );
                } else {
                    // Load first subcategory if no cat or id specified
                    const categories = PRODUCT_CATEGORIES[selectedCountry] || PRODUCT_CATEGORIES.US;
                    if (categories.length > 0 && categories[0].subcategories && categories[0].subcategories.length > 0) {
                        const firstSubcat = categories[0].subcategories[0];
                        if (typeof goHash === "function") {
                            goHash({ cat: firstSubcat });
                        }
                    }
                }
            }
        }
        return;
    }

    // Food view (no layout parameter)
    addUSDASearchBar();
   
const isProfileItem = window.location.pathname.includes("/profile/item");
if (searchResultsContainer) {
  searchResultsContainer.style.display = isProfileItem ? "none" : "";
}

if (menuContainer) menuContainer.style.display = "";
loadFoodCategorySidebar();


    // Show sidebar if no specific food id in hash
    if (!hash.id) {
        if (sidebar) sidebar.style.display = "block";
        if (toggleBtn) toggleBtn.classList.add("dimmed");
    } else {
        if (sidebar) sidebar.style.display = "none";
        if (toggleBtn) toggleBtn.classList.remove("dimmed");
    }

    // If country is India, trigger India search automatically
    if (selectedCountry === "IN") {
        searchUSDAFood("India");
    } else {
        // Otherwise show initial food items
        displayInitialFoodItems();
    }
}

const FOOD_CATEGORIES = [
    {
        name: "Fruits and Fruit Juices",
        query: "Fruits and Fruit Juices",
        subcategories: [
            { name: "Citrus Fruits", query: "citrus orange lemon lime grapefruit" },
            { name: "Berries", query: "berry strawberry blueberry raspberry blackberry" },
            { name: "Stone Fruits", query: "peach plum cherry apricot nectarine" },
            { name: "Tropical Fruits", query: "mango pineapple banana papaya guava" },
            { name: "Apples and Pears", query: "apple pear" },
            { name: "Melons", query: "melon watermelon cantaloupe honeydew" },
            { name: "Grapes", query: "grape raisin" },
            { name: "Fruit Juices", query: "juice" }
        ]
    },
    {
        name: "Vegetables",
        query: "Vegetables and Vegetable Products",
        subcategories: [
            { name: "Leafy Greens", query: "lettuce spinach kale chard arugula" },
            { name: "Root Vegetables", query: "carrot potato beet turnip radish" },
            { name: "Cruciferous", query: "broccoli cauliflower cabbage brussels" },
            { name: "Peppers and Tomatoes", query: "pepper tomato" },
            { name: "Squash and Gourds", query: "squash zucchini pumpkin cucumber" },
            { name: "Alliums", query: "onion garlic leek shallot" },
            { name: "Beans and Peas", query: "green beans peas snap pea" },
            { name: "Corn", query: "corn" }
        ]
    },
    {
        name: "Dairy and Eggs",
        query: "Dairy and Egg Products",
        subcategories: [
            { name: "Milk", query: "milk whole skim" },
            { name: "Cheese", query: "cheese cheddar mozzarella" },
            { name: "Yogurt", query: "yogurt" },
            { name: "Cream and Butter", query: "cream butter" },
            { name: "Eggs", query: "egg" },
            { name: "Ice Cream", query: "ice cream" }
        ]
    },
    {
        name: "Meats and Poultry",
        query: "Poultry Products",
        subcategories: [
            { name: "Chicken", query: "chicken" },
            { name: "Turkey", query: "turkey" },
            { name: "Duck and Game Birds", query: "duck goose quail" },
            { name: "Beef", query: "beef steak" },
            { name: "Pork", query: "pork ham bacon" },
            { name: "Lamb and Veal", query: "lamb veal" }
        ]
    },
    {
        name: "Fish and Seafood",
        query: "Finfish and Shellfish Products",
        subcategories: [
            { name: "Finfish", query: "salmon tuna cod tilapia" },
            { name: "Shellfish", query: "shrimp crab lobster" },
            { name: "Mollusks", query: "clam oyster mussel scallop" },
            { name: "Canned Seafood", query: "canned tuna salmon sardine" }
        ]
    },
    {
        name: "Grains and Pasta",
        query: "Cereal Grains and Pasta",
        subcategories: [
            { name: "Rice", query: "rice" },
            { name: "Wheat Products", query: "wheat flour bread" },
            { name: "Pasta and Noodles", query: "pasta noodle spaghetti" },
            { name: "Oats and Oatmeal", query: "oats oatmeal" },
            { name: "Quinoa and Ancient Grains", query: "quinoa barley bulgur" },
            { name: "Breakfast Cereals", query: "cereal" }
        ]
    },
    {
        name: "Nuts and Seeds",
        query: "Nut and Seed Products",
        subcategories: [
            { name: "Tree Nuts", query: "almond walnut cashew" },
            { name: "Peanuts", query: "peanut peanut butter" },
            { name: "Seeds", query: "sunflower seed chia flax" },
            { name: "Nut Butters", query: "almond butter nut butter" }
        ]
    },
    {
        name: "Legumes",
        query: "Legumes and Legume Products",
        subcategories: [
            { name: "Beans", query: "bean kidney black pinto" },
            { name: "Lentils", query: "lentil" },
            { name: "Chickpeas", query: "chickpea garbanzo hummus" },
            { name: "Soy Products", query: "tofu tempeh soy" }
        ]
    },
    {
        name: "Baked Products",
        query: "Baked Products",
        subcategories: [
            { name: "Bread", query: "bread" },
            { name: "Rolls and Buns", query: "roll bun" },
            { name: "Cookies and Cakes", query: "cookie cake" },
            { name: "Pastries", query: "pastry danish croissant" },
            { name: "Muffins and Scones", query: "muffin scone" }
        ]
    },
    {
        name: "Beverages",
        query: "Beverages",
        subcategories: [
            { name: "Coffee and Tea", query: "coffee tea" },
            { name: "Soft Drinks", query: "soda cola" },
            { name: "Energy Drinks", query: "energy drink" },
            { name: "Water", query: "water" },
            { name: "Plant-Based Milk", query: "almond milk soy milk oat milk" }
        ]
    },
    {
        name: "Fats and Oils",
        query: "Fats and Oils",
        subcategories: [
            { name: "Cooking Oils", query: "olive oil vegetable oil canola" },
            { name: "Butter and Margarine", query: "butter margarine" },
            { name: "Salad Dressings", query: "dressing vinaigrette" }
        ]
    },
    {
        name: "Snacks and Sweets",
        query: "Sweets",
        subcategories: [
            { name: "Candy", query: "candy chocolate" },
            { name: "Chips and Crackers", query: "chips crackers" },
            { name: "Popcorn", query: "popcorn" },
            { name: "Desserts", query: "pudding gelatin" }
        ]
    },
    {
        name: "Soups and Sauces",
        query: "Soups, Sauces, and Gravies",
        subcategories: [
            { name: "Soups", query: "soup" },
            { name: "Sauces", query: "sauce tomato sauce" },
            { name: "Gravies", query: "gravy" },
            { name: "Condiments", query: "ketchup mustard mayo" }
        ]
    },
    {
        name: "Fast Foods",
        query: "Fast Foods",
        subcategories: [
            { name: "Burgers and Sandwiches", query: "burger sandwich" },
            { name: "Pizza", query: "pizza" },
            { name: "Fried Foods", query: "fried chicken fries" },
            { name: "Mexican Fast Food", query: "taco burrito" }
        ]
    }
];

const PRODUCT_CATEGORIES = {
    US: [
        {
            name: "Flooring",
            subcategories: ["Carpet", "Resilient_Flooring", "Ceramic_Tile", "Other_Flooring"]
        },
        {
            name: "Structural Materials",
            subcategories: ["Cement", "Ready_Mix", "Flowable_Concrete_Fill", "Autoclaved_Aerated_Concrete",
                          "Brick", "Supplementary_Cementitious_Materials", "Cast_Decks_and_Underlayment", "Aggregates"]
        },
        {
            name: "Metals",
            subcategories: ["Aluminium", "Aluminium_Extrusions", "Aluminium_Billets", "Aluminium_Sheet_Goods",
                          "Aluminium_Suspension_Assemblies", "Steel", "Coil_Steel"]
        },
        {
            name: "Wall Systems",
            subcategories: ["Gypsum_Board", "Cement_Board", "Fiber-cement_Siding", "Insulated_Wall_Panels"]
        },
        {
            name: "Ceilings",
            subcategories: ["Acoustical_Ceilings", "Ceiling_Panels"]
        },
        {
            name: "Insulation",
            subcategories: ["Blanket", "Blown", "Board", "Mechanical_Insulation"]
        },
        {
            name: "Roofing",
            subcategories: ["Bituminous_Roofing", "Asphalt"]
        },
        {
            name: "Glass & Glazing",
            subcategories: ["Flat_Glass_Panes", "Processed_Non-insulating_Glass_Panes"]
        },
        {
            name: "Doors & Openings",
            subcategories: ["Metal_Doors_and_Frames"]
        },
        {
            name: "Coatings & Protection",
            subcategories: ["Paint_By_Area", "Paint_By_Mass", "Applied_Fireproofing",
                          "Dampproofing_And_Waterproofing", "Grouting"]
        },
        {
            name: "Mechanical & Plumbing",
            subcategories: ["Utility_Piping", "Water_Closets", "Other_Plumbing_Fixtures", "Elevators"]
        },
        {
            name: "Other Products",
            subcategories: ["Tables", "Clothing", "Food_Beverage"]
        }
    ],
    IN: [
        {
            name: "Flooring",
            subcategories: ["Carpet", "Resilient_Flooring", "Other_Flooring"]
        },
        {
            name: "Structural Materials",
            subcategories: ["Cement", "Ready_Mix", "Flowable_Concrete_Fill", "Brick"]
        },
        {
            name: "Metals",
            subcategories: ["Aluminium", "Aluminium_Billets", "Aluminium_Sheet_Goods", "Steel", "Coil_Steel"]
        },
        {
            name: "Wall Systems",
            subcategories: ["Gypsum_Board", "Cement_Board", "Fiber-cement_Siding", "Insulated_Wall_Panels"]
        },
        {
            name: "Ceilings",
            subcategories: ["Acoustical_Ceilings"]
        },
        {
            name: "Insulation",
            subcategories: ["Mechanical_Insulation"]
        },
        {
            name: "Glass & Glazing",
            subcategories: ["Flat_Glass_Panes", "Processed_Non-insulating_Glass_Panes"]
        },
        {
            name: "Doors & Openings",
            subcategories: ["Metal_Doors_and_Frames"]
        },
        {
            name: "Coatings & Protection",
            subcategories: ["Paint_By_Area", "Paint_By_Mass", "Dampproofing_And_Waterproofing", "Grouting"]
        },
        {
            name: "Mechanical & Plumbing",
            subcategories: ["Utility_Piping", "Water_Closets", "Other_Plumbing_Fixtures", "Elevators"]
        },
        {
            name: "Consumer Products",
            subcategories: ["Tables", "Clothing", "Food_Beverage"]
        }
    ]
};

let selectedCategory = null;
let selectedCountry = "US"; // Default country

function loadFoodCategorySidebar() {
    const sidebar = document.getElementById("category-sidebar");
    const categoryList = document.getElementById("category-list");

    if (!sidebar || !categoryList) return;

    const sidebarTitle = sidebar.querySelector("h3");
    if (sidebarTitle) {
        sidebarTitle.textContent = "Food Categories";
    }

    categoryList.innerHTML = "";

    FOOD_CATEGORIES.forEach((category, index) => {
        // Create category container
        const categoryContainer = document.createElement("div");
        categoryContainer.style.marginBottom = "8px";

        // Create category header
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "category-header";

        // Category title button with arrow inside
        const categoryTitle = document.createElement("div");
        categoryTitle.className = "category-title";

        // Only add arrow if category has subcategories
        if (category.subcategories && category.subcategories.length > 0) {
            categoryTitle.innerHTML = `<span class="toggle-arrow">▶</span> ${category.name}`;
        } else {
            categoryTitle.textContent = category.name;
        }

        categoryTitle.dataset.categoryName = category.name;
        categoryTitle.dataset.query = category.query;
        categoryTitle.dataset.index = index;

        const subcategoryList = document.createElement("ul");
        subcategoryList.className = "subcategory-list";
        subcategoryList.style.display = "none";

        // Click title behavior: toggle submenu if exists, or search main category
        categoryTitle.onclick = function(e) {
            e.stopPropagation();

            if (category.subcategories && category.subcategories.length > 0) {
                // Has subcategories - toggle submenu
                const arrow = categoryTitle.querySelector(".toggle-arrow");
                const isOpen = subcategoryList.style.display === "block";

                if (isOpen) {
                    subcategoryList.style.display = "none";
                    arrow.classList.remove("open");
                    categoryTitle.classList.remove("active");
                } else {
                    subcategoryList.style.display = "block";
                    arrow.classList.add("open");
                    categoryTitle.classList.add("active");
                }
            } else {
                // No subcategories - search main category directly
                selectFoodCategory(category.query, categoryTitle);
            }
        };

        categoryHeader.appendChild(categoryTitle);
        categoryContainer.appendChild(categoryHeader);

        // Create subcategory list if exists
        if (category.subcategories && category.subcategories.length > 0) {
            category.subcategories.forEach(subcat => {
                const subcatItem = document.createElement("li");
                subcatItem.className = "subcategory-item";

                const subcatLink = document.createElement("a");
                subcatLink.className = "subcategory-link";
                subcatLink.textContent = subcat.name;
                subcatLink.dataset.query = subcat.query;
                subcatLink.href = "#";

                subcatLink.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectFoodCategory(subcat.query, subcatLink);
                };

                subcatItem.appendChild(subcatLink);
                subcategoryList.appendChild(subcatItem);
            });
        }

        categoryContainer.appendChild(subcategoryList);
        categoryList.appendChild(categoryContainer);
    });
}

function loadProductCategorySidebar() {
    const sidebar = document.getElementById("category-sidebar");
    const categoryList = document.getElementById("category-list");

    if (!sidebar || !categoryList) return;

    const sidebarTitle = sidebar.querySelector("h3");
    if (sidebarTitle) {
        sidebarTitle.textContent = "Product Categories";
    }

    categoryList.innerHTML = "";

    const categories = PRODUCT_CATEGORIES[selectedCountry] || PRODUCT_CATEGORIES.US;

    categories.forEach((category, index) => {
        // Create category container
        const categoryContainer = document.createElement("div");
        categoryContainer.style.marginBottom = "8px";

        // Create category header with title containing arrow
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "category-header";

        // Category title button with arrow inside
        const categoryTitle = document.createElement("div");
        categoryTitle.className = "category-title";
        categoryTitle.innerHTML = `<span class="toggle-arrow">▶</span> ${category.name}`;
        categoryTitle.dataset.categoryName = category.name;
        categoryTitle.dataset.index = index;

        const subcategoryList = document.createElement("ul");
        subcategoryList.className = "subcategory-list";
        subcategoryList.style.display = "none";

        // Click title to toggle submenu
        categoryTitle.onclick = function(e) {
            e.stopPropagation();
            const arrow = categoryTitle.querySelector(".toggle-arrow");
            const isOpen = subcategoryList.style.display === "block";

            if (isOpen) {
                subcategoryList.style.display = "none";
                arrow.classList.remove("open");
                categoryTitle.classList.remove("active");
            } else {
                subcategoryList.style.display = "block";
                arrow.classList.add("open");
                categoryTitle.classList.add("active");
            }
        };

        categoryHeader.appendChild(categoryTitle);
        categoryContainer.appendChild(categoryHeader);

        // Create subcategory list
        if (category.subcategories && category.subcategories.length > 0) {
            category.subcategories.forEach(subcatName => {
                const subcatItem = document.createElement("li");
                subcatItem.className = "subcategory-item";

                const subcatLink = document.createElement("a");
                subcatLink.className = "subcategory-link";
                subcatLink.textContent = subcatName.replace(/_/g, " ");
                subcatLink.dataset.subcategoryName = subcatName;

                subcatLink.href = `#layout=product&country=${selectedCountry}&cat=${subcatName}`;

                subcatItem.appendChild(subcatLink);
                subcategoryList.appendChild(subcatItem);
            });
        }

        categoryContainer.appendChild(subcategoryList);
        categoryList.appendChild(categoryContainer);
    });

    // Highlight active subcategory based on hash
    const hash = (typeof getHash === "function") ? getHash() : getUrlHash();
    if (hash.cat) {
        highlightActiveSubcategory(hash.cat);
    }
}

function highlightActiveSubcategory(activeCat) {
    // Remove active class from all subcategory links
    document.querySelectorAll('.subcategory-link').forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to the matching subcategory
    const activeLink = document.querySelector(`.subcategory-link[data-subcategory-name="${activeCat}"]`);
    if (activeLink) {
        activeLink.classList.add('active');

        // Also expand the parent category
        const subcategoryList = activeLink.closest('.subcategory-list');
        if (subcategoryList) {
            subcategoryList.style.display = 'block';
            const categoryTitle = subcategoryList.previousElementSibling.querySelector('.category-title');
            if (categoryTitle) {
                categoryTitle.classList.add('active');
                const arrow = categoryTitle.querySelector('.toggle-arrow');
                if (arrow) arrow.classList.add('open');
            }
        }
    }
}

function selectFoodCategory(queryString, element) {
    // Remove active class from all category-related elements
    document.querySelectorAll(".category-item, .category-title, .subcategory-link").forEach(item => {
        item.classList.remove("active");
    });

    // Add active class to selected element if provided
    if (element) {
        element.classList.add("active");
    }

    selectedCategory = queryString;

    // Filter foods by category
    if (!queryString || queryString === "") {
        // Show all foods (initial display)
        displayInitialFoodItems();
    } else {
        // Search USDA API by category
        searchUSDAFoodByCategory(queryString);
    }
}

async function selectProductSubcategory(country, subcategoryName) {
    const container = document.getElementById("product-label");
    if (!container) return;

    container.innerHTML = `<h3>Loading ${subcategoryName.replace(/_/g, " ")} products...</h3>`;

    try {
        const localCsvUrl = buildCategoryCsvUrl(country, subcategoryName);
        let csvUrl = localCsvUrl;
        let csvRows = await loadCsvList(localCsvUrl);

        // Local products-data checkout isn't always available (e.g. running from
        // this repo without that submodule) - fall back to the raw GitHub CSV.
        if (!csvRows || !csvRows.length) {
            csvUrl = `${RAW_BASE}/${country}/${country}-${subcategoryName}.csv`;
            csvRows = await loadCsvList(csvUrl);
        }

        if (csvRows && csvRows.length) {
            renderProductCsvList(
                container,
                csvRows,
                country,
                csvUrl,
                subcategoryName.replace(/_/g, " ")
            );
            return;
        }

        const files = await fetchJSONWithAuth(`${API_BASE}/${country}/${subcategoryName}`);
        const yamlFiles = files.filter(x => x.type === "file" && x.name.endsWith(".yaml"));

        if (yamlFiles.length === 0) {
            container.innerHTML = `<p>No products found in ${subcategoryName.replace(/_/g, " ")}</p>`;
            return;
        }

        // Try to fetch CSV from GitHub raw to build an ID-to-name map
        let csvNameMap = {};
        try {
            const remoteCsvUrl = `${RAW_BASE}/${country}/${country}-${subcategoryName}.csv`;
            const csvRows = await loadCsvList(remoteCsvUrl);
            if (csvRows && csvRows.length) {
                csvRows.forEach(row => {
                    const rid = getRowValue(row, ["ID", "id", "Id", "uuid", "UUID"]);
                    const rname = getRowValue(row, ["name", "Name"]);
                    if (rid && rname) csvNameMap[rid] = rname;
                });
            }
        } catch (e) {
            // CSV lookup is best-effort; continue with filenames
        }

        container.innerHTML = `<h3>${subcategoryName.replace(/_/g, " ")} (${yamlFiles.length} products)</h3>`;

        const listContainer = document.createElement("div");
        listContainer.style.marginTop = "1em";
        const listSourceUrl = `${API_BASE}/${country}/${subcategoryName}`;

        const columns = ["name", "size"];

        const table = document.createElement("table");
        table.className = "product-file-table";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        columns.forEach((key) => {
            const th = document.createElement("th");
            th.textContent = key;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        yamlFiles.forEach(file => {
            const id = file.name.replace(".yaml", "");
            const row = document.createElement("tr");
            row.className = "file-row";

            columns.forEach((key) => {
                const td = document.createElement("td");
                const value = file[key];

                if (key === "name") {
                    const nameLink = document.createElement("a");
                    nameLink.href = `#layout=product&country=${country}&id=${id}`;
                    // Use CSV product name if available, otherwise fall back to filename/id
                    nameLink.textContent = csvNameMap[id] || value || id;
                    nameLink.addEventListener("click", (event) => {
                        event.stopPropagation();
                        if (typeof goHash === "function") {
                            goHash({
                                layout: "product",
                                country: country,
                                id: id
                            });
                        } else if (typeof updateHash === "function") {
                            updateHash({
                                layout: "product",
                                country: country,
                                id: id
                            }, true);
                        }
                    });
                    td.appendChild(nameLink);
                } else if (key === "size") {
                    const sizeValue = typeof value === "number" ? value : Number(value);
                    if (Number.isFinite(sizeValue)) {
                        td.textContent = `${(sizeValue / 1000).toFixed(1)} KB`;
                    } else {
                        td.textContent = "";
                    }
                } else if (typeof value === "string" && value.startsWith("http")) {
                    const link = document.createElement("a");
                    link.href = value;
                    link.target = "_blank";
                    link.rel = "noopener";
                    link.textContent = value;
                    link.addEventListener("click", (event) => {
                        event.stopPropagation();
                    });
                    td.appendChild(link);
                } else if (value === null || value === undefined) {
                    td.textContent = "";
                } else if (typeof value === "object") {
                    td.textContent = JSON.stringify(value);
                } else {
                    td.textContent = String(value);
                }

                row.appendChild(td);
            });

            row.onclick = () => {
                if (typeof goHash === "function") {
                    goHash({
                        layout: "product",
                        country: country,
                        id: id
                    });
                } else if (typeof updateHash === "function") {
                    updateHash({
                        layout: "product",
                        country: country,
                        id: id
                    }, true);
                }

                loadYAMLProfile(country, subcategoryName, file);
            };

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        listContainer.appendChild(table);

        const listSource = document.createElement("div");
        listSource.className = "list-source";
        listSource.innerHTML = `List Source: <a href="${listSourceUrl}" target="_blank" rel="noopener">${listSourceUrl}</a>`;
        listContainer.appendChild(listSource);

        container.appendChild(listContainer);
    } catch (error) {
        console.error("Error loading subcategory:", error);
        let errorDetails = error.message || "Unknown error";
        let urlLink = '';
        let githubInfo = '';

        if (error.url) {
            const shortName = getShortUrlName(error.url);
            urlLink = `<p><strong>Endpoint:</strong> <a href="${error.url}" target="_blank">${shortName}</a></p>`;
        }

        // Add GitHub API specific guidance
        if (error.isGitHubAPI) {
            githubInfo = `
                <p style="margin-top: 15px;"><strong>GitHub API Access:</strong></p>
                <p>This error occurred while fetching the product list from GitHub's API. ${error.hasToken ? 'A GitHub token was used but may be invalid or expired.' : 'No GitHub token found in browser cache.'}</p>
                <p>To improve API rate limits and avoid errors, set your GitHub token on:</p>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li><a href="/projects/hub/" target="_blank">Project Hub</a></li>
                    <li><a href="/team/projects/#list=modelteam&showrepos=true" target="_blank">Team Project Repos</a></li>
                </ul>
            `;
        }

        container.innerHTML = `
            <div class="error-message-container">
                <h3>Error Loading Products</h3>
                <p><strong>Reason:</strong> ${errorDetails}</p>
                ${urlLink}
                ${githubInfo}
                <p style="margin-bottom: 0;"><em>Please try again or check your connection.</em></p>
            </div>
        `;
    }
}

function searchUSDAFoodByCategory(categoryQuery) {
    const apiKey = "bLecediTVa2sWd8AegmUZ9o7DxYFSYoef9B4i1Ml";

    // Add country-specific search terms
    let searchQuery = categoryQuery;
    if (selectedCountry === "IN") {
        searchQuery = categoryQuery + " India";
    } else if (selectedCountry === "US") {
        searchQuery = categoryQuery + " American";
    }


    const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&pageSize=20&pageNumber=1`;

    // Cache for Insights
    window.profileItemCache = window.profileItemCache || {};

window.profileItemCache.lastFoodSearchApiUrl = apiUrl;
window.profileItemCache.lastFoodQuery = searchQuery;
window.profileItemCache.lastCountry = selectedCountry;
window.profileItemCache.lastLayout = "food";
saveProfileItemCache();

//   Make /profile/item able to rebuild the dropdown from the hash
try {
  if (typeof goHash === "function") {
    safeGoHash({ foodSearchUrl: apiUrl });

  } else if (typeof updateHash === "function") {
    updateHash({ foodSearchUrl: apiUrl }, true, "foodSearchUrl");
  }
  // force listeners even if localsite skips history update
  document.dispatchEvent(new Event("hashChangeEvent"));
  window.dispatchEvent(new Event("hashchange"));
} catch (e) {}

syncInsightsPathFromCache();

    const container = document.getElementById("search-results-container");
    container.innerHTML = "<h3>Loading...</h3>";

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                const error = new Error(`HTTP error ${response.status}: ${response.statusText}`);
                error.url = apiUrl;
                throw error;
            }
            return response.json();
        })
        .then(data => {
            if (data.foods && data.foods.length > 0) {
                searchResults = data.foods;
                try {
  const apiKey = "bLecediTVa2sWd8AegmUZ9o7DxYFSYoef9B4i1Ml";
  window.profileItemCache = window.profileItemCache || {};
  window.profileItemCache.lastFoodSearchResults = (data.foods || [])
    .filter(f => f && f.fdcId)
    .map(f => ({
      label: f.description,
      url: `https://api.nal.usda.gov/fdc/v1/food/${f.fdcId}?api_key=${apiKey}`,
      fdcId: f.fdcId
    }));
  saveProfileItemCache();
  if (typeof populateFoodDropdown === "function") populateFoodDropdown();
} catch(e) {}

                displayCategoryResults(categoryQuery);
            } else {
                container.innerHTML = `<p>No foods found in this category.</p>`;
            }
        })
        .catch(error => {
            console.error('Error fetching USDA data:', error);
            let errorDetails = error.message || "Unknown error";
            let urlLink = '';
            if (error.url) {
                const shortName = getShortUrlName(error.url);
                urlLink = `<p><strong>Endpoint:</strong> <a href="${error.url}" target="_blank">${shortName}</a></p>`;
            }
            container.innerHTML = `
                <div class="error-message-container">
                    <h3>Error Loading Foods</h3>
                    <p><strong>Reason:</strong> ${errorDetails}</p>
                    ${urlLink}
                    <p style="margin-bottom: 0;"><em>Please try again or check your connection.</em></p>
                </div>
            `;
        });
}

function displayCategoryResults(categoryName) {
    const container = document.getElementById("search-results-container");
    container.style.display = "";
    container.innerHTML = `
        <div class="search-results-header">
            <div class="search-results-header-text">
                <h3>${titleCaseWords(categoryName)}</h3>
                <div class="search-results-subtitle">Explore items to add to your nutrition menu.</div>
            </div>
            <button class="close-search-btn" onclick="closeSearchResults()" title="Close search results">&times;</button>
        </div>
    `;

    searchResults.forEach((food, index) => {
        const resultDiv = document.createElement("div");
        resultDiv.className = "search-result-item";
        resultDiv.innerHTML = `
            <div class="food-info">
                <strong>${food.description}</strong>
                <br><small>Brand: ${food.brandOwner || 'Generic'}</small>
                <br><small>Category: ${food.foodCategory || 'N/A'}</small>
            </div>
            <button class="add-to-menu-btn btn-success" data-index="${index}">Add</button>
        `;
        container.appendChild(resultDiv);
    });

    // Add event listeners for "Add Item" buttons
    container.querySelectorAll(".add-to-menu-btn").forEach(button => {
        button.onclick = function() {
            const index = parseInt(button.dataset.index);
            const food = searchResults[index];
cacheSelectedFood(food);
addFoodToMenu(food);

        };
    });

    updateMenuLayout();
}

const API_BASE = "https://api.github.com/repos/ModelEarth/products-data/contents";
const RAW_BASE = "https://raw.githubusercontent.com/ModelEarth/products-data/refs/heads/main";
const LOCAL_BASE = "../../products-data";

// Helper function to construct raw GitHub URL
function getRawGitHubUrl(country, category, filename) {
    return `${RAW_BASE}/${country}/${category}/${filename}`;
}

// Helper function to get GitHub token from localStorage
function getGitHubToken() {
    try {
        // Check common storage keys used by project pages
        return localStorage.getItem('githubToken') ||
               localStorage.getItem('github_token') ||
               localStorage.getItem('gitToken') ||
               null;
    } catch (e) {
        console.warn('Could not access localStorage for GitHub token:', e);
        return null;
    }
}

// Helper function to fetch JSON with optional GitHub token
async function fetchJSONWithAuth(url) {
    const token = getGitHubToken();
    const headers = token ? { 'Authorization': `token ${token}` } : {};

    const r = await fetch(url, { headers });
    if (!r.ok) {
        const error = new Error(`HTTP error ${r.status}: ${r.statusText}`);
        error.status = r.status;
        error.statusText = r.statusText;
        error.url = url;
        error.isGitHubAPI = url.includes('api.github.com');
        error.hasToken = !!token;
        throw error;
    }
    return r.json();
}

async function loadProductList() {
    const container = document.getElementById("product-container");
    if (!container) return;

    container.innerHTML = "<h3>Loading regions...</h3>";

    const regions = await fetchJSONWithAuth(API_BASE);
    container.innerHTML = "";

    regions.filter(x => x.type === "dir").forEach(region => {
        const div = document.createElement("div");
        div.classList.add("region-row");
        div.textContent = region.name;
        div.onclick = () => loadCategories(region.name);
        container.appendChild(div);
    });
}

async function loadCategories(region) {
    const container = document.getElementById("product-container");
    container.innerHTML = `<h3>${region}</h3>`;

    const categories = await fetchJSONWithAuth(`${API_BASE}/${region}`);

    categories.filter(x => x.type === "dir").forEach(cat => {
        const div = document.createElement("div");
        div.classList.add("category-row");
        div.textContent = cat.name;
        div.onclick = () => loadItems(region, cat.name);
        container.appendChild(div);
    });
}

async function loadItems(region, category) {
    const container = document.getElementById("product-container");
    container.innerHTML = `<h3>${region} / ${category}</h3>`;

    const files = await fetchJSONWithAuth(`${API_BASE}/${region}/${category}`);

    files.filter(x => x.type === "file" && x.name.endsWith(".yaml")).forEach(file => {
        const id = file.name.replace(".yaml", "");  
            
            const row = document.createElement("div");
            row.classList.add("file-row");
            row.textContent = id;

            row.onclick = () => {
                // Hide UUID list
                container.style.display = "none";

                // Update URL hash
                if (typeof updateHash === "function") {
                    updateHash({
                        layout: "product",
                        country: region,
                        id: id
                    });
                }

                loadYAMLProfile(region, category, file);
            };
        container.appendChild(row);
    });
}

async function loadProductByCountryAndId(region, id) {
    try {
        const categories = await fetchJSONWithAuth(`${API_BASE}/${region}`);

        for (const cat of categories.filter(x => x.type === "dir")) {
            const files = await fetchJSONWithAuth(`${API_BASE}/${region}/${cat.name}`);
            const match = files.find(
                f => f.type === "file" && f.name.replace(".yaml", "") === id
            );

            if (match) {
                const container = document.getElementById("product-container");
                if (container) {
                    container.innerHTML = `<h3>${region} / ${cat.name}</h3>`;
                }

                await loadYAMLProfile(region, cat.name, match);
                return;
            }
        }
    } catch (error) {
        console.error("Error loading product from hash:", error);
        const container = document.getElementById("product-label");
        if (!container) return;

        let errorDetails = error.message || "Unknown error";
        let urlLink = '';
        let githubInfo = '';

        if (error.url) {
            const shortName = getShortUrlName(error.url);
            urlLink = `<p><strong>Endpoint:</strong> <a href="${error.url}" target="_blank">${shortName}</a></p>`;
        }

        // Add GitHub API specific guidance
        if (error.isGitHubAPI) {
            githubInfo = `
                <p style="margin-top: 15px;"><strong>GitHub API Access:</strong></p>
                <p>This error occurred while searching for the product in GitHub's API. ${error.hasToken ? 'A GitHub token was used but may be invalid or expired.' : 'No GitHub token found in browser cache.'}</p>
                <p>To improve API rate limits and avoid errors, set your GitHub token on:</p>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li><a href="/projects/hub/" target="_blank">Project Hub</a></li>
                    <li><a href="/team/projects/#list=modelteam&showrepos=true" target="_blank">Team Project Repos</a></li>
                </ul>
            `;
        }

        container.innerHTML = `
            <div class="error-message-container">
                <h3>Error Loading Product</h3>
                <p><strong>Reason:</strong> ${errorDetails}</p>
                ${urlLink}
                ${githubInfo}
                <p style="margin-bottom: 0;"><em>Please try again or check your connection.</em></p>
            </div>
        `;
    }
}


async function loadYAMLProfile(region, category, file) {
    // Construct raw GitHub URL instead of using API download_url
    const rawUrl = getRawGitHubUrl(region, category, file.name);
    let yamlText = "";
    let data = null;
    try {
        yamlText = await fetchText(rawUrl);
        data = jsyaml.load(yamlText);
    } catch (error) {
        console.error("Error loading YAML:", error);
        const container = document.getElementById("product-label");
        if (container) {
            const linkUrl = error && error.url ? error.url : rawUrl;
            const linkText = getShortUrlName(linkUrl);
            container.innerHTML = `
                <div class="error-message-container">
                    <h3>Error Loading Product</h3>
                    <p><strong>Reason:</strong> ${error?.message || "Unknown error"}</p>
                    <p><strong>File not found:</strong> <a href="${linkUrl}" target="_blank">${linkText}</a></p>
                </div>
            `;
        }
        return;
    }

    // Update YAML Source link with the category display_name from the loaded YAML
    const yamlCategory = data.category?.display_name;
    if (yamlCategory && typeof updateYAMLSourceLink === 'function') {
        updateYAMLSourceLink(yamlCategory);
    }

    // Use the comprehensive profile object creator from layout-product.js
    const profile = typeof createProductProfileObject === "function"
        ? createProductProfileObject(data)
        : createProfileObject(data);

    const uuidListContainer = document.getElementById("product-container");
    if (uuidListContainer) {
        uuidListContainer.innerHTML = "";
        uuidListContainer.style.display = "none";
    }

    const container = document.getElementById("product-label");
    if (!container) return;

    // Clear old content
    container.innerHTML = "";

    // Add breadcrumb at the very top (outside all other containers)
    if (typeof renderCategoryBreadcrumb === "function") {
        container.appendChild(renderCategoryBreadcrumb(data));
    }

    // Create a flex container for label and details side by side
    const mainContent = document.createElement("div");
    mainContent.className = "product-main-content";

    // Render the product impact label using new label-product.js if available
    if (typeof renderProductLabel === "function") {
        mainContent.appendChild(renderProductLabel(profile, 1));
    } else {
        const labelWrapper = document.createElement("div");
        labelWrapper.className = "product-label-wrapper";
        labelWrapper.appendChild(renderNutritionLabel(profile, 1, false));
        mainContent.appendChild(labelWrapper);
    }

    // Render comprehensive product details panel with calculators integrated
    if (typeof renderProductDetailsPanelWithCalculators === "function") {
        const detailsWrapper = document.createElement("div");
        detailsWrapper.className = "product-details-wrapper";
        detailsWrapper.appendChild(renderProductDetailsPanelWithCalculators(data, profile));
        mainContent.appendChild(detailsWrapper);
    } else if (typeof renderProductDetailsPanel === "function") {
        const detailsWrapper = document.createElement("div");
        detailsWrapper.className = "product-details-wrapper";
        detailsWrapper.appendChild(renderProductDetailsPanel(data));
        mainContent.appendChild(detailsWrapper);
    }

    container.appendChild(mainContent);
}

// Travel distance calculator based on the YAML spec in products.md
function setupTravelDistanceCalculator(epdData, parentEl) {
    const container = parentEl || document.getElementById("product-label");
    if (!container) return;

    // Pull values from the EPD YAML - try multiple possible field names
    const baseGwp = parseNumeric(epdData.gwp) ||
        parseNumeric(epdData.gwp_per_category_declared_unit) ||
        parseNumeric(epdData.gwp_per_declared_unit);

    const massPerDeclaredUnit = parseNumeric(epdData.mass_per_declared_unit) ||
        parseNumeric(epdData.mass);

    // Try nested category object first, then flattened fields
    let defaultDistance = NaN;
    if (epdData.category && typeof epdData.category === "object") {
        defaultDistance = parseNumeric(epdData.category.default_distance);
    }
    if (!isFinite(defaultDistance)) {
        defaultDistance = parseNumeric(epdData.category_default_distance) ||
            parseNumeric(epdData.default_distance);
    }

    // If any core field is missing, skip the calculator
    if (!isFinite(baseGwp) || !isFinite(massPerDeclaredUnit) || !isFinite(defaultDistance)) {
        console.log("Travel calculator missing data:", { baseGwp, massPerDeclaredUnit, defaultDistance });
        return;
    }

    const EMISSION_FACTOR = 0.062; // kgCO2e / ton-km (truck, unspecified)

    // Wrapper for the calculator UI
    const wrapper = document.createElement("div");
    wrapper.id = "travel-impact-wrapper";
    wrapper.style.marginTop = "1em";
    wrapper.style.padding = "10px";
    wrapper.style.border = "1px solid #ccc";
    wrapper.style.borderRadius = "4px";
    wrapper.style.background = "#f9f9f9";
    wrapper.style.fontSize = "13px";

    wrapper.innerHTML = `
        <div style="font-weight:bold; margin-bottom:4px;">
            Transportation to Site (A4)
        </div>

        <label style="display:block; margin-bottom:4px;">
            Travel distance to site (km):
            <input type="number"
                   id="travel-distance-input"
                   min="0"
                   step="10"
                   style="width:120px; margin-left:4px;">
        </label>

        <div id="travel-impact-results" style="margin-top:4px;"></div>

        <div style="font-size:11px; color:#555; margin-top:6px;">
            Uses <code>gwp</code>, <code>mass_per_declared_unit</code>,
            and <code>category.default_distance</code> from the product YAML.
            Emission factor: 0.062 kgCO₂e/ton-km.
        </div>
    `;

    container.appendChild(wrapper);

    const distanceInput = wrapper.querySelector("#travel-distance-input");
    const resultsDiv = wrapper.querySelector("#travel-impact-results");

    function formatKg(v) {
        return v.toFixed(1);
    }

    function recalc(distanceKm) {
        const d = Math.max(0, distanceKm || 0);

        // Default and actual A4 transport impacts
        const defaultA4 = (defaultDistance * massPerDeclaredUnit * EMISSION_FACTOR) / 1000;
        const actualA4 = (d * massPerDeclaredUnit * EMISSION_FACTOR) / 1000;

        const adjustedGwp = baseGwp + (actualA4 - defaultA4);
        const savings = defaultA4 - actualA4;

        resultsDiv.innerHTML = `
            <div>Base product GWP (A1–A3): <strong>${formatKg(baseGwp)} kgCO₂e</strong></div>
            <div>Default transport (${defaultDistance.toFixed(0)} km): <strong>${formatKg(defaultA4)} kgCO₂e</strong></div>
            <div>Actual transport (${d.toFixed(0)} km): <strong>${formatKg(actualA4)} kgCO₂e</strong></div>
            <div style="margin-top:4px;">
                Adjusted total (A1–A3 + A4): <strong>${formatKg(adjustedGwp)} kgCO₂e</strong>
            </div>
            <div>
                ${savings >= 0 ? "Savings" : "Increase"} vs. default:
                <strong>${formatKg(Math.abs(savings))} kgCO₂e</strong>
            </div>
        `;
    }

    // Initialize with the category default distance from YAML
    distanceInput.value = isFinite(defaultDistance) ? defaultDistance.toFixed(0) : "0";
    recalc(parseFloat(distanceInput.value));

    distanceInput.addEventListener("input", function () {
        const v = parseFloat(distanceInput.value);
        if (!isNaN(v)) recalc(v);
    });
}

function getShortUrlName(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        const shortPath = pathParts.slice(0, 2).join('/');
        return `${urlObj.hostname}/${shortPath}${pathParts.length > 2 ? '/...' : ''}`;
    } catch (e) {
        // If URL parsing fails, just return the url as-is
        return url;
    }
}

async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) {
        const error = new Error(`HTTP error ${r.status}: ${r.statusText}`);
        error.status = r.status;
        error.statusText = r.statusText;
        error.url = url;
        throw error;
    }
    return r.json();
}
async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) {
        const error = new Error(`HTTP error ${r.status}: ${r.statusText}`);
        error.status = r.status;
        error.statusText = r.statusText;
        error.url = url;
        throw error;
    }
    return r.text();
}

function addUSDASearchBar() {
    let searchDiv = document.getElementById("search-div");
    if (!searchDiv) return;

    if (!searchDiv.innerHTML.trim()) {
        const hash = (typeof getHash === "function") ? getHash() : getUrlHash();
        const isProductView = hash.layout === "product";
        const placeholder = isProductView ? "Search Products" : "Search USDA Food Database";

        searchDiv.style.marginBottom = "1em";
        searchDiv.innerHTML = `
            <div class="search-controls-left">
                <select id="country-dropdown" style="margin-right: 10px;">
                    <option value="US" ${selectedCountry === 'US' ? 'selected' : ''}>US</option>
                    <option value="IN" ${selectedCountry === 'IN' ? 'selected' : ''}>India</option>
                    <option value="GB" ${selectedCountry === 'GB' ? 'selected' : ''}>GB</option>
                    <option value="DE" ${selectedCountry === 'DE' ? 'selected' : ''}>DE</option>
                </select>
                <input type="text" id="search-input" placeholder="${placeholder}" style="width:300px;">
                <button id="usda-search-button" class="add-to-menu-btn">Search</button>
                <button id="usda-clear-button" class="remove-item-btn">Clear</button>
            </div>
            <div class="search-controls-right" id="search-controls-right"></div>
        `;

        const rightControls = document.getElementById("search-controls-right");
        const menuSetSelector = document.getElementById("menu-set-selector");
        const menuOptionsWrapper = document.getElementById("menu-options-wrapper");
        if (rightControls) {
            if (menuSetSelector) rightControls.appendChild(menuSetSelector);
            if (menuOptionsWrapper) rightControls.appendChild(menuOptionsWrapper);
        }

        // Add country dropdown change handler
        const countryDropdown = document.getElementById("country-dropdown");
        if (countryDropdown) {
            countryDropdown.addEventListener("change", function() {
                selectedCountry = this.value;
                // Update hash with new country
                if (typeof goHash === "function") {
                    goHash({ country: selectedCountry }, "country,cat,id");
                } else {
                    window.location.hash = `country=${selectedCountry}`;
                }

                // Trigger search for India when on food menu (not product menu)
                const hash = (typeof getHash === "function") ? getHash() : getUrlHash();
                if (hash.layout !== "product" && selectedCountry === "IN") {
                    searchUSDAFood("India");
                }
            });
        }
    }

     if (window.__usdaListenersAdded) return;
  window.__usdaListenersAdded = true;
    // Event listeners for search functionality
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'usda-search-button') {
            const query = document.getElementById("search-input").value.trim();
            const hash = (typeof getHash === "function") ? getHash() : getUrlHash();
            if (hash.layout === "product") {
                // Product search - not implemented yet
                console.log("Product search not yet implemented");
            } else {
                searchUSDAFood(query);
            }
        }
        if (e.target && e.target.id === 'usda-clear-button') {
            clearSearchResults();
        }
    });
    document.addEventListener("keypress", function(e) {
        if (e.target && e.target.id === "search-input" && e.key === "Enter") {
            const btn = document.getElementById("usda-search-button");
            if (btn) btn.click();
        }
    });
}

function searchUSDAFood(query = "apple", targetContainer = null) {
    const apiKey = "bLecediTVa2sWd8AegmUZ9o7DxYFSYoef9B4i1Ml";

    // Add country-specific search terms
    let searchQuery = query;
    if (selectedCountry === "IN") {
        searchQuery = query + " India";
    } else if (selectedCountry === "US") {
        searchQuery = query + " American";
    }
const q = encodeURIComponent(String(query || "").trim());
    const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${q}`;
    window.profileItemCache = window.profileItemCache || {};

    // Cache for Insights
window.profileItemCache.lastFoodSearchApiUrl = apiUrl;
window.profileItemCache.lastFoodQuery = searchQuery;
window.profileItemCache.lastCountry = selectedCountry;
window.profileItemCache.lastLayout = "food";
saveProfileItemCache();
//   Make /profile/item able to rebuild the dropdown from the hash
try {
  if (typeof goHash === "function") {
    safeGoHash({ foodSearchUrl: apiUrl });

  } else if (typeof updateHash === "function") {
    updateHash({ foodSearchUrl: apiUrl }, true, "foodSearchUrl");
  }
  // force listeners even if localsite skips history update
  document.dispatchEvent(new Event("hashChangeEvent"));
  window.dispatchEvent(new Event("hashchange"));
} catch (e) {}

if (typeof populateFoodDropdown === "function") {
  populateFoodDropdown();
}



console.log("Cached USDA API URL:", apiUrl);

// Force Insights YAML to update
if (typeof applyCachedFoodApiUrlToYaml === "function") {
    applyCachedFoodApiUrlToYaml();
}

syncInsightsPathFromCache();


    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                const error = new Error(`HTTP error ${response.status}: ${response.statusText}`);
                error.url = apiUrl;
                throw error;
            }
            return response.json();
        })
        .then(data => {
            if (data.foods && data.foods.length > 0) {
                searchResults = data.foods;
                try {
  window.profileItemCache = window.profileItemCache || {};
  window.profileItemCache.recentFoods = window.profileItemCache.recentFoods || [];

  const apiKey = "bLecediTVa2sWd8AegmUZ9o7DxYFSYoef9B4i1Ml";

  // Convert search results into dropdown entries
  const batch = data.foods
    .filter(f => f && f.fdcId)
    .map(f => ({
      label: f.description,
      url: `https://api.nal.usda.gov/fdc/v1/food/${f.fdcId}?api_key=${apiKey}`
    }));

    window.profileItemCache.lastFoodSearchResults = batch;

  // merge + de-dupe by url, keep latest first
  const existing = window.profileItemCache.recentFoods;
  const merged = [...batch, ...existing];
  const seen = new Set();
  window.profileItemCache.recentFoods = merged.filter(x => {
    if (!x?.url || seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  }).slice(0, 200); // keep as many as you want

  saveProfileItemCache();
  //   Only call this if /profile/item loaded that function
if (typeof populateFoodDropdown === "function") {
  populateFoodDropdown();
}

} catch (e) {
  console.warn("Failed to cache search results:", e);
}

                if (targetContainer) {
                    displaySearchResults(targetContainer);
                } else {
                    displaySearchResults();
                }
            } else {
                console.log('No foods found for query:', searchQuery);
                if (targetContainer) {
                    targetContainer.innerHTML = "<p>No foods found.</p>";
                } else {
                    clearSearchResults();
                }
            }
        })
        .catch(error => {
            console.error('Error fetching USDA data:', error);
            const container = targetContainer || document.getElementById("search-results-container");
            if (!targetContainer) {
                container.style.display = "";
            }
            let errorDetails = error.message || "Unknown error";
            let urlLink = '';
            if (error.url) {
                const shortName = getShortUrlName(error.url);
                urlLink = `<p><strong>Endpoint:</strong> <a href="${error.url}" target="_blank">${shortName}</a></p>`;
            }
            container.innerHTML = `
                <div class="search-results-header">
                    <h3>Search Error</h3>
                    ${!targetContainer ? '<button class="close-search-btn" onclick="closeSearchResults()" title="Close search results">&times;</button>' : ''}
                </div>
                <div class="error-message-container">
                    <p><strong>Reason:</strong> ${errorDetails}</p>
                    ${urlLink}
                    <p style="margin-bottom: 0;"><em>Please try again or check your connection.</em></p>
                </div>
            `;
        });
}

function displaySearchResults(targetContainer = null) {
    const container = targetContainer || document.getElementById("search-results-container");

    if (!targetContainer) {
        container.style.display = "";
    }

    container.innerHTML = `
        <div class="search-results-header">
            <div class="search-results-header-text">
                <h3>Search Results</h3>
                <div class="search-results-subtitle">Explore items to add to your nutrition menu.</div>
            </div>
            ${!targetContainer ? '<button class="close-search-btn" onclick="closeSearchResults()" title="Close search results">&times;</button>' : ''}
        </div>
    `;

    searchResults.forEach((food, index) => {
        const resultDiv = document.createElement("div");
        resultDiv.className = "search-result-item";
        resultDiv.innerHTML = `
            <div class="food-info">
                <strong>${food.description}</strong><br>
                <small>Brand: ${food.brandOwner || 'Generic'}</small><br>
                <small>Category: ${food.foodCategory || 'N/A'}</small>
            </div>
            <button class="add-to-menu-btn btn-success" data-index="${index}">Add</button>
        `;
        container.appendChild(resultDiv);
    });

    // Add event listeners for "Add Item" buttons
    container.querySelectorAll(".add-to-menu-btn").forEach(button => {
        button.onclick = function() {
            const index = parseInt(button.dataset.index);
            const food = searchResults[index];
cacheSelectedFood(food);
addFoodToMenu(food);

        };
    });

    if (!targetContainer) {
        updateMenuLayout();
    }
}

function clearSearchResults() {
    const container = document.getElementById("search-results-container");
    container.innerHTML = "";
    displayInitialFoodItems();
    updateMenuLayout();
}

function displayInitialFoodItems() {
    const initialFoods = [
        { description: "Bananas, raw", brandOwner: null, foodCategory: "Fruits and Fruit Juices" },
        { description: "Chicken breast, boneless, skinless, raw", brandOwner: null, foodCategory: "Poultry Products" },
        { description: "Broccoli, raw", brandOwner: null, foodCategory: "Vegetables and Vegetable Products" },
        { description: "Salmon, Atlantic, farmed, raw", brandOwner: null, foodCategory: "Finfish and Shellfish Products" },
        { description: "Brown rice, medium-grain, raw", brandOwner: null, foodCategory: "Cereal Grains and Pasta" },
        { description: "Almonds", brandOwner: null, foodCategory: "Nut and Seed Products" },
        { description: "Greek yogurt, plain, nonfat", brandOwner: null, foodCategory: "Dairy and Egg Products" },
        { description: "Sweet potato, raw", brandOwner: null, foodCategory: "Vegetables and Vegetable Products" },
        { description: "Eggs, whole, raw", brandOwner: null, foodCategory: "Dairy and Egg Products" },
        { description: "Spinach, raw", brandOwner: null, foodCategory: "Vegetables and Vegetable Products" }
    ];

    const container = document.getElementById("search-results-container");
    if (container) {
        container.style.display = "";
        container.innerHTML = `
            <div class="search-results-header">
                <div class="search-results-header-text">
                    <h3>Popular Foods</h3>
                    <div class="search-results-subtitle">Explore items to add to your nutrition menu.</div>
                </div>
                <button class="close-search-btn" onclick="closeSearchResults()" title="Close search results">&times;</button>
            </div>
        `;

        initialFoods.forEach((food, index) => {
            const resultDiv = document.createElement("div");
            resultDiv.className = "search-result-item initial-food-item";
            resultDiv.dataset.index = index;
            resultDiv.innerHTML = `
                <div class="food-info">
                    <strong>${food.description}</strong><br>
                    <small>Brand: ${food.brandOwner || 'Generic'} | Category: ${food.foodCategory || 'N/A'}</small>
                </div>
                <i class="material-icons toggle-arrow">chevron_right</i>
            `;

            // Create a container for the expanded search results
            const expandedContainer = document.createElement("div");
            expandedContainer.className = "expanded-search-results";
            expandedContainer.style.display = "none";

            container.appendChild(resultDiv);
            container.appendChild(expandedContainer);
        });

        // Add event listeners for clickable items
        container.querySelectorAll(".initial-food-item").forEach(item => {
            item.onclick = async function(e) {
                const index = parseInt(item.dataset.index);
                const food = initialFoods[index];
                const arrow = item.querySelector('.toggle-arrow');
                const expandedContainer = item.nextElementSibling;

                // Toggle the expanded state
                if (expandedContainer.style.display === "none") {
                    // Close any other open items
                    container.querySelectorAll('.expanded-search-results').forEach(el => {
                        if (el !== expandedContainer) {
                            el.style.display = "none";
                            el.innerHTML = "";
                        }
                    });
                    container.querySelectorAll('.toggle-arrow').forEach(el => {
                        if (el !== arrow) {
                            el.textContent = "chevron_right";
                        }
                    });

                    // Open this item
                    arrow.textContent = "expand_more";
                    expandedContainer.style.display = "block";

                    // Load search results
                    expandedContainer.innerHTML = "<p>Searching...</p>";
                    await searchUSDAFood(food.description, expandedContainer);
                } else {
                    // Close this item
                    arrow.textContent = "chevron_right";
                    expandedContainer.style.display = "none";
                    expandedContainer.innerHTML = "";
                }
            };
        });

        updateMenuLayout();
    }
}

function cacheSelectedFood(food) {
  try {
    const apiKey = "bLecediTVa2sWd8AegmUZ9o7DxYFSYoef9B4i1Ml";
    const foodLabel = food?.description || "Selected food";
    const foodApiUrl = `https://api.nal.usda.gov/fdc/v1/food/${food.fdcId}?api_key=${apiKey}`;

    window.profileItemCache = window.profileItemCache || {};
    window.profileItemCache.recentFoods = window.profileItemCache.recentFoods || [];

    const entry = { label: foodLabel, url: foodApiUrl };

    window.profileItemCache.recentFoods = [
  entry,
  ...(window.profileItemCache.recentFoods.filter(x => x.url !== foodApiUrl))
].slice(0, 200);


    // This is what Insights should use
    window.profileItemCache.lastFoodApiUrl = foodApiUrl;

    // persist
    saveProfileItemCache();

    // push into hash/yaml if needed
    syncInsightsPathFromCache();
  } catch (e) {
    console.warn("cacheSelectedFood failed:", e);
  }
}


function addFoodToMenu(food) {

    cacheSelectedFood(food);

    // Check if food is already in menu
    const existingIndex = menuItems.findIndex(item =>
        item.profileObject.itemName === food.description
    );

    if (existingIndex >= 0) {
        // Increase quantity if already in menu
        menuItems[existingIndex].quantity++;
    } else {
        // Add new item to menu
        menuItems.push({
            profileObject: usdaProfileObject(food),
            quantity: 1,
        });
    }

    renderMenuLabels();
}

function usdaProfileObject(usdaItem) {
    const nutrients = {};
    (usdaItem.foodNutrients || []).forEach(nutrient => {
        if (nutrient.nutrientName && nutrient.value !== undefined) {
            nutrients[nutrient.nutrientName] = nutrient.value;
        }
    });

    // Handle energy/calories
    let calories = 0;
    (usdaItem.foodNutrients || []).forEach(nutrient => {
        if ((nutrient.nutrientName === "Energy" || nutrient.nutrientName === "Calories") && nutrient.unitName === "KCAL") {
            calories = nutrient.value;
        }
    });

    // Create a more flexible lookup that tries multiple possible names
   const getValue = (nutrientName) => {
  if (Array.isArray(nutrientName)) {
    for (const n of nutrientName) {
      if (nutrients[n] !== undefined) return nutrients[n];
    }
    return 0;
  }
  return nutrients[nutrientName] !== undefined ? nutrients[nutrientName] : 0;
};


    return {
        itemName: usdaItem.description,
        sections: [
            { name: "Calories", value: calories },
            {
                name: "Calories from Fat",
                value: getValue(["Total lipid (fat)"]) * 9
            },
            {
                name: "Total Fat",
                value: getValue("Total lipid (fat)"),
                dailyValue: calculateDailyValue(getValue("Total lipid (fat)"), 'fat'),
                subsections: [
                    {
                        name: "Saturated Fat",
                        value: getValue("Fatty acids, total saturated"),
                        dailyValue: calculateDailyValue(getValue("Fatty acids, total saturated"), 'satFat')
                    },
                    {
                        name: "Trans Fat",
                        value: getValue("Fatty acids, total trans")
                    }
                ]
            },
            {
                name: "Cholesterol",
                value: getValue(["Cholesterol"]),
                dailyValue: calculateDailyValue(getValue(["Cholesterol"]), 'cholesterol')
            },
            {
                name: "Sodium",
                value: getValue("Sodium, Na"),
                dailyValue: calculateDailyValue(getValue("Sodium, Na"), 'sodium')
            },
            {
                name: "Total Carbohydrate",
                value: getValue("Carbohydrate, by difference"),
                dailyValue: calculateDailyValue(getValue("Carbohydrate, by difference"), 'carb'),
                subsections: [
                    {
                        name: "Dietary Fiber",
                        value: getValue("Fiber, total dietary"),
                        dailyValue: calculateDailyValue(getValue("Fiber, total dietary"), 'fiber')
                    },
                    {
                        name: "Sugars",
                        value: getValue("Total Sugars")
                    }
                ]
            },
            { name: "Protein", value: getValue("Protein") },
            {
                name: "Vitamin D",
                value: getValue("Vitamin D (D2 + D3)"),
                dailyValue: calculateDailyValue(getValue("Vitamin D (D2 + D3)"), 'vitaminD')
            },
            {
                name: "Potassium",
                value: getValue("Potassium, K"),
                dailyValue: calculateDailyValue(getValue("Potassium, K"), 'potassium')
            },
            {
                name: "Calcium",
                value: getValue("Calcium, Ca"),
                dailyValue: calculateDailyValue(getValue("Calcium, Ca"), 'calcium')
            },
            {
                name: "Iron",
                value: getValue("Iron, Fe"),
                dailyValue: calculateDailyValue(getValue(["Iron, Fe", "Iron"]), 'iron')
            },
            { name: "Added Sugars", value: 0, dailyValue: null },
            { name: "Caffeine", value: getValue(["Caffeine"]) }
        ]
    };
}

function closeSearchResults() {
    const searchContainer = document.getElementById("search-results-container");
    if (searchContainer) {
        searchContainer.style.display = "none";
    }
    updateMenuLayout();
}

function updateMenuLayout() {
    const searchContainer = document.getElementById("search-results-container");
    const layoutWrapper = document.querySelector(".menu-layout-wrapper");
    const allMenuItems = document.querySelector(".all-menu-items");

    if (!searchContainer || !layoutWrapper) return;

    // Check if search results container is visible and has content
    const hasSearchResults = searchContainer.style.display !== "none" &&
                            searchContainer.innerHTML.trim() !== "";

    if (hasSearchResults) {
        // Search results shown: apply column layout
        layoutWrapper.classList.add("has-search-results");
        if (allMenuItems) {
            allMenuItems.classList.add("in-right-column");
        }
    } else {
        // No search results: normal side-by-side layout
        layoutWrapper.classList.remove("has-search-results");
        if (allMenuItems) {
            allMenuItems.classList.remove("in-right-column");
        }
    }
}

function renderMenuLabels() {
    const container = document.getElementById("menu-container");
    if (container) {
        // Preserve search results container's display state before clearing
        let existingSearchContainer = document.getElementById("search-results-container");
        let searchContainerWasVisible = existingSearchContainer && existingSearchContainer.style.display !== "none";
        let searchContainerContent = existingSearchContainer ? existingSearchContainer.innerHTML : "";

        container.innerHTML = "";

        // Add settings toggle for food labels (only once at the top)
        if (menuItems.length > 0 && typeof createSettingsToggle === "function") {
            const existingSettings = document.getElementById("food-settings-container");
            if (!existingSettings) {
                const settingsDiv = document.createElement("div");
                settingsDiv.id = "food-settings-container";
                settingsDiv.style.marginBottom = "15px";
                container.appendChild(settingsDiv);

                createSettingsToggle("food-settings-container", (newSettings) => {
                    // Re-render all labels with new settings
                    renderMenuLabels();
                });
            }
        }

        // Create wrapper for side-by-side layout of search results and menu
        const menuWithSearchLayout = document.createElement("div");
        menuWithSearchLayout.className = "menu-with-search-layout";

        // Create or get search results container and add it to the wrapper
        let searchResultsContainer = document.getElementById("search-results-container");
        if (!searchResultsContainer) {
            searchResultsContainer = document.createElement("div");
            searchResultsContainer.id = "search-results-container";
            // Restore previous display state, or hide if it's the very first time
            if (searchContainerWasVisible) {
                searchResultsContainer.style.display = "block";
            } else {
                searchResultsContainer.style.display = "none";
            }
            // Restore previous content
            searchResultsContainer.innerHTML = searchContainerContent;
        }

        // Add search results to wrapper
        menuWithSearchLayout.appendChild(searchResultsContainer);

        // Create layout wrapper for aggregate + all-menu-items
        const layoutWrapper = document.createElement("div");
        layoutWrapper.className = "menu-layout-wrapper";

        // Create a single container div for all menu items
        const allItemsContainer = document.createElement("div");
        allItemsContainer.classList.add("all-menu-items");

        menuItems.forEach((item, idx) => {
            const itemDiv = document.createElement("div");
            itemDiv.classList.add("menu-label");

            // Create collapsible header
            const header = document.createElement("div");
            header.classList.add("collapsible-header");

    // Extract calories value (fallback to 0 if not found)
    const caloriesSection = item.profileObject.sections.find(s => s.name.toLowerCase().includes("calories"));
    const caloriesValue = caloriesSection ? Math.round(caloriesSection.value) : 0;

    header.innerHTML = `
  <div class="header-left">
    <span class="item-title">${item.profileObject.itemName}</span>
  </div>
  <div class="header-right">
    <div class="quantity-controls">
      <input class="quantity-input" type="number" value="${item.quantity}" min="1" step="1" data-index="${idx}">
      <button class="remove-item-btn" data-idx="${idx}">X</button>
    </div>
    <span class="calories-label">${caloriesValue} kcal</span>
    <span class="arrow">▼</span>
  </div>
`;


            // Create collapsible content
            const content = document.createElement("div");
            content.classList.add("collapsible-content");
            content.appendChild(renderNutritionLabel(item.profileObject, item.quantity, false, idx));

            // Click toggle behavior
            header.addEventListener("click", (e) => {
                // Prevent clicks on quantity input or remove button from toggling collapse
                if (e.target.closest(".quantity-input") || e.target.closest(".remove-item-btn")) return;

                const arrow = header.querySelector(".arrow");
                const expanded = content.classList.contains("open");

                if (expanded) {
                    content.classList.remove("open");
                    content.style.display = "none";
                    arrow.textContent = "▼";
                } else {
                    content.classList.add("open");
                    content.style.display = "block";
                    arrow.textContent = "▲";
                }
            });




            itemDiv.appendChild(header);
            itemDiv.appendChild(content);
            allItemsContainer.appendChild(itemDiv);
            if (idx === menuItems.length - 1) {
                // only expand the newly added item; keep others closed
                content.classList.add("open");
                content.style.display = "block";
                header.querySelector(".arrow").textContent = "▲";
              } else {
                // keep others collapsed
                content.classList.remove("open");
                content.style.display = "none";
                header.querySelector(".arrow").textContent = "▼";
              }
          });


        // Add all items container to layout wrapper FIRST
        if (menuItems.length > 0) {
            layoutWrapper.appendChild(allItemsContainer);
        }

        // Add aggregate label AFTER all-menu-items
        if (menuItems.length > 0) {
            updateAggregateProfile();
            layoutWrapper.appendChild(renderNutritionLabel(aggregateProfile, 1, true));
        }

        // Add layout wrapper to the menu-with-search wrapper
        menuWithSearchLayout.appendChild(layoutWrapper);

        // Append the complete wrapper to main container
        container.appendChild(menuWithSearchLayout);

        // Check if search results are shown and update layout class
        updateMenuLayout();

// FIXED: Event listeners for quantity controls - re-render entire menu
container.querySelectorAll(".quantity-input").forEach(input => {
    input.onchange = function () {
        const idx = +input.dataset.index;
        menuItems[idx].quantity = Math.max(1, parseInt(input.value) || 1);
      
        // Update header calories immediately
        updateHeaderCalories();
      
        // Update the meal total (aggregate)
        updateAggregateProfile();
        const aggContainer = document.querySelector(".aggregate");
        if (aggContainer) {
            aggContainer.innerHTML = "";
            aggContainer.appendChild(renderNutritionLabel(aggregateProfile, 1, true));
        }
      
        // CRITICAL FIX: Re-render the entire menu to update all quantities and totals
        // This ensures all event listeners are properly re-attached
        renderMenuLabels();
    };
});
          

        container.querySelectorAll(".remove-item-btn").forEach(button => {
            button.onclick = function () {
                const idx = +button.dataset.idx;
                removeFromMenu(idx);
            };
        });
    } else {
        console.log("Item menu-container not found");
    }




}

function removeFromMenu(index) {
    menuItems.splice(index, 1);
    renderMenuLabels();
}

function renderNutritionLabel(profileObject, quantity = 1, isAggregate = false, itemIndex = null, options = {}) {
    const settings = typeof getLabelSettings === "function" ? getLabelSettings() : { style: "fda", verbosity: "medium" };
    const style = options.style || settings.style;

    // Use badge style if selected (for food labels too)
    if (style === "badge" && !isAggregate) {
        return renderFoodBadgeStyle(profileObject, quantity);
    }

    // Default FDA style
    const div = document.createElement("div");
    div.className = isAggregate ? "nutrition-label aggregate fda-style" : "nutrition-label fda-style";

    // Header section with item name only — no quantity or X button
    div.innerHTML = `
      <div class="item-label-header">
        <div class="item-name">${profileObject.itemName}</div>
      </div>
      <hr class="thick-line">
      <div class="serving-size">Amount Per Serving</div>
      <hr class="thin-line">
    `;

    profileObject.sections.forEach(section => {
      const val = (section.value * quantity);
      const unit = getUnit(section.name);
      const formattedVal = formatValue(val, section.name);
      const dailyValue = section.dailyValue ? Math.round(section.dailyValue * quantity) : null;

      const sectionDiv = document.createElement("div");
      sectionDiv.className = "nutrition-section";
      sectionDiv.innerHTML = `
        <div class="section-title">
          <span><strong>${section.name}</strong> <span class="value">${formattedVal}${unit}</span></span>
          <span class="daily-value">${dailyValue ? dailyValue + '%' : ''}</span>
        </div>
      `;

      if (section.subsections) {
        section.subsections.forEach(subsection => {
          const subVal = (subsection.value * quantity);
          const subUnit = getUnit(subsection.name);
          const subFormattedVal = formatValue(subVal, subsection.name);
          const subDailyValue = subsection.dailyValue ? Math.round(subsection.dailyValue * quantity) : null;

          const subSectionDiv = document.createElement("div");
          subSectionDiv.className = "sub-section";
          subSectionDiv.innerHTML = `
            <span>${subsection.name}</span>
            <span class="value">${subFormattedVal}${subUnit}</span>
            <span class="daily-value">${subDailyValue ? subDailyValue + '%' : ''}</span>
          `;
          sectionDiv.appendChild(subSectionDiv);
        });
      }

      div.appendChild(sectionDiv);
      div.appendChild(document.createElement('hr')).classList.add('thin-line');
    });

    return div;
}

// Environmental Badge Style for Food Labels
function renderFoodBadgeStyle(profileObject, quantity = 1) {
    const div = document.createElement("div");
    div.className = "eco-badge-label food-label badge-style";

    // Get calories for the main badge
    const caloriesSection = profileObject.sections.find(s =>
        s.name.toLowerCase().includes("calories") && !s.name.toLowerCase().includes("from fat")
    );
    const calories = caloriesSection ? caloriesSection.value * quantity : 0;

    // Determine calorie rating
    const calorieRating = getCalorieRating(calories);

    div.innerHTML = `
        <div class="eco-badge-header">
            <div class="product-info">
                <div class="product-name">${profileObject.itemName}</div>
                <div class="declared-unit">Per ${quantity > 1 ? quantity + " " : ""}Serving</div>
            </div>
            <div class="eco-score-badge" style="background-color: ${calorieRating.color}">
                <div class="score-value">${Math.round(calories)}</div>
                <div class="score-unit">kcal</div>
                <div class="score-label">${calorieRating.label}</div>
            </div>
        </div>
    `;

    // Nutrient breakdown
    const breakdownDiv = document.createElement("div");
    breakdownDiv.className = "eco-breakdown";

    // Group nutrients into categories
    const macros = profileObject.sections.filter(s =>
        ["total fat", "total carbohydrate", "protein"].some(n => s.name.toLowerCase().includes(n))
    );

    const minerals = profileObject.sections.filter(s =>
        ["sodium", "potassium", "calcium", "iron"].some(n => s.name.toLowerCase().includes(n))
    );

    const vitamins = profileObject.sections.filter(s =>
        s.name.toLowerCase().includes("vitamin")
    );

    // Macronutrients section
    if (macros.length > 0) {
        const macroSection = document.createElement("div");
        macroSection.innerHTML = '<div class="metric-header"><span class="metric-name" style="font-weight:600">Macronutrients</span></div>';

        macros.forEach(section => {
            const val = section.value * quantity;
            const unit = getUnit(section.name);
            const dailyPct = section.dailyValue ? Math.round(section.dailyValue * quantity) : null;
            const rating = getNutrientRating(section.name, dailyPct);

            const metricDiv = document.createElement("div");
            metricDiv.className = "eco-metric";
            metricDiv.innerHTML = `
                <div class="metric-row">
                    <span class="metric-name">${section.name}</span>
                    <span class="metric-indicator" style="background-color: ${rating.color}"></span>
                    <span class="metric-value">${formatValue(val, section.name)}${unit}</span>
                    ${dailyPct ? `<span class="metric-unit">(${dailyPct}% DV)</span>` : ''}
                </div>
            `;

            // Subsections
            if (section.subsections && section.subsections.length > 0) {
                const subsDiv = document.createElement("div");
                subsDiv.className = "submetrics";
                section.subsections.forEach(sub => {
                    const subVal = sub.value * quantity;
                    const subUnit = getUnit(sub.name);
                    subsDiv.innerHTML += `
                        <div class="submetric-row">
                            <span class="submetric-name">${sub.name}</span>
                            <span class="submetric-value">${formatValue(subVal, sub.name)}${subUnit}</span>
                        </div>
                    `;
                });
                metricDiv.appendChild(subsDiv);
            }

            macroSection.appendChild(metricDiv);
        });

        breakdownDiv.appendChild(macroSection);
    }

    // Minerals section
    if (minerals.length > 0) {
        const mineralSection = document.createElement("div");
        mineralSection.style.marginTop = "12px";
        mineralSection.innerHTML = '<div class="metric-header"><span class="metric-name" style="font-weight:600">Minerals</span></div>';

        minerals.forEach(section => {
            const val = section.value * quantity;
            const unit = getUnit(section.name);
            const dailyPct = section.dailyValue ? Math.round(section.dailyValue * quantity) : null;

            mineralSection.innerHTML += `
                <div class="eco-metric">
                    <div class="metric-row">
                        <span class="metric-name">${section.name}</span>
                        <span class="metric-value">${formatValue(val, section.name)}${unit}</span>
                        ${dailyPct ? `<span class="metric-unit">(${dailyPct}% DV)</span>` : ''}
                    </div>
                </div>
            `;
        });

        breakdownDiv.appendChild(mineralSection);
    }

    div.appendChild(breakdownDiv);

    return div;
}

// Rating helpers for food badge style
function getCalorieRating(calories) {
    if (calories <= 100) return { level: "low", color: "#22c55e", label: "Low Cal" };
    if (calories <= 300) return { level: "moderate", color: "#f59e0b", label: "Moderate" };
    if (calories <= 500) return { level: "high", color: "#f97316", label: "High Cal" };
    return { level: "very-high", color: "#ef4444", label: "Very High" };
}

function getNutrientRating(name, dailyPct) {
    const n = name.toLowerCase();
    if (!dailyPct) return { color: "#94a3b8" };

    // For "bad" nutrients (fat, sodium, sugar), lower is better
    if (n.includes("fat") || n.includes("sodium") || n.includes("sugar") || n.includes("cholesterol")) {
        if (dailyPct <= 5) return { color: "#22c55e" };
        if (dailyPct <= 15) return { color: "#84cc16" };
        if (dailyPct <= 25) return { color: "#f59e0b" };
        return { color: "#ef4444" };
    }

    // For "good" nutrients (fiber, vitamins, minerals), higher is better
    if (dailyPct >= 20) return { color: "#22c55e" };
    if (dailyPct >= 10) return { color: "#84cc16" };
    if (dailyPct >= 5) return { color: "#f59e0b" };
    return { color: "#94a3b8" };
}
  
/*
function renderNutritionLabel(profileObject, quantity = 1, isAggregate = false, itemIndex = null) {
    const div = document.createElement("div");
    div.className = isAggregate ? "nutrition-label aggregate" : "nutrition-label";

    // Add nutrition facts header
    div.innerHTML = `
        <div class="item-label-header">
            <div class="item-name">${profileObject.itemName}</div>
        </div>
        <hr class="thick-line">
        <div class="serving-size">Amount Per Serving</div>
        <hr class="thin-line">
    `;

    profileObject.sections.forEach(section => {
        const val = (section.value * quantity);
        const unit = getUnit(section.name);
        const formattedVal = formatValue(val, section.name);
        const dailyValue = section.dailyValue ? Math.round(section.dailyValue * quantity) : null;

        const sectionDiv = document.createElement("div");
        sectionDiv.className = "nutrition-section";
        sectionDiv.innerHTML = `
            <div class="section-title">
                <span><strong>${section.name}</strong> <span class="value">${formattedVal}${unit}</span></span>
                <span class="daily-value">${dailyValue ? dailyValue + '%' : ''}</span>
            </div>
        `;

        if (section.subsections) {
            section.subsections.forEach(subsection => {
                const subVal = (subsection.value * quantity);
                const subUnit = getUnit(subsection.name);
                const subFormattedVal = formatValue(subVal, subsection.name);
                const subDailyValue = subsection.dailyValue ? Math.round(subsection.dailyValue * quantity) : null;

                const subSectionDiv = document.createElement("div");
                subSectionDiv.className = "sub-section";
                subSectionDiv.innerHTML = `
                    <span>${subsection.name}</span>
                    <span class="value">${subFormattedVal}${subUnit}</span>
                    <span class="daily-value">${subDailyValue ? subDailyValue + '%' : ''}</span>
                `;
                sectionDiv.appendChild(subSectionDiv);
            });
        }

        div.appendChild(sectionDiv);
        div.appendChild(document.createElement('hr')).classList.add('thin-line');
    });

    return div;
}
*/
function updateHeaderCalories() {
    const headers = document.querySelectorAll(".collapsible-header");
    headers.forEach((header, idx) => {
      const caloriesSection = menuItems[idx]?.profileObject.sections.find(s =>
        s.name.toLowerCase().includes("calories")
      );
      if (caloriesSection) {
        const totalCalories = Math.round(caloriesSection.value * menuItems[idx].quantity);
        const calLabel = header.querySelector(".calories-label");
        if (calLabel) calLabel.textContent = `${totalCalories} kcal`;
      }
    });
  }
  

function getUnit(nutrientName) {
    const name = nutrientName.toLowerCase();
    if (name.includes('calories')) return '';
    if (name.includes('sodium') || name.includes('potassium') || name.includes('calcium') || name.includes('iron') || name.includes('vitamin d') || name.includes('cholesterol')) return 'mg';
    if (name.includes('caffeine')) return 'mg';
    return 'g'; // Default for fats, carbs, protein, fiber, etc.
}

function formatValue(value, nutrientName) {
    const name = nutrientName.toLowerCase();
    if (name.includes('calories')) {
        return Math.round(value).toString();
    }
    return value.toFixed(1);
}

function updateAggregateProfile() {
    const aggSections = {};
    menuItems.forEach(item => {
        item.profileObject.sections.forEach(section => {
            if (!aggSections[section.name]) {
                aggSections[section.name] = 0;
            }
            aggSections[section.name] += section.value * item.quantity;
            if (section.subsections) {
                section.subsections.forEach(subsection => {
                    const key = section.name + " - " + subsection.name;
                    if (!aggSections[key]) {
                        aggSections[key] = 0;
                    }
                    aggSections[key] += subsection.value * item.quantity;
                });
            }
        });
    });

    const sections = [];
    Object.keys(aggSections).forEach(name => {
        if (name.includes(" - ")) {
            const [parent, sub] = name.split(" - ");
            let parentSection = sections.find(s => s.name === parent);
            if (!parentSection) {
                parentSection = { name: parent, value: 0, subsections: [] };
                sections.push(parentSection);
            }
            parentSection.subsections = parentSection.subsections || [];
            parentSection.subsections.push({ name: sub, value: aggSections[name] });
        } else {
            sections.push({ name, value: aggSections[name] });
        }
    });
    aggregateProfile = {
        itemName: "Meal Total",
        sections
    };
}

function getUrlHash() {
  return (function (pairs) {
    if (pairs == "") return {};
    var result = {};
    pairs.forEach(function(pair) {
      // Split the pair on "=" to get key and value
      var keyValue = pair.split('=');
      var key = keyValue[0];
      var value = keyValue.slice(1).join('=');

      // Replace "%26" with "&" in the value
      value = value.replace(/%26/g, '&');

      // Set the key-value pair in the result object
      result[key] = value;
    });
    return result;
  })(window.location.hash.substr(1).split('&'));
}

// Recommended daily intake / Average impacts
const dailyValueCalculations = {
    fat: 65, // Total Fat
    satFat: 20, // Saturated Fat
    cholesterol: 300, // Cholesterol
    sodium: 2400, // Sodium
    carb: 300, // Total Carbohydrate
    fiber: 25, // Dietary Fiber
    addedSugars: 50, // Added Sugars
    vitaminD: 20, // Vitamin D (mcg)
    calcium: 1300, // Calcium (mg)
    iron: 18, // Iron (mg)
    potassium: 4700 // Potassium (mg)
};
$(document).ready(function () {
    $("#dailyDiv").text(JSON.stringify(dailyValueCalculations));
});

// Calculate daily values (assuming source data is for a typical 2,000-calorie diet)
// Called from layout-nutrition.js
function calculateDailyValue(value, type) {
    const base = dailyValueCalculations[type];
    return base ? ((value / base) * 100).toFixed(0) : null;
}

function populateNutritionLabel(data) {
    document.getElementById("item-name").innerText = data.itemName;

    const sectionsContainer = document.getElementById("sections");
    sectionsContainer.innerHTML = ''; // Clear existing content

    data.sections.forEach(section => {
        const sectionDiv = document.createElement("div");
        sectionDiv.classList.add("nutrition-section");

        // Add section name and value
        sectionDiv.innerHTML = `
            <div class="section-title">
                <span><strong>${section.name}</strong> <span class="value">${section.value}${section.value ? 'g' : ''}</span></span>
                <span class="daily-value">${section.dailyValue ? section.dailyValue + '%' : ''}</span>
            </div>
        `;

        // Add subsections if they exist
        if (section.subsections) {
            section.subsections.forEach(subsection => {
                const subSectionDiv = document.createElement("div");
                subSectionDiv.classList.add("sub-section");
                if (subsection.extraIndent) subSectionDiv.classList.add("extra-indent");

                subSectionDiv.innerHTML = `
                    <span>${subsection.name}</span>
                    <span class="value">${subsection.value}${subsection.value ? 'g' : ''}</span>
                    <span class="daily-value">${subsection.dailyValue ? subsection.dailyValue + '%' : ''}</span>
                `;

                sectionDiv.appendChild(subSectionDiv);
            });
        }

        sectionsContainer.appendChild(sectionDiv);
        sectionsContainer.appendChild(document.createElement('hr')).classList.add('thin-line');
    });
}

// Function to update the nutrition label based on quantity
function updateNutritionLabel(quantity) {
    const updatedData = JSON.parse(JSON.stringify(profileObject));
    updatedData.sections.forEach(section => {
        if (section.value) section.value = (section.value * quantity).toFixed(2);
        if (section.dailyValue) section.dailyValue = (section.dailyValue * quantity).toFixed(0);
        if (section.subsections) {
            section.subsections.forEach(subsection => {
                if (subsection.value) subsection.value = (subsection.value * quantity).toFixed(2);
                if (subsection.dailyValue) subsection.dailyValue = (subsection.dailyValue * quantity).toFixed(0);
            });
        }
    });
    populateNutritionLabel(updatedData);
}

// Parse the source data into the desired structure
let profileObject = {};

async function loadProfile() {
    let hash = getUrlHash();
    let labelType = "food";
    let whichLayout = "js/layout-nutrition.js";
    if (hash.layout == "product") {
        labelType = "product";
        whichLayout = "js/layout-product.js";
    } // Also add removeElement() line below for new layouts.
    whichLayout = "/profile/item/" + whichLayout;

    // Remove prior layout-.js since createProfileObject() repeats.
    // detach() could possibly be used to assign to a holder then restore.
    removeElement('/profile/item/js/layout-nutrition.js'); // Resides in localsite/js/localsite.js
    removeElement('/profile/item/js/layout-product.js');

    loadScript(whichLayout, async function(results) {
        let sourceData = {};

        if (labelType == "product") {
            // Load YAML from GitHub if hash parameters are present
            if (hash.country && hash.cat && hash.id) {
                try {
                    const rawBase = "https://raw.githubusercontent.com/ModelEarth/products-data/refs/heads/main";
                    const yamlUrl = `${rawBase}/${hash.country}/${hash.cat}/${hash.id}.yaml`;
                    window.profileItemCache.lastProductYamlUrl = yamlUrl;
window.profileItemCache.lastCountry = hash.country;
window.profileItemCache.lastLayout = "product";

                    console.log("Loading product YAML from:", yamlUrl);

                    const yamlText = await fetchText(yamlUrl);
                    sourceData = jsyaml.load(yamlText);
                    console.log("Loaded YAML data:", sourceData);

                    // Update YAML Source link with the category display_name from the YAML file
                    const yamlCategory = sourceData.category?.display_name;
                    if (yamlCategory && typeof updateYAMLSourceLink === 'function') {
                        updateYAMLSourceLink(yamlCategory);
                    } else {
                        console.log("Category display_name not found in YAML data");
                    }
                } catch (error) {
                    console.error("Error loading YAML:", error);
                    // Fall back to default sample if YAML fails to load
                    sourceData = {
                        itemName: 'Sample Product (YAML load failed)',
                        id: "sample",
                        gwp: 10,
                        error: error.message
                    };
                }
            } else {
                // Default sample when no hash parameters
                // Example: https://raw.githubusercontent.com/ModelEarth/products-data/refs/heads/main/US/Acoustical_Ceilings/61a3d3f6469b4e9baa9da7605650a63d.yaml
                try {
                    const sampleUrl = "https://raw.githubusercontent.com/ModelEarth/products-data/refs/heads/main/US/Acoustical_Ceilings/61a3d3f6469b4e9baa9da7605650a63d.yaml";
                    console.log("Loading default sample YAML from:", sampleUrl);
                    const yamlText = await fetchText(sampleUrl);
                    sourceData = jsyaml.load(yamlText);
                    console.log("Loaded sample YAML data:", sourceData);

                    // Update YAML Source link with the category display_name from the sample YAML
                    const sampleCategory = sourceData.category?.display_name;
                    if (sampleCategory && typeof updateYAMLSourceLink === 'function') {
                        updateYAMLSourceLink(sampleCategory);
                    }
                } catch (error) {
                    console.error("Error loading sample YAML:", error);
                    sourceData = {
                        itemName: 'Sample Product (sample YAML load failed)',
                        error: error.message
                    };
                }
            }
        }

        if (labelType == "food") {
            // Example source data from the provided object
            sourceData = {
                showServingUnitQuantity: false,
                itemName: 'Bleu Cheese Dressing',
                ingredientList: 'Bleu Cheese Dressing',
                decimalPlacesForQuantityTextbox: 2,
                valueServingUnitQuantity: 1,
                allowFDARounding: true,
                decimalPlacesForNutrition: 2,
                showPolyFat: false,
                showMonoFat: false,
                valueCalories: 450,
                valueFatCalories: 430,
                valueTotalFat: 48,
                valueSatFat: 6,
                valueTransFat: 0,
                valueCholesterol: 30,
                valueSodium: 780,
                valueTotalCarb: 3,
                valueFibers: 0,
                valueSugars: 3,
                valueProteins: 3,
                valueVitaminD: 12.22,
                valuePotassium_2018: 4.22,
                valueCalcium: 7.22,
                valueIron: 11.22,
                valueAddedSugars: 17,
                valueCaffeine: 15.63,
                showLegacyVersion: false
            };
        }

        // TO DO: Since createProfileObject occurs twice, drop one of the layout-.js files.

        profileObject = createProfileObject(sourceData); // Guessing
        console.log("profileObject:")
        console.log(profileObject);

        $(document).ready(function () { // TO DO: Change to just wait for #item-name
            if (hash.layout == "product") {
                $("#nutritionFooter").hide();
            } else {
                $("#nutritionFooter").show();
            }

            // Event listeners for quantity input
            document.addEventListener('change', (e) => {
                if (e.target && e.target.id === 'quantity-input') {
                    const quantity = parseFloat(e.target.value) || 1;
                    updateNutritionLabel(quantity);
                }
                if (e.target && e.target.id === 'decrease-quantity') {
                    const input = document.getElementById('quantity-input');
                    let quantity = parseFloat(input.value) || 1;
                    if (quantity > 1) {
                        quantity--;
                        input.value = quantity;
                        updateNutritionLabel(quantity);
                    }
                }
                if (e.target && e.target.id === 'increase-quantity') {
                    const input = document.getElementById('quantity-input');
                    let quantity = parseFloat(input.value) || 1;
                    quantity++;
                    input.value = quantity;
                    updateNutritionLabel(quantity);
                }
            });
            // Initial population - HTML
            populateNutritionLabel(profileObject);
            
            $("#sourceDiv").text(JSON.stringify(sourceData));
            $("#jsonDiv").text(JSON.stringify(profileObject));
        });
    });
}
