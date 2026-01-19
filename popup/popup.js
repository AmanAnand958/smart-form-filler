// Smart Form Filler - Enhanced Popup Script
// Features: Multi-profile, Templates, History, Keyboard shortcuts, Partial fill
// Note: API_BASE is defined in sync-service.js


const CATEGORY_ICONS = {
  personal: '👤',
  contact: '📧',
  address: '📍',
  professional: '💼',
  education: '🎓',
  other: '📋'
};

const CATEGORY_ORDER = ['personal', 'contact', 'address', 'education', 'professional', 'other'];

const DEFAULT_PROFILES = ['personal', 'work', 'job_apps'];

// Pre-built templates
const TEMPLATES = {
  linkedin: {
    personal: { firstName: '', lastName: '', fullName: '' },
    contact: { email: '', phone: '' },
    professional: { company: '', jobTitle: '', linkedin: '' }
  },
  indeed: {
    personal: { firstName: '', lastName: '' },
    contact: { email: '', phone: '' },
    professional: { company: '', jobTitle: '' },
    education: { university: '', degree: '' }
  },
  github: {
    personal: { fullName: '', username: '' },
    contact: { email: '' },
    professional: { company: '', website: '', bio: '' }
  },
  workday: {
    personal: { firstName: '', lastName: '', middleName: '' },
    contact: { email: '', phone: '', alternatePhone: '' },
    address: { street: '', city: '', state: '', zip: '', country: '' },
    education: { university: '', degree: '', major: '', graduationYear: '', gpa: '' },
    professional: { company: '', jobTitle: '', salary: '' }
  },
  contact: {
    personal: { firstName: '', lastName: '', fullName: '' },
    contact: { email: '', phone: '' },
    address: { street: '', city: '', state: '', zip: '', country: '' }
  },
  job_application: {
    personal: { firstName: '', lastName: '', fullName: '', dob: '' },
    contact: { email: '', phone: '' },
    address: { street: '', city: '', state: '', zip: '', country: '' },
    education: { university: '', degree: '', major: '', graduationYear: '', gpa: '' },
    professional: { company: '', jobTitle: '', experience: '', linkedin: '', github: '' },
    other: { skills: '', bio: '' }
  }
};

let profiles = {};
let lockedProfiles = [];
let currentProfile = 'personal';
let formData = {};
let settings = {};
let authToken = null;
let userEmail = null;
let isSignupMode = false;
let fillHistory = [];
let syncService = null;
let currentOnboardingSlide = 1;
let currentTab = 'learned';
let currentDomain = '';

// Initialize popup with error boundary
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkAuth();
  } catch (error) {
    console.error('Popup initialization failed:', error);
    showFatalError(error);
  }
});

// Show fatal error screen with recovery options
function showFatalError(error) {
  document.body.innerHTML = `
    <div style="padding: 40px; text-align: center; font-family: system-ui; color: #1f2937;">
      <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
      <h2 style="margin: 0 0 10px 0; color: #dc2626;">Extension Error</h2>
      <p style="color: #6b7280; margin-bottom: 20px;">
        Smart Form Filler encountered an initialization error.
      </p>
      <details style="margin: 20px 0; text-align: left; background: #f3f4f6; padding: 15px; border-radius: 8px;">
        <summary style="cursor: pointer; font-weight: 600; color: #374151;">Technical Details</summary>
        <pre style="margin-top: 10px; font-size: 12px; color: #6b7280; overflow: auto;">${error.message}\n${error.stack}</pre>
      </details>
      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 30px;">
        <button onclick="chrome.runtime.reload()" style="padding: 10px 20px; background: linear-gradient(135deg, #7C3AED, #EC4899); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Reload Extension
        </button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #e5e7eb; color: #374151; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Close
        </button>
      </div>
    </div>
  `;
}

// Check authentication status
async function checkAuth() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'userEmail', 'guestMode']);
    authToken = result.authToken;
    userEmail = result.userEmail;
    
    // If in guest mode, skip auth
    if (result.guestMode) {
      showMainApp();
      return;
    }
    
    if (authToken) {
      const valid = await verifyToken();
      if (valid) {
        // Initialize SyncService
        if (typeof SyncService !== 'undefined') {
          syncService = new SyncService();
          // Auto-pull on init
          syncService.pull().then(updatedProfiles => {
            if (updatedProfiles) {
               console.log('SyncService: Initial pull complete');
               loadStoredData(); // Reloads profiles from storage
            }
          });
        }
        showMainApp();
        return;
      }
    }
    showAuthForm();
  } catch (error) {
    console.error('Auth check error:', error);
    showAuthForm();
  }
}

// Verify token with server
async function verifyToken() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Show auth form
function showAuthForm() {
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  setupAuthListeners();
}

// Show main app
async function showMainApp() {
  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('userEmail').textContent = userEmail || 'Guest';
  
  await loadStoredData();
  await loadProfiles();
  await loadHistory();
  
  if (authToken && !settings?.guestMode) {
    await syncFromCloud();
    // After cloud sync, we should reload the local state to reflect changes
    await loadProfiles();
    await loadStoredData();
  }
  
  await initializeSiteControl();
  renderProfileOptions();
  renderTemplates();
  setupTabs();
  setupEventListeners();
  renderLearnedFields();  // Add this to render fields on load
  updateFieldCount();
  applyTheme();
  updateSyncStatusUI();
  
  // Start periodic status update
  setInterval(updateSyncStatusUI, 5000);

  // Check if onboarding needed
  const result = await chrome.storage.local.get(['onboardingComplete']);
  if (!result.onboardingComplete) {
    showOnboarding();
  }
}


// Load profiles from storage
async function loadProfiles() {
  try {
    const result = await chrome.storage.local.get(['profiles', 'currentProfile', 'lockedProfiles']);
    profiles = result.profiles || {};
    currentProfile = result.currentProfile || 'personal';
    lockedProfiles = result.lockedProfiles || [];
    
    // Initialize default profiles if empty
    if (Object.keys(profiles).length === 0) {
      for (const name of DEFAULT_PROFILES) {
        profiles[name] = {};
      }
      await chrome.storage.local.set({ profiles });
    }
    
    // Set formData to current profile
    formData = profiles[currentProfile] || {};
    updateLockUI();
  } catch (error) {
    console.error('Error loading profiles:', error);
  }
}

// Save current profile
async function saveCurrentProfile() {
  const now = new Date().toISOString();
  formData.updatedAt = now;
  profiles[currentProfile] = formData;
  await chrome.storage.local.set({ profiles, currentProfile });
  
  if (syncService) {
    syncService.queueSync('update_profile', { formData, profiles, updatedAt: now });
  } else {
    syncToCloud();
  }
}

// Render profile options
function renderProfileOptions() {
  const select = document.getElementById('profileSelect');
  select.innerHTML = '';
  
  const icons = { personal: '👤', work: '💼', job_apps: '📝' };
  
  for (const name of Object.keys(profiles)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = `${icons[name] || '📁'} ${formatProfileName(name)}`;
    option.selected = name === currentProfile;
    select.appendChild(option);
  }
}

// Format profile name
function formatProfileName(name) {
  return name.replace(/_/g, ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

// Switch profile
async function switchProfile(profileName) {
  // Save current profile first
  profiles[currentProfile] = formData;
  
  // Switch to new profile
  currentProfile = profileName;
  formData = profiles[currentProfile] || {};
  
  await chrome.storage.local.set({ profiles, currentProfile });
  renderLearnedFields();
  updateFieldCount();
  updateLockUI();
  showStatus(`Switched to ${formatProfileName(profileName)}`, 'success');
}

// Add new profile
async function addNewProfile() {
  const name = prompt('Enter profile name:');
  if (!name) return;
  
  const key = name.toLowerCase().replace(/\s+/g, '_');
  if (profiles[key]) {
    showStatus('Profile already exists', 'error');
    return;
  }
  
  profiles[key] = {};
  await chrome.storage.local.set({ profiles });
  renderProfileOptions();
  showStatus(`Profile "${name}" created`, 'success');
}

// Toggle Lock Profile
async function toggleLockProfile() {
  const index = lockedProfiles.indexOf(currentProfile);
  if (index === -1) {
    lockedProfiles.push(currentProfile);
    showStatus('Profile Locked', 'success');
  } else {
    lockedProfiles.splice(index, 1);
    showStatus('Profile Unlocked', 'success');
  }
  
  await chrome.storage.local.set({ lockedProfiles });
  updateLockUI();
  updateGuestModeUI(); // Refresh UI state
}

// Update Lock UI
function updateLockUI() {
  const isLocked = lockedProfiles.includes(currentProfile);
  const btn = document.getElementById('lockProfileBtn');
  const container = document.querySelector('.container');
  
  if (btn) {
    btn.textContent = isLocked ? '🔒' : '🔓';
    btn.classList.toggle('locked', isLocked);
    btn.title = isLocked ? 'Unlock Profile' : 'Lock Profile';
  }
  
  if (container) {
    container.classList.toggle('profile-locked', isLocked);
  }
  
  // Disableinputs if locked
  const inputs = document.querySelectorAll('#addNew input, #addNew select, .field-item input');
  inputs.forEach(input => {
    input.disabled = isLocked;
  });
}

// Load fill history
async function loadHistory() {
  try {
    const result = await chrome.storage.local.get(['fillHistory']);
    fillHistory = result.fillHistory || [];
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

// Add to history
async function addToHistory(site, fieldsCount) {
  const entry = {
    id: Date.now(),
    site: site,
    fieldsCount: fieldsCount,
    timestamp: new Date().toISOString(),
    profileSnapshot: JSON.parse(JSON.stringify(formData))
  };
  
  fillHistory.unshift(entry);
  if (fillHistory.length > 10) fillHistory.pop();
  
  await chrome.storage.local.set({ fillHistory });
}

// Import template
function importTemplate(templateName) {
  const template = TEMPLATES[templateName];
  if (!template) return;
  
  // Merge template structure with current data (only add empty fields)
  for (const [category, fields] of Object.entries(template)) {
    if (!formData[category]) formData[category] = {};
    for (const fieldName of Object.keys(fields)) {
      if (!formData[category][fieldName]) {
        formData[category][fieldName] = '';
      }
    }
  }
  
  saveCurrentProfile();
  renderLearnedFields();
  updateFieldCount();
  
  // Switch to Learned tab
  document.querySelector('[data-tab="learned"]').click();
  showStatus(`${formatProfileName(templateName)} template imported`, 'success');
}

// Setup auth event listeners
function setupAuthListeners() {
  const submitBtn = document.getElementById('authSubmit');
  const guestBtn = document.getElementById('guestModeBtn');
  const toggleLink = document.getElementById('authToggleLink');
  const passwordInput = document.getElementById('authPassword');
  
  submitBtn.onclick = handleAuthSubmit;
  guestBtn.onclick = continueAsGuest;
  toggleLink.onclick = (e) => {
    e.preventDefault();
    toggleAuthMode();
  };
  
  passwordInput.onkeypress = (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  };
}

// Toggle between login/signup
function toggleAuthMode() {
  isSignupMode = !isSignupMode;
  document.getElementById('authTitle').textContent = isSignupMode ? 'Sign Up' : 'Login';
  document.getElementById('authSubmit').textContent = isSignupMode ? 'Sign Up' : 'Login';
  document.getElementById('authToggleText').textContent = isSignupMode ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('authToggleLink').textContent = isSignupMode ? 'Login' : 'Sign up';
  document.getElementById('authError').textContent = '';
}

// Continue as guest (no authentication)
async function continueAsGuest() {
  const { settings: storedSettings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ 
    guestMode: true,
    userEmail: 'guest@local',
    settings: { ...storedSettings, guestMode: true }
  });
  showMainApp();
}

// Handle auth submit
async function handleAuthSubmit() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmit');
  
  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password';
    return;
  }
  
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters';
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = isSignupMode ? 'Signing up...' : 'Logging in...';
  errorEl.textContent = '';
  
  try {
    const endpoint = isSignupMode ? '/api/auth/signup' : '/api/auth/login';
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    
    authToken = data.token;
    userEmail = data.user.email;
    const { settings: storedSettings = {} } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ 
      authToken, 
      userEmail,
      guestMode: false,
      settings: { ...storedSettings, guestMode: false }
    });
    
    showMainApp();
  } catch (error) {
    errorEl.textContent = error.message || 'Connection failed. Check if server is running.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isSignupMode ? 'Sign Up' : 'Login';
  }
}

// Logout
async function logout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.textContent = 'Syncing...';

  // Sync before logging out to prevent data loss
  if (syncService && navigator.onLine) {
    try {
      console.log('Logout: Syncing pending changes...');
      await syncService.processQueue();
    } catch (e) {
      console.error('Logout sync failed:', e);
    }
  }

  authToken = null;
  userEmail = null;
  
  // Clear all user data to ensure isolation
  await chrome.storage.local.remove([
    'authToken', 'userEmail', 'guestMode',
    'profiles', 'formData', 'lockedProfiles', 
    'syncQueue', 'lastSyncTime', 'currentProfile'
  ]);
  
  // Reset runtime variables
  profiles = {};
  formData = {};
  lockedProfiles = [];
  currentProfile = 'personal';
  
  showAuthForm();
}

// Sync from cloud
async function syncFromCloud() {
  if (!authToken) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.formData && Object.keys(data.formData).length > 0) {
        if (syncService) {
          formData = syncService.resolveConflicts(formData, data.formData);
        } else {
          formData = mergeFormData(formData, data.formData);
        }
        profiles[currentProfile] = formData;
        if (data.profiles) {
          profiles = { ...profiles, ...data.profiles };
        }
        await chrome.storage.local.set({ formData, profiles });
        renderLearnedFields();
        updateFieldCount();
      }
    }
  } catch (error) {
    console.error('Sync from cloud failed:', error);
  }
}

// Sync to cloud
async function syncToCloud() {
  if (!authToken) return;
  
  const syncBtn = document.getElementById('syncBtn');
  syncBtn?.classList.add('syncing');
  
  try {
    await fetch(`${API_BASE}/api/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ formData, profiles })
    });
  } catch (error) {
    console.error('Sync to cloud failed:', error);
  } finally {
    syncBtn?.classList.remove('syncing');
  }
}

// Save stored data to Chrome storage
async function saveStoredData() {
  try {
    await chrome.storage.local.set({ formData, profiles });
  } catch (error) {
    console.error('Error saving stored data:', error);
  }
}



// Merge form data
function mergeFormData(local, cloud) {
  const merged = { ...local };
  for (const [category, fields] of Object.entries(cloud)) {
    if (typeof fields !== 'object') continue;
    if (!merged[category]) merged[category] = {};
    for (const [fieldName, value] of Object.entries(fields)) {
      if (value) merged[category][fieldName] = value;
    }
  }
  return merged;
}

// Load data from Chrome storage
async function loadStoredData() {
  try {
    const result = await chrome.storage.local.get(['formData', 'settings', 'guestMode']);
    formData = result.formData || {};
    settings = result.settings || { 
      autoFillEnabled: true, 
      showConfirmation: true, 
      learnFromForms: true,
      geminiApiKey: '',
      theme: 'dark',
      guestMode: result.guestMode || false
    };
    if (result.guestMode !== undefined) {
      settings.guestMode = result.guestMode;
    }
    
    const autoFillCheckbox = document.getElementById('autoFillEnabled');
    const guestModeCheckbox = document.getElementById('guestModeEnabled');
    const confirmCheckbox = document.getElementById('showConfirmation');
    const learnCheckbox = document.getElementById('learnFromForms');
    const apiKeyInput = document.getElementById('geminiApiKey');
    const magicIconCheckbox = document.getElementById('showMagicIcon');
    const hudCheckbox = document.getElementById('showHUD');
    const magicIconSelect = document.getElementById('magicIconBehavior');
    
    if (autoFillCheckbox) autoFillCheckbox.checked = settings.autoFillEnabled && !settings.guestMode;
    if (guestModeCheckbox) guestModeCheckbox.checked = settings.guestMode || false;
    if (confirmCheckbox) confirmCheckbox.checked = settings.showConfirmation;
    if (learnCheckbox) learnCheckbox.checked = settings.learnFromForms && !settings.guestMode;
    if (apiKeyInput) apiKeyInput.value = settings.geminiApiKey || '';
    if (magicIconCheckbox) magicIconCheckbox.checked = settings.showMagicIcon !== false;
    if (hudCheckbox) hudCheckbox.checked = settings.showHUD !== false;
    if (magicIconSelect) magicIconSelect.value = settings.magicIconBehavior || 'always';
    
    updateGuestModeUI();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Apply theme
function applyTheme() {
  if (settings.theme === 'light') {
    document.body.classList.add('light-theme');
    document.getElementById('themeLight')?.classList.add('active');
    document.getElementById('themeDark')?.classList.remove('active');
  } else {
    document.body.classList.remove('light-theme');
    document.getElementById('themeDark')?.classList.add('active');
    document.getElementById('themeLight')?.classList.remove('active');
  }
}

// Set theme
function setTheme(theme) {
  settings.theme = theme;
  applyTheme();
  saveSettings();
}

// Update Sync Status UI
function updateSyncStatusUI() {
  if (!syncService) return;
  
  const status = syncService.getStatus();
  const statusEl = document.getElementById('syncStatusText');
  const timeEl = document.getElementById('lastSyncTime');
  const queueInfo = document.getElementById('syncQueueInfo');
  const queueCount = document.getElementById('queueCount');
  
  if (status.isSyncing) {
    statusEl.textContent = '🔄 Syncing...';
    document.getElementById('syncBtn')?.classList.add('syncing');
  } else if (!status.isOnline) {
    statusEl.textContent = '🔴 Offline';
    document.getElementById('syncBtn')?.classList.remove('syncing');
  } else {
    statusEl.textContent = '🟢 Synced';
    document.getElementById('syncBtn')?.classList.remove('syncing');
  }
  
  if (status.lastSyncTime) {
    const date = new Date(status.lastSyncTime);
    timeEl.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  if (status.queueLength > 0) {
    queueInfo.classList.remove('hidden');
    queueInfo.classList.add('visible');
    queueCount.textContent = status.queueLength;
  } else {
    queueInfo.classList.add('hidden');
    queueInfo.classList.remove('visible');
  }
}

// Onboarding Logic
function showOnboarding() {
  document.getElementById('onboardingModal').classList.remove('hidden');
  currentOnboardingSlide = 1;
  updateOnboardingView();
}

function updateOnboardingView() {
  const slides = document.querySelectorAll('.onboarding-slide');
  const dots = document.querySelectorAll('.dot');
  const nextBtn = document.getElementById('onboardingNext');
  
  slides.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));
  
  const currentSlide = document.querySelector(`.onboarding-slide[data-slide="${currentOnboardingSlide}"]`);
  const currentDot = document.querySelector(`.dot[data-slide="${currentOnboardingSlide}"]`);
  
  currentSlide.classList.add('active');
  currentDot.classList.add('active');
  
  if (currentOnboardingSlide === slides.length) {
    nextBtn.textContent = 'Get Started';
  } else {
    nextBtn.textContent = 'Next →';
  }
}

async function handleOnboardingNext() {
  const slides = document.querySelectorAll('.onboarding-slide');
  if (currentOnboardingSlide < slides.length) {
    currentOnboardingSlide++;
    updateOnboardingView();
  } else {
    document.getElementById('onboardingModal').classList.add('hidden');
    await chrome.storage.local.set({ onboardingComplete: true });
  }
}

// Render learned fields
function renderLearnedFields(filter = '') {
  const container = document.getElementById('learnedFieldsContainer');
  container.innerHTML = '';
  
  let totalFields = 0;
  const filterLower = filter.toLowerCase();
  const groupedFields = {};
  
  for (const [category, fields] of Object.entries(formData)) {
    if (typeof fields !== 'object') continue;
    
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!value || typeof value !== 'string') continue;
      
      if (filter && !fieldName.toLowerCase().includes(filterLower) && 
          !value.toLowerCase().includes(filterLower) &&
          !category.toLowerCase().includes(filterLower)) {
        continue;
      }
      
      if (!groupedFields[category]) groupedFields[category] = [];
      groupedFields[category].push({ fieldName, value });
      totalFields++;
    }
  }
  
  if (totalFields === 0) {
    container.innerHTML = `<p class="empty-state">${filter ? 'No matching fields found.' : 'No fields learned yet. Fill out forms to learn data, or add manually.'}</p>`;
    return;
  }
  
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
      fieldItem.draggable = true;
      fieldItem.dataset.category = category;
      fieldItem.dataset.field = fieldName;
      fieldItem.innerHTML = `
        <div class="drag-handle" title="Drag to reorder/re-categorize">⠿</div>
        <div class="field-checkbox-container">
          <input type="checkbox" class="field-checkbox" data-category="${category}" data-field="${fieldName}">
        </div>
        <div class="field-info">
          <div class="field-name">${formatFieldName(fieldName)}</div>
          <div class="field-value-wrapper">
            <span class="field-value masked" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
            <span class="toggle-mask" title="Reveal/Hide">👁️</span>
          </div>
        </div>
        <div class="field-actions">
          <button class="field-btn edit" data-category="${category}" data-field="${fieldName}" title="Edit">✏️</button>
          <button class="field-btn delete" data-category="${category}" data-field="${fieldName}" title="Delete">🗑️</button>
        </div>
      `;
      categoryDiv.appendChild(fieldItem);
      
      // Mask Toggle
      fieldItem.querySelector('.toggle-mask').addEventListener('click', (e) => {
        e.stopPropagation();
        const valSpan = e.target.parentElement.querySelector('.field-value');
        valSpan.classList.toggle('masked');
        e.target.textContent = valSpan.classList.contains('masked') ? '👁️' : '🔒';
      });

      // Drag Events
      fieldItem.addEventListener('dragstart', handleDragStart);
      fieldItem.addEventListener('dragover', handleDragOver);
      fieldItem.addEventListener('drop', handleDrop);
      fieldItem.addEventListener('dragend', handleDragEnd);
      fieldItem.addEventListener('dragleave', handleDragLeave);
    }
    
    container.appendChild(categoryDiv);
  }
  
  // Custom categories
  for (const [category, fields] of Object.entries(groupedFields)) {
    if (CATEGORY_ORDER.includes(category)) continue;
    
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category-group';
    categoryDiv.innerHTML = `
      <div class="category-header">
        <span class="category-icon">📋</span>
        <span>${capitalize(category)}</span>
      </div>
    `;
    
    for (const { fieldName, value } of fields) {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'field-item';
      fieldItem.draggable = true;
      fieldItem.dataset.category = category;
      fieldItem.dataset.field = fieldName;
      fieldItem.innerHTML = `
        <div class="drag-handle" title="Drag to reorder/re-categorize">⠿</div>
        <div class="field-checkbox-container">
          <input type="checkbox" class="field-checkbox" data-category="${category}" data-field="${fieldName}">
        </div>
        <div class="field-info">
          <div class="field-name">${formatFieldName(fieldName)}</div>
          <div class="field-value-wrapper">
            <span class="field-value masked" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
            <span class="toggle-mask" title="Reveal/Hide">👁️</span>
          </div>
        </div>
        <div class="field-actions">
          <button class="field-btn edit" data-category="${category}" data-field="${fieldName}" title="Edit">✏️</button>
          <button class="field-btn delete" data-category="${category}" data-field="${fieldName}" title="Delete">🗑️</button>
        </div>
      `;
      categoryDiv.appendChild(fieldItem);

      // Mask Toggle
      fieldItem.querySelector('.toggle-mask').addEventListener('click', (e) => {
        e.stopPropagation();
        const valSpan = e.target.parentElement.querySelector('.field-value');
        valSpan.classList.toggle('masked');
        e.target.textContent = valSpan.classList.contains('masked') ? '👁️' : '🔒';
      });
      
      // Drag Events
      fieldItem.addEventListener('dragstart', handleDragStart);
      fieldItem.addEventListener('dragover', handleDragOver);
      fieldItem.addEventListener('drop', handleDrop);
      fieldItem.addEventListener('dragend', handleDragEnd);
      fieldItem.addEventListener('dragleave', handleDragLeave);
    }
    
    container.appendChild(categoryDiv);
  }
  
  // Re-bind listeners
  container.querySelectorAll('.field-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editField(btn.dataset.category, btn.dataset.field);
    });
  });
  
  container.querySelectorAll('.field-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteField(btn.dataset.category, btn.dataset.field);
    });
  });

  // Bulk Selection Listeners
  container.querySelectorAll('.field-checkbox').forEach(cb => {
    cb.addEventListener('change', toggleBulkActions);
  });
}

// Bulk Actions Logic
function toggleBulkActions() {
  const checked = document.querySelectorAll('.field-checkbox:checked');
  const bar = document.getElementById('bulkActionsBar');
  const count = document.getElementById('selectedCount');
  const selectAll = document.getElementById('selectAllFields');
  
  if (checked.length > 0) {
    bar.classList.remove('hidden');
    count.textContent = `${checked.length} selected`;
    
    const all = document.querySelectorAll('.field-checkbox');
    selectAll.checked = all.length === checked.length;
  } else {
    bar.classList.add('hidden');
    selectAll.checked = false;
  }
}

async function handleBulkDelete() {
  const checked = document.querySelectorAll('.field-checkbox:checked');
  if (!checked.length) return;
  
  if (!confirm(`Delete ${checked.length} selected fields?`)) return;
  
  checked.forEach(cb => {
    const { category, field } = cb.dataset;
    delete formData[category][field];
    if (Object.keys(formData[category]).length === 0) delete formData[category];
  });
  
  await saveCurrentProfile();
  await chrome.storage.local.set({ formData });
  notifyContentScripts();
  renderLearnedFields();
  toggleBulkActions();
  updateFieldCount();
  showStatus(`${checked.length} fields deleted`, 'success');
}

async function handleBulkMove() {
  const checked = document.querySelectorAll('.field-checkbox:checked');
  if (!checked.length) return;
  
  const newCategory = prompt('Enter target category (personal, contact, address, education, professional, other):');
  if (!newCategory || !CATEGORY_ORDER.includes(newCategory.toLowerCase())) {
    showStatus('Invalid category', 'error');
    return;
  }
  
  const targetCategory = newCategory.toLowerCase();
  
  checked.forEach(cb => {
    const { category, field } = cb.dataset;
    const value = formData[category][field];
    
    if (!formData[targetCategory]) formData[targetCategory] = {};
    formData[targetCategory][field] = value;
    
    delete formData[category][field];
    if (Object.keys(formData[category]).length === 0) delete formData[category];
  });
  
  await saveCurrentProfile();
  await chrome.storage.local.set({ formData });
  notifyContentScripts();
  renderLearnedFields();
  toggleBulkActions();
  showStatus(`Moved ${checked.length} fields to ${targetCategory}`, 'success');
}

// Drag and Drop Logic
let draggedField = null;

function handleDragStart(e) {
  draggedField = {
    category: this.dataset.category,
    field: this.dataset.field,
    element: this
  };
  this.classList.add('dragging');
  e.dataTransfer.setData('text/plain', JSON.stringify({ category: this.dataset.category, field: this.dataset.field }));
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault();
  this.classList.add('drag-over');
  return false;
}

function handleDragLeave() {
  this.classList.remove('drag-over');
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.field-item').forEach(item => item.classList.remove('drag-over'));
}

async function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  this.classList.remove('drag-over');
  
  if (!draggedField) return;
  
  const targetCategory = this.dataset.category;
  const sourceCategory = draggedField.category;
  const sourceField = draggedField.field;
  
  if (sourceCategory === targetCategory) {
    // Reorder within same category (simulation for now as we use objects)
    // In a real array-based storage, we'd move the item in the array
    return;
  }
  
  // Move to different category
  const value = formData[sourceCategory][sourceField];
  if (!formData[targetCategory]) formData[targetCategory] = {};
  formData[targetCategory][sourceField] = value;
  
  delete formData[sourceCategory][sourceField];
  if (Object.keys(formData[sourceCategory]).length === 0) delete formData[sourceCategory];
  
  await saveCurrentProfile();
  await chrome.storage.local.set({ formData });
  notifyContentScripts();
  renderLearnedFields();
  showStatus(`Moved to ${targetCategory}`, 'success');
  
  draggedField = null;
}

// Render templates (templates are already in HTML, this ensures the UI is ready)
function renderTemplates() {
  // Templates are statically defined in HTML, just ensure click handlers are bound
  console.log('Templates rendered');
}

// Setup tab navigation
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });
}


function switchTab(tabId) {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  
  contents.forEach(c => {
    c.classList.toggle('active', c.id === tabId);
  });
  
  currentTab = tabId;
}

// Setup event listeners
function setupEventListeners() {
  // Search
  document.getElementById('searchFields').addEventListener('input', (e) => {
    renderLearnedFields(e.target.value);
  });
  
  // Add field button
  document.getElementById('addFieldBtn').addEventListener('click', addNewField);
  
  // Settings
  document.getElementById('autoFillEnabled').addEventListener('change', saveSettings);
  document.getElementById('guestModeEnabled').addEventListener('change', saveSettings);
  document.getElementById('showConfirmation').addEventListener('change', saveSettings);
  document.getElementById('learnFromForms').addEventListener('change', saveSettings);
  document.getElementById('showMagicIcon').addEventListener('change', saveSettings);
  document.getElementById('showHUD').addEventListener('change', saveSettings);
  document.getElementById('magicIconBehavior').addEventListener('change', saveSettings);
  document.getElementById('geminiApiKey').addEventListener('blur', saveSettings);
  document.getElementById('testApiKey')?.addEventListener('click', testGeminiApiKey);
  
  // Export/Import/Clear
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', importData);
  
  
  // Theme Toggle
  document.getElementById('themeDark')?.addEventListener('click', () => setTheme('dark'));
  document.getElementById('themeLight')?.addEventListener('click', () => setTheme('light'));
  
  // Onboarding
  document.getElementById('showOnboarding')?.addEventListener('click', showOnboarding);
  document.getElementById('onboardingNext')?.addEventListener('click', handleOnboardingNext);
  document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => {
      currentOnboardingSlide = parseInt(dot.dataset.slide);
      updateOnboardingView();
    });
  });

  // Bulk Actions
  document.getElementById('selectAllFields')?.addEventListener('change', (e) => {
    document.querySelectorAll('.field-checkbox').forEach(cb => {
      cb.checked = e.target.checked;
    });
    toggleBulkActions();
  });
  document.getElementById('bulkDelete')?.addEventListener('click', handleBulkDelete);
  document.getElementById('bulkMove')?.addEventListener('click', handleBulkMove);
  
  // Sync and Logout
  document.getElementById('syncBtn').addEventListener('click', async () => {
    // Check if user is authenticated
    const { guestMode } = await chrome.storage.local.get(['guestMode']);
    
    if (guestMode) {
      showStatus('Sync not available in Guest Mode', 'info');
      return;
    }
    
    if (!authToken) {
      showStatus('Please log in to sync', 'error');
      return;
    }
    
    try {
      if (syncService) {
        await syncService.processQueue();
      }
      await syncToCloud();
      showStatus('Synced successfully!', 'success');
    } catch (error) {
      console.error('Sync error:', error);
      if (error.message === 'AUTH_EXPIRED') {
        showStatus('Session expired. Please log in again.', 'error');
      } else {
        showStatus('Sync failed. Will retry later.', 'error');
      }
    }
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Profile selector
  document.getElementById('profileSelect').addEventListener('change', (e) => {
    switchProfile(e.target.value);
  });
  document.getElementById('addProfileBtn').addEventListener('click', addNewProfile);
  document.getElementById('lockProfileBtn').addEventListener('click', toggleLockProfile);
  document.getElementById('shareProfileBtn')?.addEventListener('click', shareProfile);
  document.getElementById('siteEnabled')?.addEventListener('change', toggleSiteEnabled);
  
  // Templates
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      importTemplate(card.dataset.template);
    });
  });

  // Smart Import
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  dropZone?.addEventListener('click', () => fileInput.click());
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleExtractFile(file);
  });
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleExtractFile(file);
  });

  document.getElementById('extractUrlBtn')?.addEventListener('click', handleExtractUrl);
  document.getElementById('saveExtractedBtn')?.addEventListener('click', saveExtractedData);
  document.getElementById('cancelExtractedBtn')?.addEventListener('click', () => {
    document.getElementById('reviewContainer').classList.add('hidden');
    document.getElementById('extractedDataList').innerHTML = '';
  });
  
  // Backup & Restore
  document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
  document.getElementById('importDataBtn')?.addEventListener('click', triggerImport);
  document.getElementById('importFileInput')?.addEventListener('change', handleImportData);
  
  // AI Tools
  document.getElementById('autoCaptureJDBtn')?.addEventListener('click', autoCaptureJD);
  document.getElementById('generateCoverLetterBtn')?.addEventListener('click', generateCoverLetter);
  document.getElementById('copyCoverLetterBtn')?.addEventListener('click', copyCoverLetter);
}

// Add new field
async function addNewField() {
  if (lockedProfiles.includes(currentProfile)) {
    showStatus('Profile is locked. Unlock to add fields.', 'error');
    return;
  }
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

  // Validation
  const validation = validateField(fieldName, value);
  if (!validation.valid) {
    showStatus(validation.message, 'error');
    return;
  }
  
  if (!formData[category]) formData[category] = {};
  
  // Track field history before updating
  await trackFieldHistory(category, fieldName, formData[category][fieldName]);
  
  formData[category][fieldName] = value;
  
  await saveCurrentProfile();
  await chrome.storage.local.set({ formData });
  notifyContentScripts();
  
  nameInput.value = '';
  valueInput.value = '';
  
  document.querySelector('[data-tab="learned"]').click();
  renderLearnedFields();
  updateFieldCount();
  showStatus('Field added successfully!', 'success');
}

// Edit field
function editField(category, fieldName) {
  const currentValue = formData[category]?.[fieldName] || '';
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h3>Edit ${formatFieldName(fieldName)}</h3>
      <div class="form-group">
        <label>Value</label>
        <input type="text" id="editValue" value="${escapeHtml(currentValue)}">
      </div>
      <button class="btn btn-secondary" id="viewHistoryBtn" style="margin-top: 10px;">📜 View History</button>
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
  
  document.getElementById('viewHistoryBtn').addEventListener('click', async () => {
    await showFieldHistory(category, fieldName);
  });
  
  document.getElementById('saveEdit').onclick = async () => {
    const newValue = document.getElementById('editValue').value.trim();
    
    // Validation
    const validation = validateField(fieldName, newValue);
    if (!validation.valid) {
      showStatus(validation.message, 'error');
      return;
    }

    if (!formData[category]) formData[category] = {};
    
    // Track field history before updating
    await trackFieldHistory(category, fieldName, formData[category][fieldName]);
    
    formData[category][fieldName] = newValue;
    await saveCurrentProfile();
    await chrome.storage.local.set({ formData });
    notifyContentScripts();
    renderLearnedFields();
    document.body.removeChild(modal);
    showStatus('Field updated', 'success');
  };
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function validateField(name, value) {
  const n = name.toLowerCase();
  
  if (n.includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { valid: false, message: 'Invalid email format' };
  }
  
  if (n.includes('phone') && value.length > 0 && !/^[\d\s\+\-\(\)]{7,}$/.test(value)) {
    return { valid: false, message: 'Invalid phone format (min 7 digits/symbols)' };
  }

  if ((n.includes('website') || n.includes('url') || n.includes('linkedin') || n.includes('github')) && 
      value.length > 0 && !value.includes('.') && !value.startsWith('http')) {
    return { valid: false, message: 'Invalid URL/Link format' };
  }

  return { valid: true };
}

// Delete field
async function deleteField(category, fieldName) {
  if (lockedProfiles.includes(currentProfile)) {
    showStatus('Profile is locked.', 'error');
    return;
  }
  if (!confirm(`Delete "${formatFieldName(fieldName)}"?`)) return;
  
  delete formData[category][fieldName];
  if (Object.keys(formData[category]).length === 0) delete formData[category];
  
  await saveCurrentProfile();
  await chrome.storage.local.set({ formData });
  notifyContentScripts();
  renderLearnedFields(document.getElementById('searchFields').value);
  updateFieldCount();
  showStatus('Field deleted', 'success');
}

// Save settings
async function saveSettings() {
  const guestModeEnabled = document.getElementById('guestModeEnabled').checked;
  settings = {
    autoFillEnabled: document.getElementById('autoFillEnabled').checked,
    guestMode: guestModeEnabled,
    showConfirmation: document.getElementById('showConfirmation').checked,
    learnFromForms: document.getElementById('learnFromForms').checked,
    showMagicIcon: document.getElementById('showMagicIcon').checked,
    showHUD: document.getElementById('showHUD').checked,
    magicIconBehavior: document.getElementById('magicIconBehavior').value,
    geminiApiKey: document.getElementById('geminiApiKey').value.trim(),
    theme: settings.theme || 'dark'
  };
  
  updateGuestModeUI();
  
  await chrome.storage.local.set({ settings, guestMode: guestModeEnabled });
  notifyContentScripts();
  showStatus('Settings saved', 'success');
}

// Test Gemini API Key
async function testGeminiApiKey() {
  const apiKey = document.getElementById('geminiApiKey').value.trim();
  const statusEl = document.getElementById('apiKeyStatus');
  const testBtn = document.getElementById('testApiKey');
  
  if (!apiKey) {
    statusEl.textContent = '❌ Key required';
    statusEl.className = 'api-status error';
    return;
  }
  
  statusEl.textContent = '⏳ Testing...';
  statusEl.className = 'api-status loading';
  testBtn.disabled = true;
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "Connection successful"' }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 20 }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.error?.message || 'Connection failed';
      throw new Error(errorMsg);
    }
    
    statusEl.textContent = '✅ Success!';
    statusEl.className = 'api-status success';
  } catch (error) {
    console.error('API Test Error:', error);
    statusEl.textContent = `❌ ${error.message}`;
    statusEl.className = 'api-status error';
  } finally {
    testBtn.disabled = false;
  }
}

// Export data
function exportData() {
  const data = { profiles, settings, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `form-filler-backup-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showStatus('Data exported!', 'success');
}

// Field History Management
async function trackFieldHistory(category, fieldName, oldValue) {
  if (!oldValue) return; // Don't track initial empty values
  
  const { fieldHistory = {} } = await chrome.storage.local.get(['fieldHistory']);
  const key = `${category}.${fieldName}`;
  
  if (!fieldHistory[key]) {
    fieldHistory[key] = [];
  }
  
  // Add the old value with timestamp
  fieldHistory[key].unshift({
    value: oldValue,
    timestamp: new Date().toISOString(),
    profile: currentProfile
  });
  
  // Keep only last 5 versions
  if (fieldHistory[key].length > 5) {
    fieldHistory[key] = fieldHistory[key].slice(0, 5);
  }
  
  await chrome.storage.local.set({ fieldHistory });
}

async function showFieldHistory(category, fieldName) {
  const { fieldHistory = {} } = await chrome.storage.local.get(['fieldHistory']);
  const key = `${category}.${fieldName}`;
  const history = fieldHistory[key] || [];
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  let historyHTML = '';
  if (history.length === 0) {
    historyHTML = '<p style="color: #64748b; text-align: center; padding: 20px;">No history available</p>';
  } else {
    historyHTML = history.map((entry, index) => `
      <div class="history-item" style="padding: 12px; margin: 8px 0; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #e2e8f0; word-break: break-word;">${escapeHtml(entry.value)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              ${new Date(entry.timestamp).toLocaleString()} • ${entry.profile}
            </div>
          </div>
          <button class="btn btn-sm btn-secondary" data-value="${escapeHtml(entry.value)}" style="padding: 4px 8px; font-size: 11px; flex-shrink: 0;">Restore</button>
        </div>
      </div>
    `).join('');
  }
  
  modal.innerHTML = `
    <div class="modal" style="max-width: 500px;">
      <h3>📜 History: ${formatFieldName(fieldName)}</h3>
      <div style="max-height: 400px; overflow-y: auto; margin: 16px 0;">
        ${historyHTML}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="closeHistoryModal">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('closeHistoryModal').addEventListener('click', () => modal.remove());
  
  // Restore handlers
  modal.querySelectorAll('[data-value]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const valueToRestore = btn.dataset.value;
      
      // Update formData
      if (!formData[category]) formData[category] = {};
      formData[category][fieldName] = valueToRestore;
      
      await saveCurrentProfile();
      await chrome.storage.local.set({ formData });
      notifyContentScripts();
      renderLearnedFields();
      
      modal.remove();
      // Close the edit modal if it's still open
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      
      showStatus(`Restored previous value for ${formatFieldName(fieldName)}`, 'success');
    });
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Update Guest Mode UI
function updateGuestModeUI() {
  const banner = document.getElementById('guestModeBanner');
  const autoFillToggle = document.getElementById('autoFillEnabled');
  const learnToggle = document.getElementById('learnFromForms');
  
  if (settings.guestMode) {
    banner.classList.remove('hidden');
    autoFillToggle.disabled = true;
    learnToggle.disabled = true;
    autoFillToggle.parentElement.classList.add('opacity-50');
    autoFillToggle.parentElement.classList.remove('opacity-100');
    learnToggle.parentElement.classList.add('opacity-50');
    learnToggle.parentElement.classList.remove('opacity-100');
  } else {
    banner.classList.add('hidden');
    autoFillToggle.disabled = false;
    learnToggle.disabled = false;
    autoFillToggle.parentElement.classList.remove('opacity-50');
    autoFillToggle.parentElement.classList.add('opacity-100');
    learnToggle.parentElement.classList.remove('opacity-50');
    learnToggle.parentElement.classList.add('opacity-100');
  }
}

// Smart Import Handlers
async function handleExtractFile(file) {
  if (!settings?.geminiApiKey) {
    showStatus('Please set Gemini API Key in settings', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const base64Data = reader.result.split(',')[1];
    document.getElementById('extractionProgress').classList.remove('hidden');
    document.getElementById('reviewContainer').classList.add('hidden');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'extractFromDocument',
        fileData: base64Data,
        mimeType: file.type,
        apiKey: settings.geminiApiKey
      });

      if (response.success && response.result) {
        showExtractedDataReview(response.result);
      } else {
        showStatus('Extraction failed. Try a different file.', 'error');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      showStatus('Error during extraction', 'error');
    } finally {
      document.getElementById('extractionProgress').classList.add('hidden');
    }
  };
  reader.readAsDataURL(file);
}

async function handleExtractUrl() {
  const urlInput = document.getElementById('linkedinUrl');
  const url = urlInput.value.trim();
  
  if (!url) {
    showStatus('Please enter a LinkedIn URL', 'error');
    return;
  }

  if (!settings?.geminiApiKey) {
    showStatus('Please set Gemini API Key in settings', 'error');
    return;
  }

  document.getElementById('extractionProgress').classList.remove('hidden');
  document.getElementById('reviewContainer').classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'extractFromUrl',
      url: url,
      apiKey: settings.geminiApiKey
    });

    if (response.success && response.result) {
      showExtractedDataReview(response.result);
    } else {
      showStatus('URL extraction failed', 'error');
    }
  } catch (error) {
    console.error('URL extraction error:', error);
    showStatus('Error during URL extraction', 'error');
  } finally {
    document.getElementById('extractionProgress').classList.add('hidden');
  }
}

let tempExtractedData = null;

function showExtractedDataReview(data) {
  tempExtractedData = data;
  const list = document.getElementById('extractedDataList');
  list.innerHTML = '';
  
  let count = 0;
  
  const renderValue = (val) => {
    if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        return val.map(v => renderValue(v)).join(', ');
      }
      return Object.entries(val)
        .map(([k, v]) => `${capitalize(k)}: ${v}`)
        .join(' | ');
    }
    return escapeHtml(String(val));
  };

  for (const [category, fields] of Object.entries(data)) {
    for (const [key, value] of Object.entries(fields)) {
      if (!value) continue;
      
      const item = document.createElement('div');
      item.className = 'extracted-item';
      
      // Special handling for array/object displays to be more readable
      let displayValue = renderValue(value);
      
      item.innerHTML = `
        <span class="extracted-label">${capitalize(category)}: ${formatFieldName(key)}</span>
        <span class="extracted-value">${displayValue}</span>
      `;
      list.appendChild(item);
      count++;
    }
  }

  if (count > 0) {
    document.getElementById('reviewContainer').classList.remove('hidden');
  } else {
    showStatus('No data could be extracted.', 'error');
  }
}


async function saveExtractedData() {
  if (!tempExtractedData) return;
  
  if (lockedProfiles.includes(currentProfile)) {
    showStatus('Current profile is locked. Switch profile or unlock to save.', 'error');
    return;
  }

  const flattenObject = (obj, prefix = '') => {
    let result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        Object.assign(result, flattenObject(value, prefix ? `${prefix}_${key}` : key));
      } else {
        result[prefix ? `${prefix}_${key}` : key] = value;
      }
    }
    return result;
  };

  // Merge with existing data in the current profile
  for (const [category, fields] of Object.entries(tempExtractedData)) {
    if (!formData[category]) formData[category] = {};
    
    // Flatten nested objects (like education arrays)
    const flattened = flattenObject(fields);
    
    for (const [key, value] of Object.entries(flattened)) {
      if (value) {
        formData[category][key] = String(value);
      }
    }
  }

  await saveStoredData();
  renderLearnedFields();
  document.getElementById('reviewContainer').classList.add('hidden');
  document.getElementById('linkedinUrl').value = '';
  showStatus('Data imported successfully!', 'success');
  
  // Switch to Learned tab to show results
  switchTab('learned');
}


// Site Control Logic
async function initializeSiteControl() {
  const domainEl = document.getElementById('currentDomain');
  const siteToggle = document.getElementById('siteEnabled');
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs || !tabs[0] || !tabs[0].url) {
      domainEl.textContent = 'No page';
      siteToggle.disabled = true;
      return;
    }
    
    const tabUrl = tabs[0].url;
    
    // Handle special URLs
    if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://')) {
      domainEl.textContent = 'Browser page';
      siteToggle.disabled = true;
      return;
    }
    
    if (tabUrl.startsWith('file://')) {
      domainEl.textContent = 'Local file';
      currentDomain = 'file://';
      siteToggle.disabled = false;
    } else {
      const url = new URL(tabUrl);
      currentDomain = url.hostname || 'Unknown';
      domainEl.textContent = currentDomain.length > 25 ? currentDomain.substring(0, 22) + '...' : currentDomain;
      siteToggle.disabled = false;
    }
    
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    const isEnabled = !disabledDomains.includes(currentDomain);
    siteToggle.checked = isEnabled;
    
  } catch (error) {
    console.error('Error initializing site control:', error);
    domainEl.textContent = 'Error';
    siteToggle.disabled = true;
  }
}

async function toggleSiteEnabled() {
  const isEnabled = document.getElementById('siteEnabled').checked;
  const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
  
  let newDisabled = [...disabledDomains];
  if (isEnabled) {
    newDisabled = newDisabled.filter(d => d !== currentDomain);
  } else {
    if (!newDisabled.includes(currentDomain)) {
      newDisabled.push(currentDomain);
    }
  }
  
  await chrome.storage.local.set({ disabledDomains: newDisabled });
  notifyContentScripts();
  showStatus(isEnabled ? 'Extension enabled for this site' : 'Extension disabled for this site', 'success');
}

// Share current profile
async function shareProfile() {
  const profileData = {
    type: 'sff_profile_share',
    name: currentProfile,
    data: formData,
    timestamp: new Date().toISOString()
  };
  
  const shareCode = btoa(JSON.stringify(profileData));
  try {
    await navigator.clipboard.writeText(shareCode);
    showStatus('Profile share code copied to clipboard!', 'success');
  } catch (err) {
    console.error('Failed to copy:', err);
    showStatus('Failed to copy share code', 'error');
  }
}

// Import data
async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) {
    // Check if it's a share code from prompt
    const shareCode = prompt('Paste a shared profile code:');
    if (shareCode) {
      processShareCode(shareCode);
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.profiles) {
        profiles = { ...profiles, ...data.profiles };
        await chrome.storage.local.set({ profiles });
        renderProfileOptions();
        showStatus('Data imported successfully!', 'success');
      } else {
        showStatus('Invalid data format', 'error');
      }
    } catch (error) {
      showStatus('Error importing data', 'error');
    }
  };
  reader.readAsText(file);
}

async function processShareCode(code) {
  try {
    const decoded = JSON.parse(atob(code));
    if (decoded.type === 'sff_profile_share' && decoded.data) {
      const newName = `${decoded.name}_shared_${Date.now().toString().slice(-4)}`;
      profiles[newName] = decoded.data;
      await chrome.storage.local.set({ profiles });
      renderProfileOptions();
      showStatus(`Imported shared profile as "${newName}"`, 'success');
    } else {
      showStatus('Invalid share code', 'error');
    }
  } catch (e) {
    showStatus('Invalid share code format', 'error');
  }
}

// Clear all data
async function clearAllData() {
  if (!confirm('Are you sure? This will delete ALL saved form data for this profile.')) return;
  
  formData = {};
  profiles[currentProfile] = {};
  await chrome.storage.local.set({ formData, profiles });
  syncToCloud();
  notifyContentScripts();
  renderLearnedFields();
  updateFieldCount();
  showStatus('All data cleared', 'success');
}

// Notify content scripts
function notifyContentScripts() {
  chrome.runtime.sendMessage({ 
    action: 'dataUpdated', 
    formData, 
    settings,
    currentProfile,
    lockedProfiles
  });
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
  status.classList.remove('status-success', 'status-error');
  status.classList.add(type === 'success' ? 'status-success' : 'status-error');
  setTimeout(() => { status.textContent = ''; }, 2000);
}

// Export Data
async function exportData() {
  try {
    const data = await chrome.storage.local.get(null); // Get everything
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-form-filler-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('Backup downloaded!', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showStatus('Export failed', 'error');
  }
}

// Trigger Import
function triggerImport() {
  document.getElementById('importFileInput').click();
}

// Handle Import File
async function handleImportData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      
      // Basic validation
      if (!data.profiles && !data.formData) {
        throw new Error('Invalid backup file');
      }
      
      // confirm
      if (!confirm('This will overwrite your current settings and profiles. Continue?')) {
        return;
      }
      
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
      
      showStatus('Data restored successfully!', 'success');
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (error) {
      console.error('Import failed:', error);
      showStatus('Invalid backup file', 'error');
    }
  };
  reader.readAsText(file);
}

// Auto Capture Job Description
async function autoCaptureJD() {
  const btn = document.getElementById('autoCaptureJDBtn');
  btn.disabled = true;
  btn.textContent = 'Scanning...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageText' });
    if (response && response.text) {
      document.getElementById('jobDescription').value = response.text.substring(0, 3000); // Truncate
      showStatus('Captured page text', 'success');
    } else {
      showStatus('Could not capture text', 'error');
    }
  } catch (error) {
    console.error('Capture error:', error);
    showStatus('Error capturing text. Try manually.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📄 Capture from Page';
  }
}

// Generate Cover Letter
async function generateCoverLetter() {
  const jd = document.getElementById('jobDescription').value.trim();
  const tone = document.getElementById('coverLetterTone').value;
  const btn = document.getElementById('generateCoverLetterBtn');
  const resultArea = document.getElementById('coverLetterResult');
  const resultText = document.getElementById('generatedCoverLetter');
  const apiKey = settings.geminiApiKey;
  
  if (!apiKey) {
    showStatus('Gemini API key required (Settings)', 'error');
    switchTab('settings');
    return;
  }
  
  if (!jd) {
    showStatus('Please enter a Job Description', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.textContent = '✨ Generating...';
  resultArea.classList.add('hidden');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateCoverLetter',
      jobDescription: jd,
      profileData: formData,
      tone,
      apiKey
    });
    
    if (response?.success && response.result) {
      resultText.value = response.result;
      resultArea.classList.remove('hidden');
      resultArea.scrollIntoView({ behavior: 'smooth' });
    } else {
      showStatus('Generation failed', 'error');
    }
  } catch (error) {
    console.error('Generation error:', error);
    showStatus('Error generating letter', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Generate Cover Letter';
  }
}

// Copy Cover Letter
function copyCoverLetter() {
  const text = document.getElementById('generatedCoverLetter');
  text.select();
  document.execCommand('copy');
  showStatus('Copied to clipboard!', 'success');
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
