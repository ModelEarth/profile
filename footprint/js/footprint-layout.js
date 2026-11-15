// Loads the footprint layout (profile/footprint/template-footprint.html) into a page, then the scripts that fill it.
// Used by profile/footprint/index.html and engine/index.html. The page loads localsite.js first.
//
//   loadFootprintLayout('footprintLayout');                               // All sections
//   loadFootprintLayout('footprintLayout', { sections: ['matrixSection'] }); // Only the treemap and matrix at first
//
// The menu at the top right (#footprintWidgetList) shows and hides each section, like #widgetList in
// localsite/info/template-charts.html. A hidden section gets the footprint-hidden class, so the page's own
// script can still show and hide the section's contents.
(function () {
  // profile/footprint/, from this script's address
  const base = new URL('../', document.currentScript ? document.currentScript.src : window.location.href).href;

  const styles = [
    'https://unpkg.com/tabulator-tables@5.2.7/dist/css/tabulator.min.css',
    base + '../item/css/supporting-industries.css' // Top 10 Industries Supplying Production, shared with the product label
  ];
  // In order: each one uses the ones before it
  const scripts = [
    'https://unpkg.com/tabulator-tables@5.2.7/dist/js/tabulator.min.js',
    'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js',
    base + 'js/useeio.js',
    base + '../trade-viz-links.js', // Buttons linking the trade visualization pages
    base + 'js/config.js',
    base + 'js/commodities-report.js',
    base + '../item/js/supporting-industries.js',
    base + '../../localsite/js/impact-sets.js',
    base + 'js/footprint.js'
  ];

  // Full address with ".." resolved, so a file the page already loads (such as ../trade-viz-links.js) is matched
  const fullUrl = url => new URL(url, window.location.href).href;

  function addStyle(href) {
    href = fullUrl(href);
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === href)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function addScript(src) {
    src = fullUrl(src);
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(script => script.src === src)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('footprint-layout could not load ' + src));
      document.body.appendChild(script);
    });
  }

  // ---- Section menu ----
  function sectionItems(root) {
    return root.querySelectorAll('#footprintWidgetList .menuToggleItem[data-section]');
  }
  function updateSectionMenu(root) {
    let anyHidden = false;
    sectionItems(root).forEach(item => {
      const section = document.getElementById(item.dataset.section);
      const hidden = !section || section.classList.contains('footprint-hidden');
      item.classList.toggle('is-active', !hidden);
      if (hidden) anyHidden = true;
    });
    root.querySelector('#footprintWidgetListShowAll').style.display = anyHidden ? '' : 'none';
  }
  function showSection(section, show) {
    if (!section) return;
    section.classList.toggle('footprint-hidden', !show);
    // Charts drawn while hidden have no size, so they redraw at the shown size
    if (show) window.dispatchEvent(new Event('resize'));
  }
  function setupSectionMenu(root, shownSections) {
    const menu = root.querySelector('#footprintWidgetList');
    const toggle = root.querySelector('#footprintWidgetToggle');
    if (shownSections) {
      sectionItems(root).forEach(item => {
        showSection(document.getElementById(item.dataset.section), shownSections.includes(item.dataset.section));
      });
    }
    const closeMenu = () => { menu.style.display = 'none'; toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', event => {
      const open = menu.style.display === 'none';
      menu.style.display = open ? '' : 'none';
      toggle.setAttribute('aria-expanded', String(open));
      updateSectionMenu(root);
      event.stopPropagation();
    });
    toggle.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle.click(); }
    });
    menu.addEventListener('click', event => {
      const item = event.target.closest('.menuToggleItem');
      if (!item) return;
      if (item.dataset.action === 'show-all') {
        sectionItems(root).forEach(other => showSection(document.getElementById(other.dataset.section), true));
      } else {
        const section = document.getElementById(item.dataset.section);
        showSection(section, section && section.classList.contains('footprint-hidden'));
      }
      updateSectionMenu(root);
      closeMenu();
      event.stopPropagation();
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('#footprintWidgetHolder')) closeMenu();
    });
    updateSectionMenu(root);
  }

  // holder: an element or its id. options.sections: the section ids shown at first (all when omitted).
  window.loadFootprintLayout = async function (holder, options = {}) {
    const holderEl = typeof holder === 'string' ? document.getElementById(holder) : holder;
    if (!holderEl) { console.warn('loadFootprintLayout: no holder', holder); return; }
    styles.forEach(addStyle);
    const response = await fetch(base + 'template-footprint.html');
    if (!response.ok) { console.warn('loadFootprintLayout: template-footprint.html ' + response.status); return; }
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const template = doc.getElementById('template-footprint');
    holderEl.appendChild(document.importNode(template, true));
    setupSectionMenu(holderEl, options.sections);
    for (const src of scripts) await addScript(src);
  };
})();
