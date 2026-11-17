
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
// Folder holding one folder per year, each with the model folders and sectorcrosswalk.csv.
// Declared before getModel() runs below.
//const useeioJsonModels = 'http://localhost:8887/useeio-json/models';
// To use a local copy, clone the useeio-json repo into the same webroot:
//const useeioJsonModels = '/useeio-json/models';
// CORS error:
//const useeioJsonModels = 'https://model.earth/useeio-json/main/models';
const useeioJsonModels = 'https://raw.githubusercontent.com/ModelEarth/useeio-json/main/models';

// Year folders in useeio-json/models that hold JSON models, newest first. Add a year once its folder is published.
// (models/2018 holds only an xlsx.) The 2020 folder's state models use 2020 data, and its national model USEEIOv2.0.1-411 uses 2012 data.
const USEEIO_MODEL_YEARS = ['2020'];

// The model year from the hash, e.g. #year=2020. A year without models falls back to the newest.
function getModelYear() {
    const year = String(getUrlHash().year || '').trim();
    return USEEIO_MODEL_YEARS.includes(year) ? year : USEEIO_MODEL_YEARS[0];
}
// The year's folder, e.g. .../models/2020
function getUseeioJsonEndpoint() {
    return `${useeioJsonModels}/${getModelYear()}`;
}

let model = getModel();
// The state whose model is shown: the first in the hash, e.g. TX for state=TX,GA. Blank for the US model.
function getModelState() {
    return (getUrlHash().state || "").split(",")[0].trim().toUpperCase();
}
function getModelFolderName() {
    let theModel = "USEEIOv2.0.1-411";
    let thestate = getModelState();
    if (thestate) { // Prior to 2024 states were GA, ME, MN, OR, WA
        theModel = thestate + "EEIOv1.0-s-20"
    }
    return theModel;
}
// The year and model folder, e.g. 2020/GAEEIOv1.0-s-20, for noticing when the model changes
function getModelKey() {
    return `${getModelYear()}/${getModelFolderName()}`;
}
function getModel() {
    return getModelByName(getModelFolderName());
}

// A model by folder name in the hash's year, e.g. USEEIOv2.0.1-411 (national) or GAEEIOv1.0-s-20 (Georgia)
function getModelByName(theModel) {
    return useeio.modelOf({ // Calls the getJson() method set in webapi.ts
      endpoint: getUseeioJsonEndpoint(),
      model: theModel,
      asJsonFiles: true,
    });
}

// Browser cache functionality for dropdown preferences
const CACHE_KEYS = {
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

  // Attach event listeners after setting values
  attachDropdownListeners();
}

// True when the page shows UN (Exiobase) data: the UN / EPA toggle in ../item/js/supporting-industries.js,
// or on profile/footprint/ a country or the World in the hash, which only UN covers (footprintOutsideUS)
function showsExiobase() {
  if (typeof getSupportingIndustriesSource !== 'function' || typeof EXIOBASE_YEARS === 'undefined') return false;
  return getSupportingIndustriesSource() === 'un' || (typeof footprintOutsideUS === 'function' && footprintOutsideUS());
}
// The year the page shows: the Exiobase year for UN (2018 to 2024), otherwise the USEEIO model year
function shownDataYear() {
  return showsExiobase() ? getExiobaseYear() : getModelYear();
}

// Year dropdown, driven by the hash: choosing a year calls goHash({year}), and a hash change
// (including Back) moves the dropdown. The page's own hashChangeEvent listener reloads the data.
// For EPA it lists the USEEIO model years. For UN it lists the Exiobase years; a note under the impacts
// chart (indicatorYearNote, filled by js/footprint.js) names the years without greenhouse gas and jobs factors. The two share year=.
function setupModelYearSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select || select.dataset.ready) return;
  select.dataset.ready = '1';
  const fill = () => {
    const un = showsExiobase();
    const years = un ? EXIOBASE_YEARS : USEEIO_MODEL_YEARS;
    const key = (un ? 'un:' : 'epa:') + years.join(',');
    if (select.dataset.years !== key) {
      select.dataset.years = key;
      select.innerHTML = '';
      years.forEach(year => {
        const note = un && typeof EXIOBASE_YEAR_NOTES !== 'undefined' && EXIOBASE_YEAR_NOTES[year];
        const option = new Option(year, year);
        if (note) option.title = note;
        select.add(option);
      });
      select.title = un ? 'Exiobase trade data year (UN)' : 'USEEIO model year';
    }
    select.value = shownDataYear();
  };
  fill();
  select.addEventListener('change', () => {
    if (select.value !== shownDataYear()) goHash({ year: select.value });
  });
  document.addEventListener('hashChangeEvent', fill);
  document.addEventListener('supportingIndustriesSource', fill);
}

// Legacy function for profile/footprint/ compatibility
function initializeDropdowns() {
  // Only populate dropdowns if they're empty (for profile/footprint/)
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

// Initialize dropdowns when DOM is ready (for profile/footprint/)
function initDropdownsOnDOMReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Check if dropdowns exist and are empty (profile/footprint/ case)
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
