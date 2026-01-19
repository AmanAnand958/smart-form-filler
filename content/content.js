// Smart Form Filler - Robust Content Script
// Handles Shadow DOM, iframes, lazy-loaded forms, Gemini AI fallback, and site-specific patterns

(function() {
  'use strict';
  
  // Domains to avoid being distracting (video, entertainment, reels)
  const DISTRACTION_FREE_DOMAINS = [
    'youtube.com', 'netflix.com', 'tiktok.com', 'instagram.com', 
    'twitch.tv', 'hulu.com', 'disneyplus.com', 'hbomax.com', 'primevideo.com'
  ];

  function isRestrictedDomain() {
    const hostname = window.location.hostname.toLowerCase();
    const href = window.location.href.toLowerCase();
    return DISTRACTION_FREE_DOMAINS.some(d => hostname.includes(d) || href.includes(d));
  }

  // CRITICAL: Exit immediately if on a blacklisted domain before any other logic runs
  if (isRestrictedDomain()) return;

  console.log('Smart Form Filler Content Script v2.2 Loaded');

  let storedData = null;
  let settings = null;
  let confirmationPopup = null;
  let detectedFields = [];
  let hasScannedPage = false;
  let scanRetryCount = 0;
  let currentProfile = 'personal';
  let lockedProfiles = [];
  let siteSpecificPatterns = {};
  let lastRightClickedElement = null;
  const isInternalFrame = window.self !== window.top;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1500;
  const autoFilledValues = new Map();
  let formIntersectionObserver = null;
  let activeToasts = [];
  let retryContext = {}; // Store retry information for toast actions

  // Smart Profile Switching: URL patterns → Profile mapping
  const PROFILE_URL_PATTERNS = {
    work: ['linkedin.com', 'glassdoor.com', 'indeed.com', 'monster.com'],
    job_apps: ['workday.com', 'greenhouse.io', 'lever.co', 'myworkday.com', 'taleo.net'],
    personal: [] // Default fallback
  };

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
  
  // Already handled at top of script

  // Initialize
  async function init() {
    await loadStoredData();
    
    // Smart profile switching
    await detectAndSwitchProfile();
    
    // Keyboard Shortcut (Alt+Shift+F)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyF') {
        console.log('Form Filler: Shortcut triggered');
        detectForms(true);
      }
    });
    
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

    // Track right-clicked element for context menu mapping
    document.addEventListener('contextmenu', (e) => {
      lastRightClickedElement = e.target;
    }, true);

    // Initial HUD Injection
    injectHUD();
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
      const result = await chrome.storage.local.get(['formData', 'settings', 'lockedProfiles', 'currentProfile', 'siteSpecificPatterns']);
      storedData = result.formData || {};
      settings = result.settings || { autoFillEnabled: true, showConfirmation: true, learnFromForms: true };
      
      lockedProfiles = result.lockedProfiles || [];
      currentProfile = result.currentProfile || 'personal';
      siteSpecificPatterns = result.siteSpecificPatterns || {};
    } catch (error) {
      console.error('Form Filler: Error loading data', error);
    }
  }

  // Handle messages from background
  async function handleMessage(message, sender, sendResponse) {
    if (message.action === 'dataUpdated') {
      storedData = message.formData;
      settings = message.settings;
      if (message.lockedProfiles) lockedProfiles = message.lockedProfiles;
      if (message.currentProfile) currentProfile = message.currentProfile;
      if (message.siteSpecificPatterns) siteSpecificPatterns = message.siteSpecificPatterns;
      console.log('Form Filler: Data updated from background');
      updateHUDInfo();
      if (!settings.guestMode) {
        detectForms();
      }
    } else if (message.action === 'profileUpdated') {
      currentProfile = message.profile;
      updateHUDInfo();
      detectForms(); // Re-scan with new profile
    } else if (message.action === 'triggerFilling') {
      console.log('Form Filler: Manual trigger received');
      detectForms(true);
    } else if (message.action === 'mapField') {
      handleManualMapping(message.fieldName);
    } else if (message.action === 'getPageText') {
      sendResponse({ text: document.body.innerText.substring(0, 5000) });
    } else if (message.action === 'showToast') {
      // Store retry context if provided
      if (message.retryContext) {
        retryContext[message.retryContext.id] = message.retryContext;
      }
      showToast(message.message, message.type, message.options || {});
    }
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
  async function detectForms(force = false) {
    // Early exit for restricted domains unless forced (e.g. via keyboard shortcut)
    if (isRestrictedDomain() && !force) {
      removeHUD();
      removeMagicFillIcons();
      return;
    }

    // Check if domain is disabled via user settings
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    if (disabledDomains.includes(window.location.hostname) && !force) {
      console.log('Form Filler: Domain is disabled, skipping detection');
      removeHUD();
      removeMagicFillIcons();
      return;
    }

    // Guard against re-triggering if popup is already visible
    if (confirmationPopup && !force) {
      return;
    }

    if (settings?.guestMode && !force) {
      console.log('Form Filler: Guest Mode is on, skipping auto-detection');
      return;
    }
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
      if (detectedFields.length > 0) {
        injectMagicFillIcons();
        
        const shouldShowHUD = settings?.showHUD !== false;
        const isBlacklistedDomain = DISTRACTION_FREE_DOMAINS.some(d => window.location.hostname.includes(d) || window.location.href.includes(d));

        if (shouldShowHUD && !isBlacklistedDomain) {
          injectHUD();
        } else {
          removeHUD();
        }
        
        if (hasMatchingData()) {
          // Sensitive Field Protection: Force confirmation if SSN or Passport detected
          const securitySensitive = detectedFields.some(f => 
            /ssn|passport|national_id|id_number/.test(f.fieldKey)
          );

          if (!isBlacklistedDomain) {
            if (settings?.showConfirmation || securitySensitive) {
              if (securitySensitive) console.log('Form Filler: Sensitive fields detected, forcing confirmation popup for security.');
              showConfirmationPopup();
            } else {
              fillFields();
            }
          }
        }
      } else {
        removeHUD();
        removeMagicFillIcons();
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
    const hostname = window.location.hostname;
    
    // Check manual mappings (Adaptive Learning) first
    if (siteSpecificPatterns[hostname]) {
      const fieldId = input.id?.toLowerCase() || input.name?.toLowerCase() || input.placeholder?.toLowerCase();
      if (fieldId && siteSpecificPatterns[hostname][fieldId]) {
        const fieldKey = siteSpecificPatterns[hostname][fieldId];
        return { 
          key: fieldKey, 
          category: CATEGORY_MAP[fieldKey] || 'other', 
          identifier,
          isManualMatch: true 
        };
      }
    }

    // Check site-specific handlers
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

  // Extract field name from input - prioritize visible labels
  function extractFieldName(input) {
    // Priority 1: Visible label text (most reliable)
    const labelText = getFieldLabel(input);
    if (labelText && isValidFieldName(labelText)) {
      return cleanFieldName(labelText);
    }
    
    // Priority 2: Placeholder (user-facing)
    if (input.placeholder && isValidFieldName(input.placeholder)) {
      return cleanFieldName(input.placeholder);
    }
    
    // Priority 3: aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel && isValidFieldName(ariaLabel)) {
      return cleanFieldName(ariaLabel);
    }
    
    // Priority 4: name/id (only if not generic)
    const name = input.name || input.id;
    if (name && isValidFieldName(name) && !isGenericName(name)) {
      return cleanFieldName(name);
    }
    
    return null;
  }
  
  // Clean and normalize field name
  function cleanFieldName(str) {
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')            // Spaces to underscores
      .substring(0, 40);               // Limit length
  }
  
  // Check if field name is valid
  function isValidFieldName(str) {
    if (!str) return false;
    const cleaned = str.replace(/[^a-zA-Z]/g, '');
    return cleaned.length >= 2 && cleaned.length < 50;
  }
  
  // Check if name is generic (like field1, input7, etc.)
  function isGenericName(name) {
    const genericPatterns = [
      /^(field|input|text|data|form|item|el|box|txt|q|answer|response|entry)[\d_-]*$/i,
      /^[a-z]{1,3}\d+$/i,              // e.g., q1, a2, f7
      /^\d+$/,                          // Pure numbers
      /^(col|row|cell)[\d_-]*$/i,
      /^form[\d_-]*(field|input)?[\d_-]*$/i
    ];
    return genericPatterns.some(pattern => pattern.test(name));
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

  // Show confirmation popup with partial fill checkboxes
function showConfirmationPopup() {
  if (confirmationPopup) {
    confirmationPopup.remove();
  }
  
  // Snapshot the current fields to prevent race conditions with background scans
  const currentDetectedFields = [...detectedFields];
  const fillableFields = currentDetectedFields.filter(f => getStoredValue(f.fieldKey, f.category));
  if (fillableFields.length === 0) return;
  
  // Calculate confidence for each field
  const fieldsWithConfidence = fillableFields.map(f => ({
    ...f,
    originalIndex: currentDetectedFields.indexOf(f),
    value: getStoredValue(f.fieldKey, f.category),
    confidence: calculateConfidence(f)
  }));
  
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
        <div class="sff-select-all">
          <label><input type="checkbox" id="sff-select-all" checked> Select all (${fillableFields.length} fields)</label>
        </div>
        <ul class="sff-field-list">
          ${fieldsWithConfidence.slice(0, 8).map((f, i) => `
            <li class="sff-field-item">
              <label class="sff-field-checkbox">
                <input type="checkbox" class="sff-field-check" data-index="${f.originalIndex}" checked>
                <span class="sff-field-name">${formatFieldName(f.fieldKey)}</span>
              </label>
              <span class="sff-field-preview" title="${f.value}">${truncate(f.value, 15)}</span>
              <span class="sff-confidence sff-confidence-${f.confidence}">${f.confidence === 'high' ? '✓' : f.confidence === 'medium' ? '~' : '?'}</span>
            </li>
          `).join('')}
          ${fillableFields.length > 8 ? `<li class="sff-more">+${fillableFields.length - 8} more fields</li>` : ''}
        </ul>
      </div>
      <div class="sff-popup-footer">
        <button class="sff-btn sff-btn-secondary" id="sff-decline">Skip</button>
        <button class="sff-btn sff-btn-primary" id="sff-accept">Fill Selected</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmationPopup);
  
  // Select all checkbox
  document.getElementById('sff-select-all').addEventListener('change', (e) => {
    document.querySelectorAll('.sff-field-check').forEach(cb => cb.checked = e.target.checked);
  });
  
  // Individual checkboxes update select all
  document.querySelectorAll('.sff-field-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const all = document.querySelectorAll('.sff-field-check');
      const checked = document.querySelectorAll('.sff-field-check:checked');
      document.getElementById('sff-select-all').checked = all.length === checked.length;
    });
  });
  
  document.getElementById('sff-accept').addEventListener('click', () => {
    const selectedFields = Array.from(document.querySelectorAll('.sff-field-check:checked'))
      .map(cb => currentDetectedFields[parseInt(cb.dataset.index)]);
    fillSelectedFields(selectedFields);
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
  
  // Field Highlighting
  document.querySelectorAll('.sff-field-item').forEach(item => {
    const index = item.querySelector('.sff-field-check').dataset.index;
    const field = currentDetectedFields[index];
    
    item.addEventListener('mouseenter', () => highlightField(field.element));
    item.addEventListener('mouseleave', () => unhighlightField(field.element));
  });

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (confirmationPopup) {
      confirmationPopup.remove();
      confirmationPopup = null;
    }
  }, 30000);
}

function highlightField(element) {
  if (element) {
    element.style.outline = '3px solid #7C3AED';
    element.style.outlineOffset = '2px';
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function unhighlightField(element) {
  if (element) {
    element.style.outline = 'none';
  }
}

// Smart Suggestions
function setupSmartSuggestions() {
  document.addEventListener('focusin', (e) => {
    if (shouldSkipInput(e.target) || e.target.type === 'password') return;
    if (e.target.value) return; // Only suggest for empty fields
    
    const context = identifyField(e.target, getSiteConfig());
    if (context) {
      showSuggestions(e.target, context.key, context.category);
    }
  });

  document.addEventListener('focusout', (e) => {
    setTimeout(() => {
      const suggestions = document.getElementById('sff-suggestions');
      if (suggestions && !suggestions.contains(document.activeElement)) {
        suggestions.remove();
      }
    }, 200);
  });
}

function showSuggestions(element, fieldKey, category) {
  const existing = document.getElementById('sff-suggestions');
  if (existing) existing.remove();

  const value = getStoredValue(fieldKey, category);
  if (!value) return;

  const suggestions = document.createElement('div');
  suggestions.id = 'sff-suggestions';
  suggestions.innerHTML = `
    <div class="sff-suggestion-item" tabindex="0">
      <span class="sff-suggestion-value">${truncate(value, 20)}</span>
      <span class="sff-suggestion-label">Fill ${formatFieldName(fieldKey)}</span>
    </div>
  `;

  const rect = element.getBoundingClientRect();
  suggestions.style.top = `${window.scrollY + rect.bottom + 5}px`;
  suggestions.style.left = `${window.scrollX + rect.left}px`;
  suggestions.style.width = `${Math.max(rect.width, 150)}px`;

  document.body.appendChild(suggestions);

  suggestions.onclick = () => {
    setFieldValue(element, value);
    suggestions.remove();
  };
}  

  // Calculate confidence score for field match
  function calculateConfidence(field) {
    const identifier = field.originalIdentifier || '';
    const fieldKey = field.fieldKey || '';
    
    // High confidence: exact pattern match in identifier
    const exactPatterns = FIELD_PATTERNS[fieldKey];
    if (exactPatterns && exactPatterns.some(p => p.test(identifier))) {
      return 'high';
    }
    
    // High confidence: input type matches (email, tel, url)
    const element = field.element;
    if (element && (
      (element.type === 'email' && fieldKey === 'email') ||
      (element.type === 'tel' && fieldKey === 'phone') ||
      (element.type === 'url' && ['website', 'linkedin', 'github'].includes(fieldKey))
    )) {
      return 'high';
    }
    
    // Medium confidence: fuzzy match or stored data match
    const normalizedId = normalizeFieldName(identifier);
    const normalizedKey = normalizeFieldName(fieldKey);
    if (normalizedId.includes(normalizedKey) || normalizedKey.includes(normalizedId)) {
      return 'medium';
    }
    
    // Low confidence: new/unknown field
    return 'low';
  }

  // Fill the detected fields (all)
function fillFields() {
  let filledCount = 0;
  detectedFields.forEach(field => {
    const value = getStoredValue(field.fieldKey, field.category);
    if (value) {
      setFieldValue(field.element, value);
      trackAutoFilledValue(field, value);
      filledCount++;
    }
  });
  console.log(`Form Filler: Filled ${filledCount} fields`);
}

// Fill only selected fields (Accepts field objects now)
function fillSelectedFields(fields) {
  let filledCount = 0;
  if (!Array.isArray(fields)) {
    console.error('Form Filler: Invalid fields passed to fillSelectedFields');
    return;
  }

  fields.forEach(field => {
    // Robust check for field validity
    if (!field || typeof field !== 'object' || !field.fieldKey) {
      console.warn('Form Filler: Skipping invalid field in selection', field);
      return;
    }

    const value = getStoredValue(field.fieldKey, field.category);
    if (value) {
      setFieldValue(field.element, value);
      trackAutoFilledValue(field, value);
      filledCount++;
    }
  });
  console.log(`Form Filler: Filled ${filledCount} selected fields`);
}

function trackAutoFilledValue(field, value) {
  autoFilledValues.set(field.element, {
    originalValue: value,
    fieldKey: field.fieldKey,
    category: field.category
  });
  
  // Add listener for changes (adaptive learning)
  field.element.addEventListener('blur', handleFieldUpdate);
}

async function handleFieldUpdate(e) {
  const element = e.target;
  const tracked = autoFilledValues.get(element);
  if (!tracked) return;
  
  const newValue = element.value?.trim();
  if (newValue && newValue !== tracked.originalValue) {
    showCorrectionPrompt(element, tracked.fieldKey, tracked.category, newValue);
  }
}

function showCorrectionPrompt(element, fieldKey, category, newValue) {
  // Remove existing prompt if any
  const existing = document.getElementById('sff-correction-prompt');
  if (existing) existing.remove();
  
  const prompt = document.createElement('div');
  prompt.id = 'sff-correction-prompt';
  prompt.innerHTML = `
    <span>Update saved ${formatFieldName(fieldKey)}?</span>
    <button id="sff-update-yes">Update</button>
    <button id="sff-update-no">No</button>
  `;
  
  const rect = element.getBoundingClientRect();
  prompt.style.top = `${window.scrollY + rect.bottom + 5}px`;
  prompt.style.left = `${window.scrollX + rect.left}px`;
  
  document.body.appendChild(prompt);
  
  document.getElementById('sff-update-yes').onclick = async () => {
    await updateStoredData(category, fieldKey, newValue);
    autoFilledValues.set(element, { ...tracked, originalValue: newValue });
    prompt.remove();
  };
  
  document.getElementById('sff-update-no').onclick = () => {
    prompt.remove();
  };
  
  // Auto-hide after 5 seconds
  setTimeout(() => prompt?.remove(), 5000);
}

async function updateStoredData(category, fieldKey, value) {
  try {
    const result = await chrome.storage.local.get('formData');
    const data = result.formData || {};
    
    if (!data[category]) data[category] = {};
    data[category][fieldKey] = value;
    
    await chrome.storage.local.set({ formData: data });
    storedData = data;
    
    // Notify background/popup
    chrome.runtime.sendMessage({ action: 'dataUpdated', formData: data, settings });
    console.log(`Form Filler: Updated ${category}.${fieldKey} via adaptive learning`);
  } catch (error) {
    console.error('Error updating data:', error);
  }
}

  // Magic Fill Icon Logic
// Magic Fill & AI Generation Icon Logic
function injectMagicFillIcons() {
  removeMagicFillIcons();
  
  detectedFields.forEach(field => {
    if (field.element.tagName === 'SELECT' || field.element.disabled || field.element.readOnly) return;
    
    const container = field.element.parentElement;
    if (!container) return;
    
    // Ensure container is relative for positioning
    const style = window.getComputedStyle(container);
    if (style.position === 'static') {
      container.style.position = 'relative';
    }
    
    const value = getStoredValue(field.fieldKey, field.category);
    const isAiTarget = !value && (field.element.tagName === 'TEXTAREA' || field.element.type === 'text');
    
    const icon = document.createElement('div');
    icon.className = isAiTarget ? 'sff-ai-icon' : 'sff-magic-icon';
    icon.title = isAiTarget ? 'AI Draft' : 'Smart Fill';
    
    if (settings?.showMagicIcon === false && !isAiTarget) return;

    if (isAiTarget) {
      icon.innerHTML = '✨';
      icon.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleAIGeneration(field);
      };
    } else {
      icon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/>
          <path d="M7 9h10M7 12h7M7 15h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
      icon.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        detectForms(true); // Force fill flow
      };

      // Visibility Behavior
      if (settings?.magicIconBehavior === 'hover') {
        icon.classList.add('invisible');
        // Show on icon hover (handled by CSS) or field hover
        const show = () => icon.classList.add('visible');
        const hide = () => icon.classList.remove('visible');
        
        container.addEventListener('mouseenter', show);
        container.addEventListener('mouseleave', hide);
        field.element.addEventListener('focus', show);
        field.element.addEventListener('blur', () => setTimeout(hide, 200));
      } else if (settings?.magicIconBehavior === 'focus') {
        icon.classList.add('invisible');
        const show = () => icon.classList.add('visible');
        const hide = () => icon.classList.remove('visible');
        
        field.element.addEventListener('focus', show);
        field.element.addEventListener('blur', () => setTimeout(hide, 200));
      }
    }
    
    // Position icon
    const rect = field.element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    icon.style.top = `${rect.top - containerRect.top + (rect.height - 18) / 2}px`;
    icon.style.left = `${rect.right - containerRect.left - 24}px`;
    
    container.appendChild(icon);
  });
}

async function handleAIGeneration(field) {
  if (!settings?.geminiApiKey) {
    alert('Please set your Gemini API key in the extension settings to use AI generation.');
    return;
  }

  const icon = field.element.parentElement.querySelector('.sff-ai-icon');
  if (icon) {
    icon.innerHTML = '⏳';
    icon.classList.add('loading');
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateField',
      field: {
        label: field.label,
        name: field.name,
        placeholder: field.placeholder,
        type: field.type
      },
      profileData: storedData,
      apiKey: settings.geminiApiKey
    });

    if (response.success && response.result) {
      showAIDraftPrompt(field.element, response.result, field.fieldKey, field.category);
    } else {
      console.error('AI Generation failed:', response.error);
    }
  } catch (error) {
    console.error('AI Generation error:', error);
  } finally {
    if (icon) {
      icon.innerHTML = '✨';
      icon.classList.remove('loading');
    }
  }
}

function showAIDraftPrompt(element, draft, fieldKey, category) {
  removeAIDraftPrompt();
  
  const prompt = document.createElement('div');
  prompt.id = 'sff-ai-draft-prompt';
  prompt.innerHTML = `
    <div class="sff-ai-draft-header">✨ AI Recommended Draft</div>
    <div class="sff-ai-draft-body">${draft}</div>
    <div class="sff-ai-draft-footer">
      <button id="sff-ai-apply">Apply Draft</button>
      <button id="sff-ai-decline">Cancel</button>
    </div>
  `;
  
  const rect = element.getBoundingClientRect();
  prompt.style.top = `${window.scrollY + rect.top - 120}px`;
  prompt.style.left = `${window.scrollX + rect.left}px`;
  prompt.style.width = `${Math.max(rect.width, 300)}px`;
  
  document.body.appendChild(prompt);
  
  document.getElementById('sff-ai-apply').onclick = () => {
    setFieldValue(element, draft);
    updateStoredData(category, fieldKey, draft); // Save for future use
    prompt.remove();
  };
  
  document.getElementById('sff-ai-decline').onclick = () => prompt.remove();
}

function removeAIDraftPrompt() {
  document.getElementById('sff-ai-draft-prompt')?.remove();
}

function removeMagicFillIcons() {
  document.querySelectorAll('.sff-magic-icon, .sff-ai-icon').forEach(el => el.remove());
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
    
    // Trigger all relevant events with delay for framework lifecycle
    requestAnimationFrame(() => {
      ['input', 'change', 'blur', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        // Some frameworks check for these properties
        Object.defineProperty(event, 'simulated', { value: true, writable: false });
        element.dispatchEvent(event);
      });
      
      // Focus and blur for validation triggers
      element.focus();
      setTimeout(() => element.blur(), 50);
    });
  }

  // Observe DOM for dynamically added forms
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

  // Learn from filled form - with Gemini AI validation
  async function learnFromForm(form) {
    // Check if profile is locked
    if (lockedProfiles.includes(currentProfile)) {
      console.log('Form Filler: Profile locked, skipping learning');
      return;
    }
    
    if (!form || settings?.guestMode) return;
    
    const inputs = form.querySelectorAll('input, select, textarea');
    const fieldsToLearn = [];
    
    // Collect all filled fields with their context
    inputs.forEach((input, index) => {
      if (shouldSkipInput(input) || input.type === 'password' || !input.value?.trim()) return;
      
      const label = getFieldLabel(input);
      const value = input.value.trim();
      
      fieldsToLearn.push({
        index,
        element: input,
        label: label || input.placeholder || input.name || input.id || `field_${index}`,
        value,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        type: input.type
      });
    });
    
    if (fieldsToLearn.length === 0) return;
    
    // Try to validate with Gemini AI
    let validatedFields = null;
    if (settings?.geminiApiKey) {
      validatedFields = await validateFieldsWithGemini(fieldsToLearn);
    }
    
    // Process fields (use Gemini results if available, otherwise use local detection)
    const newData = {};
    let learnedCount = 0;
    
    for (const field of fieldsToLearn) {
      let fieldKey, category;
      
      if (validatedFields && validatedFields[field.index]) {
        // Use Gemini's categorization
        const geminiResult = validatedFields[field.index];
        fieldKey = geminiResult.fieldName;
        category = geminiResult.category;
      } else {
        // Fallback to local detection
        const match = identifyField(field.element, getSiteConfig());
        if (!match) continue;
        fieldKey = match.key;
        category = match.category;
      }
      
      // Skip if same value already exists
      if (storedData[category]?.[fieldKey] === field.value) continue;
      
      if (!newData[category]) newData[category] = {};
      newData[category][fieldKey] = field.value;
      learnedCount++;
    }
    
    // Save learned data
    if (Object.keys(newData).length > 0) {
      const updatedData = { ...storedData };
      for (const [category, fields] of Object.entries(newData)) {
        updatedData[category] = { ...updatedData[category], ...fields };
      }
      
      try {
        await chrome.storage.local.set({ formData: updatedData });
        storedData = updatedData;
        console.log(`Form Filler: Learned ${learnedCount} fields (Gemini: ${validatedFields ? 'yes' : 'no'})`, newData);
        
        // Notify popup to sync to cloud
        chrome.runtime.sendMessage({ action: 'dataUpdated', formData: updatedData, settings });
      } catch (error) {
        console.error('Form Filler: Error saving', error);
      }
    }
  }
  
  // Validate fields with Gemini AI
  async function validateFieldsWithGemini(fields) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateFormFields',
        fields: fields.map(f => ({
          index: f.index,
          label: f.label,
          value: f.value,
          name: f.name,
          id: f.id,
          placeholder: f.placeholder,
          type: f.type
        })),
        apiKey: settings.geminiApiKey
      });
      
      if (response?.success && response.results) {
        return response.results;
      }
    } catch (error) {
      console.error('Form Filler: Gemini validation error', error);
    }
    return null;
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

  // Handle manual field mapping from context menu
  async function handleManualMapping(fieldKey) {
    if (!lastRightClickedElement) return;
    
    const element = lastRightClickedElement;
    const category = CATEGORY_MAP[fieldKey] || 'other';
    
    // Identify best attribute to save (id, name, then placeholder)
    const attribute = element.id || element.name || element.placeholder;
    if (!attribute) {
      console.log('Form Filler: Could not find a reliable attribute to map');
      return;
    }

    // Save to adaptive learning (siteSpecificPatterns)
    const hostname = window.location.hostname;
    try {
      const { siteSpecificPatterns = {} } = await chrome.storage.local.get('siteSpecificPatterns');
      
      if (!siteSpecificPatterns[hostname]) {
        siteSpecificPatterns[hostname] = {};
      }
      
      // Save mapping: "attribute_value": "fieldKey"
      siteSpecificPatterns[hostname][attribute.toLowerCase()] = fieldKey;
      
      await chrome.storage.local.set({ siteSpecificPatterns });
      console.log(`Form Filler: Manually mapped "${attribute}" to "${fieldKey}" for ${hostname}`);
      
      // Immediately fill the field as feedback
      const value = storedData[category]?.[fieldKey];
      if (value) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Visual feedback
        const originalBorder = element.style.border;
        element.style.border = '2px solid #7C3AED';
        setTimeout(() => {
          element.style.border = originalBorder;
        }, 1000);
      }
    } catch (error) {
      console.error('Form Filler: Error saving manual mapping', error);
    }
  }

  // --- HUD Logic ---
  let hudElement = null;
  let isHudDragging = false;
  let hudDragOffset = { x: 0, y: 0 };

  function injectHUD() {
    if (settings?.showHUD === false) return;
    if (isRestrictedDomain()) return;
    
    // Don't inject HUD in small frames
    if (isInternalFrame && window.innerWidth < 150) return;

    if (document.getElementById('sff-hud')) {
      // If already there, ensure it's visible
      hudElement.style.display = 'flex';
      return;
    }

    hudElement = document.createElement('div');
    hudElement.id = 'sff-hud';
    hudElement.className = 'sff-hud collapsed'; // Default to collapsed
    
    // Default position (bottom right)
    hudElement.style.bottom = '20px';
    hudElement.style.right = '20px';

    hudElement.innerHTML = `
      <div class="sff-hud-header" id="sff-hud-header">
        <div class="sff-hud-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
          <span>SMART FILL</span>
        </div>
        <div class="sff-hud-controls">
          <span class="sff-hud-minimize" id="sff-hud-minimize" title="Minimize to Bubble">−</span>
        </div>
      </div>
      <div class="sff-hud-body">
        <div class="sff-hud-actions">
          <button class="sff-hud-btn sff-hud-btn-primary" id="sff-hud-fill-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Auto Fill Form
          </button>
          <button class="sff-hud-btn" id="sff-hud-switch-profile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
            Switch Profile
          </button>
        </div>
        <div class="sff-hud-profile-info">
          <span>Active: <span class="sff-hud-current-profile" id="sff-hud-active-profile">${currentProfile}</span></span>
          <span id="sff-hud-lock-status">${lockedProfiles.includes(currentProfile) ? '🔒' : '🔓'}</span>
        </div>
      </div>
      <div class="sff-hud-footer">
        <div class="sff-hud-collapse" id="sff-hud-collapse">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
        </div>
      </div>
      <div class="sff-hud-trigger" id="sff-hud-trigger">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
      </div>
    `;

    document.body.appendChild(hudElement);
    setupHUDListeners();
  }

  function setupHUDListeners() {
    const header = document.getElementById('sff-hud-header');
    const fillBtn = document.getElementById('sff-hud-fill-all');
    const switchBtn = document.getElementById('sff-hud-switch-profile');
    const collapseBtn = document.getElementById('sff-hud-collapse');
    const minimizeBtn = document.getElementById('sff-hud-minimize');
    const trigger = document.getElementById('sff-hud-trigger');

    // Dragging
    header.addEventListener('mousedown', startHudDrag);
    document.addEventListener('mousemove', handleHudDrag);
    document.addEventListener('mouseup', endHudDrag);

    // Actions
    fillBtn.addEventListener('click', () => detectForms(true));
    
    switchBtn.addEventListener('click', async () => {
      const result = await chrome.storage.local.get(['profiles']);
      const profileNames = Object.keys(result.profiles || {});
      if (profileNames.length > 1) {
        let nextIndex = (profileNames.indexOf(currentProfile) + 1) % profileNames.length;
        const nextProfile = profileNames[nextIndex];
        chrome.runtime.sendMessage({ action: 'switchProfile', profile: nextProfile });
      }
    });

    collapseBtn.addEventListener('click', () => {
      hudElement.classList.add('collapsed');
    });

    minimizeBtn.addEventListener('click', () => {
      hudElement.classList.add('collapsed');
    });

    trigger.addEventListener('click', () => {
      hudElement.classList.remove('collapsed');
    });
  }

  function startHudDrag(e) {
    isHudDragging = true;
    hudElement.classList.add('dragging');
    const rect = hudElement.getBoundingClientRect();
    hudDragOffset.x = e.clientX - rect.left;
    hudDragOffset.y = e.clientY - rect.top;
    
    // Remove bottom/right positioning to allow absolute movement
    hudElement.style.bottom = 'auto';
    hudElement.style.right = 'auto';
    hudElement.style.top = rect.top + 'px';
    hudElement.style.left = rect.left + 'px';
    
    e.preventDefault();
  }

  function handleHudDrag(e) {
    if (!isHudDragging) return;
    
    const x = e.clientX - hudDragOffset.x;
    const y = e.clientY - hudDragOffset.y;
    
    // Bounds check
    const maxX = window.innerWidth - hudElement.offsetWidth;
    const maxY = window.innerHeight - hudElement.offsetHeight;
    
    hudElement.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    hudElement.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  }

  function endHudDrag() {
    if (!isHudDragging) return;
    isHudDragging = false;
    hudElement.classList.remove('dragging');
  }

  function updateHUDInfo() {
    if (settings?.showHUD === false) {
      removeHUD();
      return;
    }
    const profileEl = document.getElementById('sff-hud-active-profile');
    const lockEl = document.getElementById('sff-hud-lock-status');
    if (profileEl) profileEl.textContent = currentProfile;
    if (lockEl) lockEl.textContent = lockedProfiles.includes(currentProfile) ? '🔒' : '🔓';
  }

  function removeHUD() {
    const existing = document.getElementById('sff-hud');
    if (existing) {
      existing.remove();
      hudElement = null;
    }
  }

  function isRestrictedDomain() {
    // Redundant but safe
    const hostname = window.location.hostname.toLowerCase();
    const href = window.location.href.toLowerCase();
    return DISTRACTION_FREE_DOMAINS.some(d => hostname.includes(d) || href.includes(d));
  }

  // Start
  init();
  // Toast Notification System
  function showToast(message, type = 'info', options = {}) {
    const { actions = [], duration = 5000 } = options;
    
    const toast = document.createElement('div');
    toast.className = `sff-toast ${type}`;
    
    const icons = {
      error: '❌',
      success: '✓',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    let actionsHTML = '';
    if (actions.length > 0) {
      actionsHTML = `<div class="sff-toast-actions">${actions.map(action => 
        `<button class="sff-toast-btn ${action.primary ? 'sff-toast-btn-primary' : 'sff-toast-btn-secondary'}" data-action="${action.id}">${action.label}</button>`
      ).join('')}</div>`;
    }
    
    // Create structure safely without exposing message to XSS
    toast.innerHTML = `
      <div class="sff-toast-icon">${icons[type]}</div>
      <div class="sff-toast-content">
        <div class="sff-toast-message"></div>
        ${actionsHTML}
      </div>
      <div class="sff-toast-close">×</div>
    `;
    
    // Safely set message content (XSS-proof)
    const messageDiv = toast.querySelector('.sff-toast-message');
    messageDiv.textContent = message;
    
    // Accessibility attributes
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    
    document.body.appendChild(toast);
    activeToasts.push(toast);
    
    // Keyboard support - Escape to dismiss
    const escapeHandler = (e) => {
      if (e.key === 'Escape' && activeToasts.includes(toast)) {
        removeToast(toast);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Close handler
    toast.querySelector('.sff-toast-close').addEventListener('click', () => {
      removeToast(toast);
    });
    
    // Action handlers
    actions.forEach(action => {
      const btn = toast.querySelector(`[data-action="${action.id}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          // Handle retry actions
          if (action.id.startsWith('retry_')) {
            const context = retryContext[action.id];
            if (context) {
              handleRetry(context);
              delete retryContext[action.id]; // Clean up
            }
          } else if (action.callback) {
            action.callback();
          }
          removeToast(toast);
        });
      }
    });
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => removeToast(toast), duration);
    }
    
    return toast;
  }

  function removeToast(toast) {
    if (toast && toast.parentElement) {
      toast.style.animation = 'sff-toast-slide-in 0.3s reverse';
      setTimeout(() => {
        toast.remove();
        activeToasts = activeToasts.filter(t => t !== toast);
      }, 300);
    }
  }

  // Handle retry actions for failed operations
  function handleRetry(context) {
    if (context.type === 'analyzeFields') {
      // Re-trigger form detection which will call the AI again
      detectForms(true);
      showToast('Retrying field analysis...', 'info', { duration: 2000 });
    } else if (context.type === 'generateField') {
      // Show a toast that this needs to be retried from the popup
      showToast('Please retry generation from the popup', 'warning', { duration: 4000 });
    }
  }

  // Smart Profile Switching based on URL
  async function detectAndSwitchProfile() {
    const url = window.location.hostname.toLowerCase();
    
    for (const [profile, patterns] of Object.entries(PROFILE_URL_PATTERNS)) {
      if (patterns.some(pattern => url.includes(pattern))) {
        const { currentProfile: storedProfile } = await chrome.storage.local.get(['currentProfile']);
        
        if (storedProfile !== profile) {
          console.log(`Smart Form Filler: Auto-switching to "${profile}" profile for ${url}`);
          await chrome.runtime.sendMessage({ action: 'switchProfile', profile });
          currentProfile = profile;
          showToast(`Switched to "${profile.replace('_', ' ')}" profile`, 'info', { duration: 3000 });
        }
        return;
      }
    }
  }

  // Smarter MutationObserver with IntersectionObserver
  function observeDOMChanges() {
    let debounceTimer;
    const detectedForms = new Set();
    
    // Periodic cleanup of detectedForms to prevent memory leaks
    setInterval(() => {
      // Remove forms that are no longer in the DOM
      detectedForms.forEach(form => {
        if (!document.contains(form)) {
          detectedForms.delete(form);
        }
      });
    }, 30000); // Clean up every 30 seconds
    
    // IntersectionObserver to track visible forms
    formIntersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !detectedForms.has(entry.target)) {
          detectedForms.add(entry.target);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            hasScannedPage = false;
            detectForms();
          }, 500);
        } else if (!entry.isIntersecting) {
          // Remove from Set when no longer visible
          detectedForms.delete(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    });
    
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Ignore our own extension elements
            if (node.id === 'smart-form-filler-popup' || node.id === 'sff-hud' ||
                node.classList?.contains('sff-magic-icon') || node.classList?.contains('sff-toast')) {
              return;
            }

            // Check if it's a form or contains form elements
            if (node.matches?.('form, [role="form"]')) {
              formIntersectionObserver.observe(node);
            } else if (node.querySelector) {
              node.querySelectorAll('form, [role="form"]').forEach(form => {
                formIntersectionObserver.observe(form);
              });
            }
          }
        });
      });
    });
    
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also observe existing forms on page load
    document.querySelectorAll('form, [role="form"]').forEach(form => {
      formIntersectionObserver.observe(form);
    });
  }

})();
