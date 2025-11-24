// Helper function to format URLs
const formatUrl = (url) => {
  return `<a href="${url}" target="_blank">${url.length > 30 ? url.substring(0, 30) + '...' : url}</a>`;
};
const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US');
};
function formatKey(str) {
  const allCaps = ['id', 'url', 'lol']; // Words to capitalize entirely
  const allLower = ['a', 'is', 'the', 'and', 'of', 'in', 'on', 'for', 'with']; // Words to keep all lowercase
  
  // Remove underscores and split the string into an array of words
  let words = str.replace(/_/g, ' ').split(' ');

  // Capitalize the first letter of each word
  words = words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  // Capitalize entire word if it's in the allCaps array
  words = words.map(word => {
      if (allCaps.includes(word.toLowerCase())) {
          return word.toUpperCase();
      }
      return word;
  });

  // Convert certain words to lowercase if they are in the allLower array
  words = words.map(word => {
      if (allLower.includes(word.toLowerCase())) {
          return word.toLowerCase();
      }
      return word;
  });

  // Join the words back into a string and return
  return words.join(' ');
}
function isEmpty(obj) {
  for (var prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      return false;
    }
  }
  return true
}

// Loop through yamlData and create divs for each key-value pair
function formatYamlLabel(data, profileContainer) {
  if (!profileContainer) {
    return;
  }

  profileContainer.innerHTML = '';

  let yamlData;
  try {
    yamlData = typeof data === 'string' ? jsyaml.load(data) : data;
  } catch (error) {
    console.error('Unable to parse YAML for label rendering:', error);
    profileContainer.textContent = 'Unable to render footprint label. Please check your YAML syntax.';
    return;
  }

  if (!yamlData || typeof yamlData !== 'object') {
    profileContainer.textContent = 'No label data available.';
    return;
  }

  const profileDiv = document.createElement('div');
  profileDiv.classList.add('envProfile');

  const profileTypeDiv = document.createElement('div');
  profileTypeDiv.classList.add('profileType');
  profileTypeDiv.textContent = formatKey(yamlData.profile_type || 'Product Profile');
  profileDiv.appendChild(profileTypeDiv);

  const profileTitleDiv = document.createElement('div');
  profileTitleDiv.classList.add('profileTitle');
  profileTitleDiv.textContent = yamlData.product_name || yamlData.name || yamlData.title || 'Product Title';
  profileDiv.appendChild(profileTitleDiv);

  Object.entries(yamlData).forEach(([key, value]) => {
    if (['profile_type', 'product_name', 'name', 'title'].includes(key)) {
      return;
    }
    appendYamlContent(profileDiv, key, value);
  });

  profileContainer.appendChild(profileDiv);
}

function appendYamlContent(container, key, value) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return;
    }
    const primitiveArray = value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item));
    if (primitiveArray) {
      const itemDiv = document.createElement('div');
      itemDiv.innerHTML = `<b>${formatKey(key)}</b> `;
      const span = document.createElement('span');
      span.textContent = value.join(', ');
      itemDiv.appendChild(span);
      container.appendChild(itemDiv);
      return;
    }

    const arrayWrapper = document.createElement('div');
    const header = document.createElement('div');
    header.innerHTML = `<b>${formatKey(key)}</b>`;
    arrayWrapper.appendChild(header);
    value.forEach((entry, index) => {
      const label = typeof entry === 'object' && entry !== null ? `${key} ${index + 1}` : '';
      appendYamlContent(arrayWrapper, label, entry);
    });
    container.appendChild(arrayWrapper);
    return;
  }

  if (typeof value === 'object') {
    if (isEmpty(value)) {
      return;
    }
    const wrapper = document.createElement('div');
    if (key) {
      const header = document.createElement('div');
      header.innerHTML = `<b>${formatKey(key)}</b>`;
      wrapper.appendChild(header);
    }
    Object.entries(value).forEach(([subKey, subValue]) => {
      appendYamlContent(wrapper, subKey, subValue);
    });
    container.appendChild(wrapper);
    return;
  }

  const itemDiv = document.createElement('div');
  if (key) {
    itemDiv.innerHTML = `<b>${formatKey(key)}</b> `;
  }
  const span = document.createElement('span');
  const loweredKey = (key || '').toLowerCase();
  if (loweredKey.includes('url') || key === 'ref') {
    span.innerHTML = formatUrl(value);
  } else if (loweredKey.includes('date')) {
    span.textContent = formatDate(value);
  } else {
    span.textContent = value;
  }
  itemDiv.appendChild(span);
  container.appendChild(itemDiv);
}
