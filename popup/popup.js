// Smart Form Filler - Dynamic Popup Script

const CATEGORY_ICONS = {
  personal: '👤',
  contact: '📧',
  address: '📍',
  professional: '💼',
  education: '🎓',
  other: '📋'
};

const CATEGORY_ORDER = ['personal', 'contact', 'address', 'education', 'professional', 'other'];

let formData = {};
let settings = {};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadStoredData();
  renderLearnedFields();
  setupTabs();
  setupEventListeners();
  updateFieldCount();
});

// Load data from Chrome storage
async function loadStoredData() {
  try {
    const result = await chrome.storage.local.get(['formData', 'settings']);
    formData = result.formData || {};
    settings = result.settings || { 
      autoFillEnabled: true, 
      showConfirmation: true, 
      learnFromForms: true,
      geminiApiKey: ''
    };
    
    // Apply settings to UI
    document.getElementById('autoFillEnabled').checked = settings.autoFillEnabled;
    document.getElementById('showConfirmation').checked = settings.showConfirmation;
    document.getElementById('learnFromForms').checked = settings.learnFromForms;
    document.getElementById('geminiApiKey').value = settings.geminiApiKey || '';
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Render learned fields dynamically
function renderLearnedFields(filter = '') {
  const container = document.getElementById('learnedFieldsContainer');
  container.innerHTML = '';
  
  let totalFields = 0;
  const filterLower = filter.toLowerCase();
  
  // Group fields by category
  const groupedFields = {};
  
  for (const [category, fields] of Object.entries(formData)) {
    if (typeof fields !== 'object') continue;
    
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!value || typeof value !== 'string') continue;
      
      // Apply filter
      if (filter && !fieldName.toLowerCase().includes(filterLower) && 
          !value.toLowerCase().includes(filterLower) &&
          !category.toLowerCase().includes(filterLower)) {
        continue;
      }
      
      if (!groupedFields[category]) {
        groupedFields[category] = [];
      }
      groupedFields[category].push({ fieldName, value });
      totalFields++;
    }
  }
  
  if (totalFields === 0) {
    container.innerHTML = `<p class="empty-state">${filter ? 'No matching fields found.' : 'No fields learned yet. Fill out forms to learn data, or add manually.'}</p>`;
    return;
  }
  
  // Render each category in order
  for (const category of CATEGORY_ORDER) {
    if (!groupedFields[category] || groupedFields[category].length === 0) continue;
    
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category-group';
    categoryDiv.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${CATEGORY_ICONS[category] || '📋'}</span>
        <span>${capitalize(category)}</span>
      </div>
    `;
    
    for (const { fieldName, value } of groupedFields[category]) {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'field-item';
      fieldItem.innerHTML = `
        <div class="field-info">
          <div class="field-name">${formatFieldName(fieldName)}</div>
          <div class="field-value" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
        </div>
        <div class="field-actions">
          <button class="field-btn edit" data-category="${category}" data-field="${fieldName}" title="Edit">✏️</button>
          <button class="field-btn delete" data-category="${category}" data-field="${fieldName}" title="Delete">🗑️</button>
        </div>
      `;
      categoryDiv.appendChild(fieldItem);
    }
    
    container.appendChild(categoryDiv);
  }
  
  // Also render any custom categories not in the order
  for (const [category, fields] of Object.entries(groupedFields)) {
    if (CATEGORY_ORDER.includes(category)) continue;
    
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category-group';
    categoryDiv.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${CATEGORY_ICONS[category] || '📋'}</span>
        <span>${capitalize(category)}</span>
      </div>
    `;
    
    for (const { fieldName, value } of fields) {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'field-item';
      fieldItem.innerHTML = `
        <div class="field-info">
          <div class="field-name">${formatFieldName(fieldName)}</div>
          <div class="field-value" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
        </div>
        <div class="field-actions">
          <button class="field-btn edit" data-category="${category}" data-field="${fieldName}" title="Edit">✏️</button>
          <button class="field-btn delete" data-category="${category}" data-field="${fieldName}" title="Delete">🗑️</button>
        </div>
      `;
      categoryDiv.appendChild(fieldItem);
    }
    
    container.appendChild(categoryDiv);
  }
  
  // Add event listeners to buttons
  container.querySelectorAll('.field-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => editField(btn.dataset.category, btn.dataset.field));
  });
  
  container.querySelectorAll('.field-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteField(btn.dataset.category, btn.dataset.field));
  });
}

// Setup tab navigation
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Search
  document.getElementById('searchFields').addEventListener('input', (e) => {
    renderLearnedFields(e.target.value);
  });
  
  // Add field button
  document.getElementById('addFieldBtn').addEventListener('click', addNewField);
  
  // Auto-fill toggle
  document.getElementById('autoFillEnabled').addEventListener('change', saveSettings);
  document.getElementById('showConfirmation').addEventListener('change', saveSettings);
  document.getElementById('learnFromForms').addEventListener('change', saveSettings);
  document.getElementById('geminiApiKey').addEventListener('blur', saveSettings);
  
  // Export/Import/Clear
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('clearData').addEventListener('click', clearAllData);
}

// Add new field
async function addNewField() {
  const nameInput = document.getElementById('newFieldName');
  const valueInput = document.getElementById('newFieldValue');
  const categorySelect = document.getElementById('newFieldCategory');
  
  const fieldName = nameInput.value.trim().toLowerCase().replace(/\s+/g, '_');
  const value = valueInput.value.trim();
  const category = categorySelect.value;
  
  if (!fieldName || !value) {
    showStatus('Please fill in both field name and value', 'error');
    return;
  }
  
  // Add to formData
  if (!formData[category]) {
    formData[category] = {};
  }
  formData[category][fieldName] = value;
  
  // Save to storage
  await chrome.storage.local.set({ formData });
  
  // Notify content scripts
  notifyContentScripts();
  
  // Clear inputs
  nameInput.value = '';
  valueInput.value = '';
  
  // Switch to learned tab and show
  document.querySelector('[data-tab="learned"]').click();
  renderLearnedFields();
  updateFieldCount();
  showStatus('Field added successfully!', 'success');
}

// Edit field
function editField(category, fieldName) {
  const currentValue = formData[category]?.[fieldName] || '';
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h3>Edit ${formatFieldName(fieldName)}</h3>
      <div class="form-group">
        <label>Value</label>
        <input type="text" id="editValue" value="${escapeHtml(currentValue)}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancelEdit">Cancel</button>
        <button class="btn btn-primary" id="saveEdit">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const input = document.getElementById('editValue');
  input.focus();
  input.select();
  
  document.getElementById('cancelEdit').addEventListener('click', () => modal.remove());
  document.getElementById('saveEdit').addEventListener('click', async () => {
    const newValue = input.value.trim();
    if (newValue) {
      formData[category][fieldName] = newValue;
      await chrome.storage.local.set({ formData });
      notifyContentScripts();
      renderLearnedFields(document.getElementById('searchFields').value);
      showStatus('Field updated!', 'success');
    }
    modal.remove();
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Delete field
async function deleteField(category, fieldName) {
  if (!confirm(`Delete "${formatFieldName(fieldName)}"?`)) return;
  
  delete formData[category][fieldName];
  
  // Clean up empty categories
  if (Object.keys(formData[category]).length === 0) {
    delete formData[category];
  }
  
  await chrome.storage.local.set({ formData });
  notifyContentScripts();
  renderLearnedFields(document.getElementById('searchFields').value);
  updateFieldCount();
  showStatus('Field deleted', 'success');
}

// Save settings
async function saveSettings() {
  settings = {
    autoFillEnabled: document.getElementById('autoFillEnabled').checked,
    showConfirmation: document.getElementById('showConfirmation').checked,
    learnFromForms: document.getElementById('learnFromForms').checked,
    geminiApiKey: document.getElementById('geminiApiKey').value.trim()
  };
  
  await chrome.storage.local.set({ settings });
  notifyContentScripts();
  showStatus('Settings saved', 'success');
}

// Export data
function exportData() {
  const data = { formData, settings, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `form-filler-backup-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showStatus('Data exported!', 'success');
}

// Import data
async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (data.formData) {
      formData = { ...formData, ...data.formData };
      await chrome.storage.local.set({ formData });
    }
    
    if (data.settings) {
      settings = { ...settings, ...data.settings };
      await chrome.storage.local.set({ settings });
      document.getElementById('autoFillEnabled').checked = settings.autoFillEnabled;
      document.getElementById('showConfirmation').checked = settings.showConfirmation;
      document.getElementById('learnFromForms').checked = settings.learnFromForms;
      document.getElementById('geminiApiKey').value = settings.geminiApiKey || '';
    }
    
    notifyContentScripts();
    renderLearnedFields();
    updateFieldCount();
    showStatus('Data imported!', 'success');
  } catch (error) {
    showStatus('Invalid file format', 'error');
  }
  
  e.target.value = '';
}

// Clear all data
async function clearAllData() {
  if (!confirm('Are you sure? This will delete ALL saved form data.')) return;
  
  formData = {};
  await chrome.storage.local.set({ formData });
  notifyContentScripts();
  renderLearnedFields();
  updateFieldCount();
  showStatus('All data cleared', 'success');
}

// Notify content scripts
function notifyContentScripts() {
  chrome.runtime.sendMessage({ action: 'dataUpdated', formData, settings });
}

// Update field count
function updateFieldCount() {
  let count = 0;
  for (const category of Object.values(formData)) {
    if (typeof category === 'object') {
      count += Object.keys(category).length;
    }
  }
  document.getElementById('fieldCount').textContent = `${count} field${count !== 1 ? 's' : ''} stored`;
}

// Show status message
function showStatus(message, type = 'success') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

// Utilities
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatFieldName(name) {
  return name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ').map(capitalize).join(' ');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
