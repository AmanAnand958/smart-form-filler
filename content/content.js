// Smart Form Filler - Robust Content Script
// Handles Shadow DOM, iframes, lazy-loaded forms, Gemini AI fallback, and site-specific patterns

(function() {
  'use strict';

  let storedData = null;
  let settings = null;
  let confirmationPopup = null;
  let detectedFields = [];
  let hasScannedPage = false;
  let scanRetryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1500;

  // Extended field patterns for better matching
  const FIELD_PATTERNS = {
    // Personal
    firstName: [/first.?name/i, /fname/i, /given.?name/i, /forename/i, /prenom/i],
    lastName: [/last.?name/i, /lname/i, /surname/i, /family.?name/i, /sname/i],
    fullName: [/full.?name/i, /^name$/i, /your.?name/i, /display.?name/i, /complete.?name/i],
    middleName: [/middle.?name/i, /mname/i],
    dob: [/birth/i, /dob/i, /date.?of.?birth/i, /birthday/i, /born/i],
    gender: [/gender/i, /sex/i],
    nationality: [/nationality/i, /citizenship/i],
    
    // Contact
    email: [/e.?mail/i, /email.?address/i, /correo/i, /courriel/i],
    phone: [/phone/i, /mobile/i, /tel/i, /contact.?number/i, /cell/i, /telefono/i, /numero/i],
    alternateEmail: [/alternate.?email/i, /secondary.?email/i, /other.?email/i, /backup.?email/i],
    alternatePhone: [/alternate.?phone/i, /secondary.?phone/i, /work.?phone/i, /home.?phone/i],
    
    // Address
    street: [/street/i, /address.?1/i, /address.?line/i, /^address$/i, /direccion/i, /adresse/i],
    apartment: [/apartment/i, /apt/i, /unit/i, /suite/i, /address.?2/i, /flat/i, /floor/i],
    city: [/city/i, /town/i, /locality/i, /ciudad/i, /ville/i, /ort/i],
    state: [/state/i, /province/i, /region/i, /estado/i, /provincia/i],
    zip: [/zip/i, /postal/i, /post.?code/i, /pin.?code/i, /code.?postal/i, /plz/i],
    country: [/country/i, /nation/i, /pais/i, /pays/i, /land/i],
    
    // Professional
    company: [/company/i, /organization/i, /employer/i, /current.?company/i, /org/i, /firma/i, /entreprise/i],
    jobTitle: [/job.?title/i, /position/i, /role/i, /designation/i, /^title$/i, /puesto/i, /poste/i],
    department: [/department/i, /dept/i, /team/i, /division/i],
    linkedin: [/linkedin/i, /linked.?in/i],
    website: [/website/i, /portfolio/i, /personal.?site/i, /homepage/i, /blog/i],
    github: [/github/i],
    twitter: [/twitter/i, /x\.com/i],
    
    // Education - comprehensive patterns
    university: [/university/i, /college/i, /school/i, /institution/i, /alma.?mater/i, /universidad/i, /universite/i],
    degree: [/degree/i, /qualification/i, /diploma/i, /certificate/i, /titulo/i, /diplome/i],
    major: [/major/i, /field.?of.?study/i, /specialization/i, /concentration/i, /subject/i, /discipline/i],
    minor: [/minor/i],
    gpa: [/gpa/i, /cgpa/i, /grade/i, /score/i, /average/i, /marks/i, /percentage/i],
    graduationYear: [/graduation/i, /grad.?year/i, /year.?of.?completion/i, /completion.?year/i, /passing.?year/i],
    graduationDate: [/graduation.?date/i, /completion.?date/i],
    startYear: [/start.?year/i, /from.?year/i, /admission/i, /joining/i, /enrolled/i],
    endYear: [/end.?year/i, /to.?year/i],
    educationLevel: [/education.?level/i, /highest.?qualification/i, /level/i],
    
    // Work Experience
    experience: [/experience/i, /years?.?of/i, /work.?history/i],
    currentEmployer: [/current.?employer/i, /present.?company/i],
    previousEmployer: [/previous.?employer/i, /former.?company/i, /past.?employer/i],
    startDate: [/start.?date/i, /from.?date/i, /date.?from/i, /join.?date/i],
    endDate: [/end.?date/i, /to.?date/i, /date.?to/i, /leaving.?date/i],
    salary: [/salary/i, /compensation/i, /pay/i, /ctc/i, /expected.?salary/i, /current.?salary/i],
    noticePeriod: [/notice.?period/i, /notice/i],
    
    // Skills and others
    skills: [/skill/i, /expertise/i, /competenc/i, /technolog/i],
    languages: [/language/i, /idioma/i, /langue/i, /sprache/i],
    bio: [/bio/i, /about/i, /summary/i, /description/i, /profile/i, /objective/i],
    hobbies: [/hobb/i, /interest/i, /pastime/i],
    references: [/reference/i, /referral/i],
    
    // Identity documents
    passport: [/passport/i],
    drivingLicense: [/driving.?license/i, /driver.?license/i, /dl.?number/i],
    nationalId: [/national.?id/i, /id.?number/i, /aadhaar/i, /pan/i, /voter/i],
    
    // Social
    facebook: [/facebook/i, /fb/i],
    instagram: [/instagram/i, /insta/i],
    
    // File uploads (for reference, not filling)
    resume: [/resume/i, /cv/i, /curriculum/i],
    coverLetter: [/cover.?letter/i],
    photo: [/photo/i, /picture/i, /avatar/i, /image/i]
  };

  // Category mapping
  const CATEGORY_MAP = {
    firstName: 'personal', lastName: 'personal', fullName: 'personal', middleName: 'personal',
    dob: 'personal', gender: 'personal', nationality: 'personal',
    email: 'contact', phone: 'contact', alternateEmail: 'contact', alternatePhone: 'contact',
    street: 'address', apartment: 'address', city: 'address', state: 'address', 
    zip: 'address', country: 'address',
    company: 'professional', jobTitle: 'professional', department: 'professional',
    linkedin: 'professional', website: 'professional', github: 'professional', twitter: 'professional',
    university: 'education', degree: 'education', major: 'education', minor: 'education',
    gpa: 'education', graduationYear: 'education', graduationDate: 'education',
    startYear: 'education', endYear: 'education', educationLevel: 'education',
    experience: 'professional', currentEmployer: 'professional', previousEmployer: 'professional',
    startDate: 'professional', endDate: 'professional', salary: 'professional', noticePeriod: 'professional',
    skills: 'other', languages: 'other', bio: 'other', hobbies: 'other', references: 'other',
    passport: 'personal', drivingLicense: 'personal', nationalId: 'personal',
    facebook: 'other', instagram: 'other'
  };

  // Site-specific configurations
  const SITE_CONFIGS = {
    'linkedin.com': {
      formSelectors: ['form', '.jobs-easy-apply-modal', '.artdeco-modal'],
      inputSelectors: ['input', 'select', 'textarea', '[contenteditable="true"]'],
      waitTime: 1000,
      specialHandlers: {
        'first-name': 'firstName',
        'last-name': 'lastName',
        'email-address': 'email',
        'phone-number': 'phone',
        'headline': 'jobTitle',
        'current-company': 'company'
      }
    },
    'indeed.com': {
      formSelectors: ['form', '.ia-container', '[data-testid="application-form"]'],
      inputSelectors: ['input', 'select', 'textarea'],
      waitTime: 800,
      specialHandlers: {
        'input-firstName': 'firstName',
        'input-lastName': 'lastName',
        'input-email': 'email',
        'input-phoneNumber': 'phone'
      }
    },
    'glassdoor.com': {
      formSelectors: ['form', '.application-form'],
      inputSelectors: ['input', 'select', 'textarea'],
      waitTime: 1000
    },
    'workday.com': {
      formSelectors: ['form', '[data-automation-id="applicationForm"]'],
      inputSelectors: ['input', 'select', 'textarea', '[data-automation-id]'],
      waitTime: 1500
    },
    'greenhouse.io': {
      formSelectors: ['#application', 'form'],
      inputSelectors: ['input', 'select', 'textarea'],
      waitTime: 500
    },
    'lever.co': {
      formSelectors: ['.application-form', 'form'],
      inputSelectors: ['input', 'select', 'textarea'],
      waitTime: 500
    }
  };

  // Blacklisted fields
  const BLACKLIST = [
    /password/i, /passwd/i, /pwd/i,
    /credit.?card/i, /card.?number/i, /cvv/i, /cvc/i, /expir/i,
    /ssn/i, /social.?security/i,
    /captcha/i, /recaptcha/i,
    /security.?code/i, /security.?question/i, /security.?answer/i,
    /otp/i, /verification/i, /verify/i, /code/i,
    /token/i, /csrf/i, /nonce/i,
    /hidden/i, /consent/i, /gdpr/i, /terms/i, /agree/i
  ];

  // Initialize
  async function init() {
    await loadStoredData();
    
    if (settings?.autoFillEnabled) {
      // Initial scan with retry
      scheduleFormScan();
      
      // Observe DOM changes
      observeDOMChanges();
      
      // Page visibility change (for SPAs)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          setTimeout(() => detectForms(), 500);
        }
      });
      
      // URL change detection (for SPAs like LinkedIn)
      observeURLChanges();
    }
    
    if (settings?.learnFromForms) {
      observeFormSubmissions();
    }
    
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  // Schedule form scan with retries
  function scheduleFormScan() {
    const scan = () => {
      detectForms();
      
      // Retry if no fields found and haven't exceeded retries
      if (detectedFields.length === 0 && scanRetryCount < MAX_RETRIES) {
        scanRetryCount++;
        setTimeout(scan, RETRY_DELAY);
      }
    };
    
    if (document.readyState === 'complete') {
      setTimeout(scan, 300);
    } else {
      window.addEventListener('load', () => setTimeout(scan, 500));
    }
  }

  // Observe URL changes for SPAs
  function observeURLChanges() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        hasScannedPage = false;
        scanRetryCount = 0;
        setTimeout(() => detectForms(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Load data from storage
  async function loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['formData', 'settings']);
      storedData = result.formData || {};
      settings = result.settings || { autoFillEnabled: true, showConfirmation: true, learnFromForms: true };
    } catch (error) {
      console.error('Form Filler: Error loading data', error);
    }
  }

  // Handle messages
  function handleMessage(request, sender, sendResponse) {
    if (request.action === 'dataUpdated') {
      storedData = request.formData;
      settings = request.settings;
    } else if (request.action === 'triggerFill') {
      hasScannedPage = false;
      detectForms();
    }
    sendResponse({ success: true });
  }

  // Get site-specific config
  function getSiteConfig() {
    const hostname = window.location.hostname;
    for (const [site, config] of Object.entries(SITE_CONFIGS)) {
      if (hostname.includes(site)) {
        return config;
      }
    }
    return null;
  }

  // Detect forms on the page - now with Shadow DOM and iframe support
  function detectForms() {
    const siteConfig = getSiteConfig();
    const waitTime = siteConfig?.waitTime || 0;
    
    setTimeout(() => {
      detectedFields = [];
      
      // Get all inputs including Shadow DOM
      const allInputs = getAllInputs(document, siteConfig);
      
      // Process iframes (same-origin only)
      processIframes(siteConfig);
      
      // Process all found inputs
      processInputs(allInputs, siteConfig);
      
      // Show popup if fields found
      if (detectedFields.length > 0 && hasMatchingData()) {
        if (settings?.showConfirmation) {
          showConfirmationPopup();
        } else {
          fillFields();
        }
      }
    }, waitTime);
  }

  // Get all inputs including from Shadow DOM
  function getAllInputs(root, siteConfig) {
    const selectors = siteConfig?.inputSelectors?.join(', ') || 'input, select, textarea';
    let inputs = Array.from(root.querySelectorAll(selectors));
    
    // Traverse Shadow DOM
    const shadowHosts = root.querySelectorAll('*');
    shadowHosts.forEach(host => {
      if (host.shadowRoot) {
        const shadowInputs = getAllInputs(host.shadowRoot, siteConfig);
        inputs = inputs.concat(shadowInputs);
      }
    });
    
    return inputs;
  }

  // Process same-origin iframes
  function processIframes(siteConfig) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const inputs = getAllInputs(iframeDoc, siteConfig);
          processInputs(inputs, siteConfig);
        }
      } catch (e) {
        // Cross-origin iframe, skip
      }
    });
  }

  // Process inputs
  function processInputs(inputs, siteConfig) {
    inputs.forEach(input => {
      // Skip invalid types
      if (shouldSkipInput(input)) return;
      
      // Check if already filled
      if (input.value && input.value.trim()) return;
      
      // Identify field
      const match = identifyField(input, siteConfig);
      if (match) {
        detectedFields.push({
          element: input,
          fieldKey: match.key,
          category: match.category,
          label: getFieldLabel(input),
          originalIdentifier: match.identifier
        });
      }
    });
  }

  // Should skip input
  function shouldSkipInput(input) {
    const type = input.type?.toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'file', 'image', 'checkbox', 'radio'].includes(type)) {
      return true;
    }
    if (input.disabled || input.readOnly) {
      return true;
    }
    if (isBlacklisted(input)) {
      return true;
    }
    // Skip if not visible
    if (input.offsetParent === null && !input.closest('[aria-hidden="false"]')) {
      const style = window.getComputedStyle(input);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }
    }
    return false;
  }

  // Check if field is blacklisted
  function isBlacklisted(input) {
    const identifier = getFieldIdentifier(input);
    return BLACKLIST.some(pattern => pattern.test(identifier));
  }

  // Get field identifier string
  function getFieldIdentifier(input) {
    return [
      input.name || '',
      input.id || '',
      input.placeholder || '',
      input.getAttribute('aria-label') || '',
      input.getAttribute('data-automation-id') || '',
      input.getAttribute('data-testid') || '',
      input.className || '',
      getFieldLabel(input)
    ].join(' ').toLowerCase();
  }

  // Get label for an input field
  function getFieldLabel(input) {
    // Check for associated label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent.trim();
    }
    
    // Check aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }
    
    // Check parent label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent.replace(input.value || '', '').trim();
      if (text) return text;
    }
    
    // Check preceding elements
    let prev = input.previousElementSibling;
    for (let i = 0; i < 3 && prev; i++) {
      if (prev.tagName === 'LABEL' || prev.classList?.contains('label')) {
        return prev.textContent.trim();
      }
      prev = prev.previousElementSibling;
    }
    
    // Check parent's preceding siblings
    const parent = input.parentElement;
    if (parent) {
      const prevSibling = parent.previousElementSibling;
      if (prevSibling?.tagName === 'LABEL' || prevSibling?.classList?.contains('label')) {
        return prevSibling.textContent.trim();
      }
    }
    
    return input.placeholder || input.name || input.id || '';
  }

  // Identify field type with site-specific handling
  function identifyField(input, siteConfig) {
    const identifier = getFieldIdentifier(input);
    
    // Check site-specific handlers first
    if (siteConfig?.specialHandlers) {
      for (const [pattern, fieldKey] of Object.entries(siteConfig.specialHandlers)) {
        if (identifier.includes(pattern.toLowerCase())) {
          return { 
            key: fieldKey, 
            category: CATEGORY_MAP[fieldKey] || 'other', 
            identifier 
          };
        }
      }
    }
    
    // Check input type
    if (input.type === 'email') {
      return { key: 'email', category: 'contact', identifier };
    }
    if (input.type === 'tel') {
      return { key: 'phone', category: 'contact', identifier };
    }
    if (input.type === 'url') {
      if (/linkedin/i.test(identifier)) return { key: 'linkedin', category: 'professional', identifier };
      if (/github/i.test(identifier)) return { key: 'github', category: 'professional', identifier };
      if (/twitter|x\.com/i.test(identifier)) return { key: 'twitter', category: 'professional', identifier };
      return { key: 'website', category: 'professional', identifier };
    }
    if ((input.type === 'date' || input.type === 'text') && /birth/i.test(identifier)) {
      return { key: 'dob', category: 'personal', identifier };
    }
    
    // Pattern matching against known patterns
    for (const [key, patterns] of Object.entries(FIELD_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(identifier))) {
        return { key, category: CATEGORY_MAP[key] || 'other', identifier };
      }
    }
    
    // Dynamic matching: Check stored data for similar field names
    const normalizedIdentifier = normalizeFieldName(identifier);
    for (const [category, fields] of Object.entries(storedData)) {
      if (typeof fields !== 'object') continue;
      for (const fieldKey of Object.keys(fields)) {
        const normalizedKey = normalizeFieldName(fieldKey);
        if (normalizedIdentifier.includes(normalizedKey) || 
            normalizedKey.includes(normalizedIdentifier)) {
          return { key: fieldKey, category, identifier };
        }
      }
    }
    
    // Extract field name for learning
    const extractedName = extractFieldName(input);
    if (extractedName) {
      return { key: extractedName, category: 'other', identifier, isNew: true };
    }
    
    return null;
  }

  // Normalize field name for matching
  function normalizeFieldName(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Extract field name from input
  function extractFieldName(input) {
    const sources = [input.name, input.id, getFieldLabel(input), input.placeholder].filter(Boolean);
    
    for (const source of sources) {
      const cleaned = source.replace(/[^a-zA-Z0-9\s]/g, '').trim().toLowerCase().replace(/\s+/g, '_');
      if (cleaned && cleaned.length >= 2 && cleaned.length < 50 && !/^(field|input|text|data|form|item|el|box|txt)\d*$/i.test(cleaned)) {
        return cleaned;
      }
    }
    return null;
  }

  // Check if we have data for any detected fields
  function hasMatchingData() {
    return detectedFields.some(field => getStoredValue(field.fieldKey, field.category));
  }

  // Get stored value with fuzzy matching
  function getStoredValue(fieldKey, category) {
    // Exact match in specified category
    if (storedData[category]?.[fieldKey]) {
      return storedData[category][fieldKey];
    }
    
    // Exact match in any category
    for (const [cat, fields] of Object.entries(storedData)) {
      if (typeof fields !== 'object') continue;
      if (fields[fieldKey]) return fields[fieldKey];
    }
    
    // Fuzzy match
    const normalizedKey = normalizeFieldName(fieldKey);
    for (const [cat, fields] of Object.entries(storedData)) {
      if (typeof fields !== 'object') continue;
      for (const [key, value] of Object.entries(fields)) {
        const normalizedStoredKey = normalizeFieldName(key);
        if (normalizedStoredKey.includes(normalizedKey) || normalizedKey.includes(normalizedStoredKey)) {
          return value;
        }
      }
    }
    
    return null;
  }

  // Show confirmation popup
  function showConfirmationPopup() {
    if (confirmationPopup) {
      confirmationPopup.remove();
    }
    
    const fillableFields = detectedFields.filter(f => getStoredValue(f.fieldKey, f.category));
    if (fillableFields.length === 0) return;
    
    confirmationPopup = document.createElement('div');
    confirmationPopup.id = 'smart-form-filler-popup';
    confirmationPopup.innerHTML = `
      <div class="sff-popup-content">
        <div class="sff-popup-header">
          <div class="sff-popup-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="url(#sff-gradient)" stroke-width="2"/>
              <path d="M7 9h10M7 12h7M7 15h10" stroke="url(#sff-gradient)" stroke-width="2" stroke-linecap="round"/>
              <defs>
                <linearGradient id="sff-gradient" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#7C3AED"/>
                  <stop offset="1" stop-color="#EC4899"/>
                </linearGradient>
              </defs>
            </svg>
            <span>Smart Form Filler</span>
          </div>
          <button class="sff-close-btn" id="sff-close">&times;</button>
        </div>
        <div class="sff-popup-body">
          <p>Found <strong>${fillableFields.length}</strong> fields to fill</p>
          <ul class="sff-field-list">
            ${fillableFields.slice(0, 6).map(f => {
              const value = getStoredValue(f.fieldKey, f.category);
              return `<li><span class="sff-field-name">${formatFieldName(f.fieldKey)}</span><span class="sff-field-preview">${truncate(value, 18)}</span></li>`;
            }).join('')}
            ${fillableFields.length > 6 ? `<li class="sff-more">+${fillableFields.length - 6} more fields</li>` : ''}
          </ul>
        </div>
        <div class="sff-popup-footer">
          <button class="sff-btn sff-btn-secondary" id="sff-decline">Skip</button>
          <button class="sff-btn sff-btn-primary" id="sff-accept">Fill Form</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(confirmationPopup);
    
    document.getElementById('sff-accept').addEventListener('click', () => {
      fillFields();
      confirmationPopup.remove();
      confirmationPopup = null;
    });
    
    document.getElementById('sff-decline').addEventListener('click', () => {
      confirmationPopup.remove();
      confirmationPopup = null;
    });
    
    document.getElementById('sff-close').addEventListener('click', () => {
      confirmationPopup.remove();
      confirmationPopup = null;
    });
    
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (confirmationPopup) {
        confirmationPopup.remove();
        confirmationPopup = null;
      }
    }, 30000);
  }

  // Fill the detected fields
  function fillFields() {
    let filledCount = 0;
    detectedFields.forEach(field => {
      const value = getStoredValue(field.fieldKey, field.category);
      if (value) {
        setFieldValue(field.element, value);
        filledCount++;
      }
    });
    console.log(`Form Filler: Filled ${filledCount} fields`);
  }

  // Set field value with framework support
  function setFieldValue(element, value) {
    if (element.tagName === 'SELECT') {
      const options = Array.from(element.options);
      const match = options.find(opt => 
        opt.value.toLowerCase() === value.toLowerCase() ||
        opt.textContent.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(opt.textContent.toLowerCase())
      );
      if (match) {
        element.value = match.value;
      }
    } else if (element.contentEditable === 'true') {
      element.textContent = value;
    } else {
      // Use native setter for React compatibility
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      
      if (element.tagName === 'INPUT' && nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
      } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, value);
      } else {
        element.value = value;
      }
    }
    
    // Trigger all relevant events
    ['input', 'change', 'blur', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
    
    // Focus and blur for validation triggers
    element.focus();
    setTimeout(() => element.blur(), 50);
  }

  // Observe DOM for dynamically added forms
  function observeDOMChanges() {
    let debounceTimer;
    
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches?.('form, input, select, textarea, [role="form"]') ||
                node.querySelector?.('form, input, select, textarea')) {
              shouldCheck = true;
            }
          }
        });
      });
      
      if (shouldCheck) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          hasScannedPage = false;
          detectForms();
        }, 500);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Observe form submissions to learn data
  function observeFormSubmissions() {
    // Form submit event
    document.addEventListener('submit', (e) => learnFromForm(e.target), true);
    
    // Button clicks
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button[type="submit"], input[type="submit"], button:not([type]), [role="button"]');
      if (button) {
        const form = button.closest('form') || findNearestForm(button);
        if (form) {
          setTimeout(() => learnFromForm(form), 100);
        }
      }
    }, true);
    
    // Keyboard submit (Enter key)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input:not([type="textarea"])')) {
        const form = e.target.closest('form');
        if (form) {
          setTimeout(() => learnFromForm(form), 100);
        }
      }
    }, true);
  }

  // Find nearest form-like container
  function findNearestForm(element) {
    let parent = element.parentElement;
    for (let i = 0; i < 10 && parent; i++) {
      if (parent.querySelectorAll('input, select, textarea').length >= 2) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  // Learn from filled form
  async function learnFromForm(form) {
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, select, textarea');
    const newData = {};
    let learnedCount = 0;
    
    inputs.forEach(input => {
      if (shouldSkipInput(input) || input.type === 'password' || !input.value?.trim()) return;
      
      const match = identifyField(input, getSiteConfig());
      if (!match) return;
      
      const { key, category } = match;
      const value = input.value.trim();
      
      // Skip if same value already exists
      if (storedData[category]?.[key] === value) return;
      
      if (!newData[category]) newData[category] = {};
      newData[category][key] = value;
      learnedCount++;
    });
    
    if (Object.keys(newData).length > 0) {
      const updatedData = { ...storedData };
      for (const [category, fields] of Object.entries(newData)) {
        updatedData[category] = { ...updatedData[category], ...fields };
      }
      
      try {
        await chrome.storage.local.set({ formData: updatedData });
        storedData = updatedData;
        console.log(`Form Filler: Learned ${learnedCount} fields`, newData);
      } catch (error) {
        console.error('Form Filler: Error saving', error);
      }
    }
  }

  // Utilities
  function formatFieldName(name) {
    return name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
  }

  // Start
  init();
})();
