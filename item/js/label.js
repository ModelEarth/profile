// Displays a label for food nutrition or product impact.
// profileObject is built by createProfileObject() in layout-.js template.
import { MAIN_CATEGORY_MAP, categoryForFolder } from "./product-categories.js";
import { formatYamlLabel } from "./yaml-label.js";

let menuItems = []; // { profileObject, quantity }
let aggregateProfile = {};

// Load js-yaml if missing
if (typeof jsyaml === "undefined") {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js";
    document.head.appendChild(s);
}

let searchResults = []; // Store current search results
let hasSampleItem = false; // Track if sample item is present

document.addEventListener("DOMContentLoaded", loadMenu);

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
//         loadSampleFood();
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

function loadMenu() {
    let hash = getUrlHash();

    const searchDiv = document.getElementById("usda-search-div");
    const searchResultsContainer = document.getElementById("search-results-container");
    const menuContainer = document.getElementById("menu-container");
    const header = document.getElementById("page-header");

    // Critical fix: DOM not ready when this runs on model.earth
    if (!header) {
        setTimeout(loadMenu, 100);
        return;
    }

    if (hash.layout == "product") {
        header.textContent = "Product Layout";
        searchDiv.style.display = "none";
        searchResultsContainer.style.display = "none";
        menuContainer.style.display = "none";
        loadProductList();
        return;
    }

    addUSDASearchBar();
    loadFoodCategorySidebar();
    loadSampleFood();
    displayInitialFoodItems();
}

const FOOD_CATEGORIES = [
    { name: "All Foods", query: "" },
    { name: "Fruits and Fruit Juices", query: "Fruits and Fruit Juices" },
    { name: "Vegetables", query: "Vegetables and Vegetable Products" },
    { name: "Dairy and Eggs", query: "Dairy and Egg Products" },
    { name: "Meats and Poultry", query: "Poultry Products" },
    { name: "Fish and Seafood", query: "Finfish and Shellfish Products" },
    { name: "Grains and Pasta", query: "Cereal Grains and Pasta" },
    { name: "Nuts and Seeds", query: "Nut and Seed Products" },
    { name: "Legumes", query: "Legumes and Legume Products" },
    { name: "Baked Products", query: "Baked Products" },
    { name: "Beverages", query: "Beverages" },
    { name: "Fats and Oils", query: "Fats and Oils" },
    { name: "Snacks and Sweets", query: "Sweets" },
    { name: "Soups and Sauces", query: "Soups, Sauces, and Gravies" },
    { name: "Fast Foods", query: "Fast Foods" }
];

let selectedCategory = null;

function loadFoodCategorySidebar() {
    const sidebar = document.getElementById("food-category-sidebar");
    const categoryList = document.getElementById("category-list");

    if (!sidebar || !categoryList) return;

    sidebar.style.display = "block";
    categoryList.innerHTML = "";

    FOOD_CATEGORIES.forEach((category, index) => {
        const categoryDiv = document.createElement("div");
        categoryDiv.className = "category-item";
        categoryDiv.textContent = category.name;
        categoryDiv.dataset.query = category.query;
        categoryDiv.dataset.index = index;

        categoryDiv.onclick = function() {
            selectFoodCategory(category, categoryDiv);
        };

        categoryList.appendChild(categoryDiv);
    });
}

function selectFoodCategory(category, element) {
    // Remove active class from all categories
    document.querySelectorAll(".category-item").forEach(item => {
        item.classList.remove("active");
    });

    // Add active class to selected category
    element.classList.add("active");
    selectedCategory = category.query;

    // Filter foods by category
    if (category.query === "") {
        // Show all foods (initial display)
        displayInitialFoodItems();
    } else {
        // Search USDA API by category
        searchUSDAFoodByCategory(category.query);
    }
}

function searchUSDAFoodByCategory(categoryQuery) {
    const apiKey = "bLecediTVa2sWd8AegmUZ9o7DxYFSYoef9B4i1Ml";
    const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(categoryQuery)}&pageSize=20&pageNumber=1`;

    const container = document.getElementById("search-results-container");
    container.innerHTML = "<h3>Loading...</h3>";

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.foods && data.foods.length > 0) {
                searchResults = data.foods;
                displayCategoryResults(categoryQuery);
            } else {
                container.innerHTML = `<p>No foods found in this category.</p>`;
            }
        })
        .catch(error => {
            console.error('Error fetching USDA data:', error);
            container.innerHTML = `<p>Error loading foods. Please try again.</p>`;
        });
}

function displayCategoryResults(categoryName) {
    const container = document.getElementById("search-results-container");
    container.innerHTML = `<h3>${categoryName} - Click to Add Item:</h3>`;

    searchResults.forEach((food, index) => {
        const resultDiv = document.createElement("div");
        resultDiv.className = "search-result-item";
        resultDiv.innerHTML = `
            <div class="food-info">
                <strong>${food.description}</strong>
                <br><small>Brand: ${food.brandOwner || 'Generic'}</small>
                <br><small>Category: ${food.foodCategory || 'N/A'}</small>
            </div>
            <button class="add-to-menu-btn" data-index="${index}">Add Item</button>
        `;
        container.appendChild(resultDiv);
    });

    // Add event listeners for "Add Item" buttons
    container.querySelectorAll(".add-to-menu-btn").forEach(button => {
        button.onclick = function() {
            const index = parseInt(button.dataset.index);
            addFoodToMenu(searchResults[index]);
        };
    });
}

const API_BASE = "https://api.github.com/repos/ModelEarth/products-data/contents";

async function loadProductList() {
    const container = document.getElementById("product-container");
    if (!container) return;

    container.innerHTML = "<h3>Loading regions...</h3>";

    const regions = await fetchJSON(API_BASE);
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

    const categories = await fetchJSON(`${API_BASE}/${region}`);

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

    const files = await fetchJSON(`${API_BASE}/${region}/${category}`);

    files.filter(x => x.type === "file" && x.name.endsWith(".yaml")).forEach(file => {
        const row = document.createElement("div");
        row.classList.add("file-row");
        row.textContent = file.name.replace(".yaml", "");
        row.onclick = () => loadYAMLProfile(region, category, file);
        container.appendChild(row);
    });
}

async function loadYAMLProfile(region, category, file) {
    const yamlText = await fetchText(file.download_url);
    const data = jsyaml.load(yamlText);

    const profile = createProfileObject(data);

    const container = document.getElementById("product-label");
    container.innerHTML = "";
    container.appendChild(renderNutritionLabel(profile, 1, false));
}


async function fetchJSON(url) {
    const r = await fetch(url);
    return r.json();
}
async function fetchText(url) {
    const r = await fetch(url);
    return r.text();
}


function loadSampleFood() {
    // Add a sample food item (apple) to show the user how it works
    const sampleFood = {
        description: "Apples, raw, with skin (Sample)",
        brandOwner: null,
        foodCategory: "Fruits and Fruit Juices",
        foodNutrients: [
            { nutrientName: "Energy", value: 52, unitName: "KCAL" },
            { nutrientName: "Total lipid (fat)", value: 0.17, unitName: "G" },
            { nutrientName: "Carbohydrate, by difference", value: 13.81, unitName: "G" },
            { nutrientName: "Fiber, total dietary", value: 2.4, unitName: "G" },
            { nutrientName: "Total Sugars", value: 10.39, unitName: "G" },
            { nutrientName: "Protein", value: 0.26, unitName: "G" },
            { nutrientName: "Sodium, Na", value: 1, unitName: "MG" },
            { nutrientName: "Potassium, K", value: 107, unitName: "MG" },
            { nutrientName: "Calcium, Ca", value: 6, unitName: "MG" },
            { nutrientName: "Iron, Fe", value: 0.12, unitName: "MG" }
        ]
    };

    addFoodToMenu(sampleFood);
    hasSampleItem = true; // Mark that we have a sample item
}

function addUSDASearchBar() {
    let searchDiv = document.getElementById("usda-search-div");
    if (searchDiv && !searchDiv.innerHTML.trim()) {
        searchDiv.style.marginBottom = "1em";
        searchDiv.innerHTML = `
            <input type="text" id="usda-search-input" placeholder="Search USDA Food Database" style="width:300px;">
            <button id="usda-search-button">Search</button>
            <button id="usda-clear-button">Clear Results</button>
        `;
    }
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'usda-search-button') {
            const query = document.getElementById("usda-search-input").value.trim();
            searchUSDAFood(query);
        }
        if (e.target && e.target.id === 'usda-clear-button') {
            clearSearchResults();
        }
    });
    document.addEventListener("keypress", function(e) {
        if (e.target && e.target.id === "usda-search-input" && e.key === "Enter") {
            const btn = document.getElementById("usda-search-button");
            if (btn) btn.click();
        }
    });
}

function searchUSDAFood(query = "apple") {
    const apiKey = "bLecediTVa2sWd8AegmUZ9o7DxYFSYoef9B4i1Ml";
    const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(query)}&pageSize=10&pageNumber=1`;
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.foods && data.foods.length > 0) {
                searchResults = data.foods;
                displaySearchResults();
            } else {
                console.log('No foods found for query:', query);
                clearSearchResults();
            }
        })
        .catch(error => {
            console.error('Error fetching USDA data:', error);
            clearSearchResults();
        });
}

function displaySearchResults() {
    const container = document.getElementById("search-results-container");
    container.innerHTML = "<h3>Search Results - Click to Add Item:</h3>";

    searchResults.forEach((food, index) => {
        const resultDiv = document.createElement("div");
        resultDiv.className = "search-result-item";
        resultDiv.innerHTML = `
            <div class="food-info">
                <strong>${food.description}</strong>
                <br><small>Brand: ${food.brandOwner || 'Generic'}</small>
                <br><small>Category: ${food.foodCategory || 'N/A'}</small>
            </div>
            <button class="add-to-menu-btn" data-index="${index}">Add Item</button>
        `;
        container.appendChild(resultDiv);
    });

    // Add event listeners for "Add Item" buttons
    container.querySelectorAll(".add-to-menu-btn").forEach(button => {
        button.onclick = function() {
            const index = parseInt(button.dataset.index);
            addFoodToMenu(searchResults[index]);
        };
    });
}

function clearSearchResults() {
    const container = document.getElementById("search-results-container");
    container.innerHTML = "";
    displayInitialFoodItems();
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
        container.innerHTML = "<h3>Popular Foods - Click to Add Item:</h3>";

        initialFoods.forEach((food, index) => {
            const resultDiv = document.createElement("div");
            resultDiv.className = "search-result-item initial-food-item";
            resultDiv.innerHTML = `
                <div class="food-info">
                    <strong>${food.description}</strong>
                    <br><small>Brand: ${food.brandOwner || 'Generic'}</small>
                    <br><small>Category: ${food.foodCategory || 'N/A'}</small>
                </div>
                <button class="add-initial-food-btn" data-index="${index}">Search Item</button>
            `;
            container.appendChild(resultDiv);
        });

        // Add event listeners for "Add Item" buttons
        container.querySelectorAll(".add-initial-food-btn").forEach(button => {
            button.onclick = function() {
                const index = parseInt(button.dataset.index);
                searchUSDAFood(initialFoods[index].description);
            };
        });
    }
}

function addFoodToMenu(food) {
    // If this is the first real food item being added and we have a sample, remove the sample
    if (hasSampleItem && !food.description.includes("(Sample)")) {
        menuItems = []; // Clear sample item
        hasSampleItem = false;
    }

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
        if (nutrients[nutrientName] !== undefined) {
            return nutrients[nutrientName];
        }
        return 0;
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

function renderMenuLabels() {
    const container = document.getElementById("menu-container");
    if (container) {
        container.innerHTML = "";
        
        // Only show aggregate if there are menu items
        if (menuItems.length > 0) {
            updateAggregateProfile();
            container.appendChild(renderNutritionLabel(aggregateProfile, 1, true));
        }

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
          

        // Add the container with all items to the main container
        if (menuItems.length > 0) {
            container.appendChild(allItemsContainer);
        }

        // Event listeners for quantity controls inside nutrition labels
        container.querySelectorAll(".quantity-input").forEach(input => {
            input.onchange = function () {
                const idx = +input.dataset.index;
                menuItems[idx].quantity = Math.max(1, parseInt(input.value) || 1);
              
                //Update only this item’s nutrition label (not all)
                const parentContent = input.closest(".collapsible-content");
                if (parentContent) {
                  parentContent.innerHTML = "";
                  parentContent.appendChild(renderNutritionLabel(menuItems[idx].profileObject, menuItems[idx].quantity, false, idx));
                }
              
                //Update header calories immediately
                updateHeaderCalories();
              
                //Update the meal total (aggregate)
                updateAggregateProfile();
                const aggContainer = document.querySelector(".aggregate");
                if (aggContainer) {
                  aggContainer.innerHTML = "";
                  aggContainer.appendChild(renderNutritionLabel(aggregateProfile, 1, true));
                }
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

function renderNutritionLabel(profileObject, quantity = 1, isAggregate = false, itemIndex = null) {
    const div = document.createElement("div");
    div.className = isAggregate ? "nutrition-label aggregate" : "nutrition-label";
  
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

function loadProfile() {
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

    loadScript(whichLayout, function(results) {
        let sourceData = {};
        // TO DO: Load these from API or file
        if (labelType == "product") {
            // https://github.com/ModelEarth/io/blob/main/template/product/product-nodashes.yaml
            sourceData = {
                itemName: 'Sample Product',
                id: "ec3yznau",
                ref: "https://openepd.buildingtransparency.org/api/epds/EC3YZNAU",
                doctype: "OpenEPD",
                version: null,
                language: "en",
                valueGlobalWarmingPotential: 445 ,
                ghgunits: "kg CO2 eq"
                /*
                private: false,
                program_operator_doc_id: "9BD4F9CB-3584-4D34-90F8-B6E40B69653D",
                program_operator_version: null,
                third_party_verification_url: null,
                date_of_issue: '2019-01-28T00:00:00Z',
                valid_until: '2024-01-28T00:00:00Z',
                kg_C_per_declared_unit: null,
                product_name: DM0115CA,
                product_sku: null,
                product_description: "DOT MINOR 3/4 15FA 3-5SL AIR",
                product_image_small: null,
                product_image: null,
                product_service_life_years: null,
                applicable_in: null,
                product_usage_description: null,
                product_usage_image: null,
                manufacturing_description: null,
                manufacturing_image: null,
                compliance: []
                */
            };
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