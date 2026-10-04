
// enable type-hints
/// <reference types="../dist/useeio" />
/** @type {import('useeio')} */
var useeio = useeio;

/*
const model = useeio.modelOf({
  endpoint: 'http://localhost:8080/api',
  model: 'USEEIOv2.0',
  asJsonFiles: true,
});
*/

/*
// Public API Discontinued. Use asJsonFiles instead.
const model = useeio.modelOf({
  endpoint: 'https://smmtool.app.cloud.gov/api',
  model: 'USEEIOv2.0.1-411',
  asJsonFiles: false,
});
*/
let model = getModel();
function getModelFolderName() {
    let hash = getUrlHash();
    let theModel = "USEEIOv2.0.1-411";
    if (hash.state) { // Prior to 2024 states were GA, ME, MN, OR, WA
        let thestate = hash.state.split(",")[0].toUpperCase();
        theModel = thestate + "EEIOv1.0-s-20"
    }
    return theModel;
}
function getModel() {
    let theModel = getModelFolderName()
    return useeio.modelOf({ // Calls the getJson() method set in webapi.ts
      //endpoint: 'http://localhost:8887/useeio-json/models/2020',

      // So clone the useeio-json repo into the same webroot.
      endpoint: '/useeio-json/models/2020',

      // CORS error
      endpoint: 'https://model.earth/useeio-json/main/models/2020',
      endpoint: 'https://raw.githubusercontent.com/ModelEarth/useeio-json/main/models/2020',
      
      model: theModel,
      asJsonFiles: true,
    });
}

// Browser cache functionality for dropdown preferences
const CACHE_KEYS = {
  impactFilter: 'footprint_impact_filter_preference',
  locale: 'footprint_locale_preference',
  numberFormat: 'footprint_number_format_preference'
};

// Save dropdown selection to browser cache
function saveDropdownPreference(dropdownId, value) {
  try {
    localStorage.setItem(CACHE_KEYS[dropdownId], value);
  } catch (e) {
    console.warn('Failed to save dropdown preference:', e);
  }
}

// Get dropdown selection from browser cache
function getDropdownPreference(dropdownId, defaultValue) {
  try {
    return localStorage.getItem(CACHE_KEYS[dropdownId]) || defaultValue;
  } catch (e) {
    console.warn('Failed to get dropdown preference:', e);
    return defaultValue;
  }
}

// Add event listeners to save preferences when dropdowns change
function attachDropdownListeners() {
  // Impact filter dropdown (only on sector_profile.html)
  const impactFilterSelect = document.getElementById("impact-filter-select");
  if (impactFilterSelect) {
    impactFilterSelect.addEventListener('change', function() {
      saveDropdownPreference('impactFilter', this.value);
    });
  }

  // Locale dropdown
  const localeSelect = document.getElementById("locale-select");
  if (localeSelect) {
    localeSelect.addEventListener('change', function() {
      saveDropdownPreference('locale', this.value);
    });
  }

  // Number format dropdown
  const numberFormatSelect = document.getElementById("number-format-select");
  if (numberFormatSelect) {
    numberFormatSelect.addEventListener('change', function() {
      saveDropdownPreference('numberFormat', this.value);
    });
  }
}

// Apply cached preferences to existing dropdowns (doesn't populate them)
function applyCachedPreferences() {
  // Set locale dropdown to cached preference
  var localeSelect = document.getElementById("locale-select");
  if (localeSelect && localeSelect.options.length > 0) {
    const cachedLocale = getDropdownPreference('locale', navigator.language);
    localeSelect.value = cachedLocale;
  }

  // Set number format dropdown to cached preference
  let numberFormatSelect = document.getElementById("number-format-select");
  if (numberFormatSelect && numberFormatSelect.options.length > 0) {
    const cachedFormat = getDropdownPreference('numberFormat', 'simple');
    // Skip formats this page's dropdown doesn't offer (e.g. "enotation" saved on another page)
    if (Array.from(numberFormatSelect.options).some(o => o.value === cachedFormat)) {
      numberFormatSelect.value = cachedFormat;
    }
  }

  // Set impact filter preference (only on sector_profile.html)
  const impactFilterSelect = document.getElementById("impact-filter-select");
  if (impactFilterSelect && impactFilterSelect.options.length > 0) {
    const cachedImpactFilter = getDropdownPreference('impactFilter', 'all');
    impactFilterSelect.value = cachedImpactFilter;
  }

  // Attach event listeners after setting values
  attachDropdownListeners();
}

// Legacy function for sector_profile.html compatibility
function initializeDropdowns() {
  // Only populate dropdowns if they're empty (for sector_profile.html)
  var localeSelect = document.getElementById("locale-select");
  if (localeSelect && localeSelect.options.length === 0) {
    var locales = ["en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "ko-KR", "zh-CN"];
    
    locales.forEach(locale => {
        let option = document.createElement("option");
        option.value = locale;
        option.textContent = locale;
        localeSelect.appendChild(option);
    });
  }

  let numberFormatSelect = document.getElementById("number-format-select");
  if (numberFormatSelect && numberFormatSelect.options.length === 0) {
    let formats = ["simple", "full", "scientific"];
    formats.forEach(format => {
        let option = document.createElement("option");
        option.value = format;
        option.textContent = format;
        numberFormatSelect.appendChild(option);
    });
  }

  // Apply cached preferences after population
  applyCachedPreferences();
}

// Number formatting function based on format type
function formatNumber(value, formatType, locale = navigator.language) {
  if (!value && value !== 0) return '';
  
  switch(formatType) {
    case "full":
      return new Intl.NumberFormat(locale).format(value);
    case "scientific":
      let scientificValue = Number(value).toExponential(3);
      let parts = scientificValue.split("e");
      let base = parts[0];
      let exponent = parts[1];
      if (exponent) {
        return `${base}&times;10<sup>${exponent.replace('+', '')}</sup>`;
      }
      return scientificValue;
    case "simple":
    default:
      return formatCell(value); // Use existing formatCell function
  }
}

// Get current number format selection
function getCurrentNumberFormat() {
  const select = document.getElementById("number-format-select");
  return select ? select.value : "simple";
}

// Get current locale selection
function getCurrentLocale() {
  const select = document.getElementById("locale-select");
  return select ? select.value : navigator.language;
}
// NOT USED - Will probably delete. Tabulator Intl.NumberFormat used instead.
function formatNum(numberString, locale = navigator.language) {
    if (typeof numberString !== 'string') {
        numberString = String(numberString);
    }
    // Remove existing formatNum or periods
    let cleanString = numberString.replace(/[,.]/g, '');
    
    // Check if the cleaned string is a valid number
    if (isNaN(cleanString)) {
        return numberString; // Return the original string if it's not a valid number
    }
    // Check if the locale is valid; default to 'en-US' if not
    if (!locale || typeof locale !== 'string' || !Intl.NumberFormat.supportedLocalesOf([locale]).length) {
        locale = 'en-US';
    }
    // Convert to a number
    let number = parseFloat(cleanString);
    
    // Format the number based on the locale
    return number.toLocaleString(locale);
}
/*
// US standard (default)
console.log(formatNum("1234567.89")); // Output: "1,234,567.89"

// German standard
console.log(formatNum("1234567,89", 'de-DE')); // Output: "1.234.567,89"

// French standard
console.log(formatNum("1234567.89", 'fr-FR')); // Output: "1 234 567,89"

// Invalid number string remains unchanged
console.log(formatNum("12a34567.89")); // Output: "12a34567.89"

// Number with existing formatNum/periods
console.log(formatNum("1,234,567.89", 'en-US')); // Output: "1,234,567.89"
console.log(formatNum("1.234.567,89", 'de-DE')); // Output: "1.234.567,89"
*/

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

// Initialize dropdowns when DOM is ready (for sector_profile.html)
function initDropdownsOnDOMReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Check if dropdowns exist and are empty (sector_profile.html case)
      const localeSelect = document.getElementById("locale-select");
      const numberFormatSelect = document.getElementById("number-format-select");
      
      if ((localeSelect && localeSelect.options.length === 0) || 
          (numberFormatSelect && numberFormatSelect.options.length === 0)) {
        initializeDropdowns();
      }
    });
  } else {
    // DOM is already ready
    const localeSelect = document.getElementById("locale-select");
    const numberFormatSelect = document.getElementById("number-format-select");
    
    if ((localeSelect && localeSelect.options.length === 0) || 
        (numberFormatSelect && numberFormatSelect.options.length === 0)) {
      initializeDropdowns();
    }
  }
}

// Auto-initialize when this script loads
initDropdownsOnDOMReady();
