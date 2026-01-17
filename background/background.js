// Smart Form Filler - Background Service Worker with Gemini AI

// Listen for installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      formData: {
        personal: {},
        contact: {},
        address: {},
        education: {},
        professional: {},
        other: {}
      },
      settings: {
        autoFillEnabled: true,
        showConfirmation: true,
        learnFromForms: true,
        geminiApiKey: ''
      }
    });
    console.log('Smart Form Filler installed');
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true;
});

// Handle messages
async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'dataUpdated':
        await broadcastToAllTabs({ action: 'dataUpdated', formData: request.formData, settings: request.settings });
        sendResponse({ success: true });
        break;

      case 'analyzeFields':
        const results = await analyzeFieldsWithGemini(request.fields, request.apiKey);
        sendResponse({ success: true, results });
        break;

      case 'suggestCategory':
        const category = await suggestCategoryWithGemini(request.fieldName, request.apiKey);
        sendResponse({ success: true, category });
        break;

      case 'getStoredData':
        const data = await chrome.storage.local.get(['formData', 'settings']);
        sendResponse({ success: true, data });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Background error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Broadcast message to all tabs
async function broadcastToAllTabs(message) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  }
}

// Analyze multiple fields with Gemini
async function analyzeFieldsWithGemini(fields, apiKey) {
  if (!apiKey || !fields?.length) return {};

  const fieldDescriptions = fields.map((f, i) => 
    `${i + 1}. name="${f.name || 'N/A'}", id="${f.id || 'N/A'}", placeholder="${f.placeholder || 'N/A'}", label="${f.label || 'N/A'}", type="${f.type || 'text'}"`
  ).join('\n');

  const prompt = `You are a form field analyzer. Given these HTML form fields:

${fieldDescriptions}

For each field, determine what type of personal data it expects. Return a JSON object where keys are the field numbers (1, 2, 3...) and values are the data type from this list:
firstName, lastName, fullName, middleName, email, phone, alternateEmail, alternatePhone, street, apartment, city, state, zip, country, company, jobTitle, department, linkedin, website, github, university, degree, major, gpa, graduationYear, experience, salary, skills, bio, dob, gender, nationality, or "unknown" if unclear.

Example response: {"1": "firstName", "2": "email", "3": "unknown"}

Return ONLY the JSON object, no other text.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) throw new Error('Gemini API request failed');

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    // Extract JSON from response
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('Gemini analysis error:', error);
    return {};
  }
}

// Suggest category for a field name
async function suggestCategoryWithGemini(fieldName, apiKey) {
  if (!apiKey) return 'other';

  const prompt = `Given the form field name "${fieldName}", which category does it belong to?
Reply with ONLY one word from: personal, contact, address, education, professional, other`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 20 }
      })
    });

    if (!response.ok) return 'other';

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    
    const validCategories = ['personal', 'contact', 'address', 'education', 'professional', 'other'];
    return validCategories.includes(result) ? result : 'other';
  } catch {
    return 'other';
  }
}

// Context menu for quick fill
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: 'fill-form',
    title: 'Fill this form',
    contexts: ['page', 'editable']
  });
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fill-form' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'triggerFill' });
  }
});

// Keyboard shortcut
chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === 'trigger-fill') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'triggerFill' });
    }
  }
});
