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
        guestMode: false,
        showConfirmation: true,
        learnFromForms: true,
        showHUD: true,
        showMagicIcon: true,
        geminiApiKey: ''
      }
    });
    console.log('Smart Form Filler installed');
  }
  
  // Create context menus
  createContextMenus();
});

// Function to create initial context menus
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Root menu
    chrome.contextMenus.create({
      id: 'sff-root',
      title: 'Smart Fill',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'fill-form',
      parentId: 'sff-root',
      title: 'Fill All Fields',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'map-field',
      parentId: 'sff-root',
      title: 'Map this field to...',
      contexts: ['editable']
    });

    // Categories
    const categories = {
      'personal': 'Personal Info',
      'contact': 'Contact Info',
      'address': 'Address Details',
      'education': 'Education',
      'professional': 'Professional',
      'other': 'Other Skills/Bio'
    };

    const fields = {
      'personal': ['firstName', 'lastName', 'fullName', 'dob', 'gender', 'nationality'],
      'contact': ['email', 'phone', 'alternateEmail'],
      'address': ['street', 'city', 'state', 'zip', 'country'],
      'education': ['university', 'degree', 'major', 'gpa', 'graduationYear'],
      'professional': ['company', 'jobTitle', 'linkedin', 'github', 'experience'],
      'other': ['skills', 'languages', 'bio']
    };

    for (const [id, title] of Object.entries(categories)) {
      chrome.contextMenus.create({
        id: `cat-${id}`,
        parentId: 'map-field',
        title: title,
        contexts: ['editable']
      });

      if (fields[id]) {
        fields[id].forEach(field => {
          chrome.contextMenus.create({
            id: `map-${field}`,
            parentId: `cat-${id}`,
            title: formatFieldName(field),
            contexts: ['editable']
          });
        });
      }
    }
  });
}

function formatFieldName(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

// Test Gemini Connection
async function testGeminiConnection(apiKey) {
  if (!apiKey) return { success: false, error: 'API Key is required' };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "Connection successful"' }] }]
      })
    });
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error?.message || 'Connection failed' };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true;
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'trigger-fill') {
    triggerFillingInActiveTab();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fill-form') {
    triggerFillingInActiveTab();
  } else if (info.menuItemId.startsWith('map-')) {
    const fieldName = info.menuItemId.replace('map-', '');
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'mapField', 
        fieldName: fieldName 
      }).catch(() => {});
    }
  }
});

async function triggerFillingInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'triggerFilling' }).catch(() => {});
  }
}

// Handle messages
const GEMINI_MODEL = 'gemini-3-flash-preview';

async function handleMessage(request, sender, sendResponse) {
  try {
    const apiKey = request.apiKey;
    
    switch (request.action) {
      case 'dataUpdated':
        await broadcastDataUpdate(request.formData, request.settings);
        sendResponse({ success: true });
        break;

      case 'analyzeFields':
        const results = await analyzeFieldsWithGemini(request.fields, apiKey);
        sendResponse({ success: true, results });
        break;

      case 'suggestCategory':
        const category = await suggestCategoryWithGemini(request.fieldName, apiKey);
        sendResponse({ success: true, category });
        break;

      case 'getStoredData':
        const data = await chrome.storage.local.get(['formData', 'settings']);
        sendResponse({ success: true, data });
        break;

      case 'validateFormFields':
        const validated = await validateFormFieldsWithGemini(request.fields, apiKey);
        sendResponse({ success: true, results: validated });
        break;

      case 'generateField':
        const generatedText = await generateFieldWithGemini(request.field, request.profileData, apiKey);
        sendResponse({ success: true, result: generatedText });
        break;

      case 'extractFromDocument':
        const docResult = await extractFromDocumentWithGemini(request.fileData, request.mimeType, apiKey);
        sendResponse({ success: true, result: docResult });
        break;

      case 'generateCoverLetter':
        const letter = await generateCoverLetterWithGemini(request.jobDescription, request.profileData, request.tone, apiKey);
        sendResponse({ success: true, result: letter });
        break;

      case 'switchProfile':
        await chrome.storage.local.set({ currentProfile: request.profile });
        await broadcastToAllTabs({ action: 'profileUpdated', profile: request.profile });
        sendResponse({ success: true });
        break;

      case 'extractFromUrl':
        const urlResult = await extractFromUrlWithGemini(request.url, apiKey);
        sendResponse({ success: true, result: urlResult });
        break;

      case 'analyzeFormContext':
        const formAnalysis = await analyzeFormContext(request.formData, apiKey);
        sendResponse({ success: true, result: formAnalysis });
        break;

      case 'generateAutoComplete':
        const suggestions = await generateAutoComplete(request.fieldContext, apiKey);
        sendResponse({ success: true, result: suggestions });
        break;
        
      case 'optimizeProfile':
        const optimized = await optimizeProfileDataWithGemini(request.profileData, apiKey);
        if (optimized && optimized.error) {
          sendResponse({ success: false, error: optimized.error });
        } else {
          sendResponse({ success: true, result: optimized });
        }
        break;

      case 'analyzePageFields':
        const pageResults = await analyzePageFieldsWithGemini(request.fields, apiKey);
        sendResponse({ success: true, results: pageResults });
        break;

      case 'testApiKey':
        const testResult = await testGeminiConnection(apiKey);
        sendResponse(testResult);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Background message error:', error);
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

// Helper to broadcast full data update
async function broadcastDataUpdate(formData, settings) {
  const result = await chrome.storage.local.get(['lockedProfiles', 'currentProfile', 'siteSpecificPatterns']);
  await broadcastToAllTabs({
    action: 'dataUpdated',
    formData,
    settings,
    lockedProfiles: result.lockedProfiles,
    currentProfile: result.currentProfile,
    siteSpecificPatterns: result.siteSpecificPatterns
  });
}

// Analyze multiple fields with Gemini
async function analyzeFieldsWithGemini(fields, apiKey) {
  if (!apiKey || !fields?.length) return {};

  const fieldDescriptions = fields.map((f, i) => 
    `${i + 1}. name="${f.name || 'N/A'}", id="${f.id || 'N/A'}", placeholder="${f.placeholder || 'N/A'}", label="${f.label || 'N/A'}", type="${f.type || 'text'}"`
  ).join('\n');

  const prompt = `You are a form field analyzer. Given these HTML form fields (which may be in any language like Spanish, French, Hindi, etc.):

${fieldDescriptions}

For each field, determine what type of personal data it expects. Translate any non-English labels or placeholders to understand the context.
Return a JSON object where keys are the field numbers (1, 2, 3...) and values are the data type from this list:
firstName, lastName, fullName, middleName, email, phone, alternateEmail, alternatePhone, street, apartment, city, state, zip, country, company, jobTitle, department, linkedin, website, github, university, degree, major, gpa, graduationYear, experience, salary, skills, bio, dob, gender, nationality, or "unknown" if unclear.

Example response: {"1": "firstName", "2": "email", "3": "unknown"}

Return ONLY the JSON object, no other text.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
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
    
    const retryId = `retry_analyze_${Date.now()}`;
    
    // Notify content script about the error
    await broadcastToAllTabs({
      action: 'showToast',
      message: 'AI field analysis failed. Check your API key.',
      type: 'error',
      retryContext: {
        id: retryId,
        type: 'analyzeFields'
      },
      options: {
        duration: 0, // Don't auto-dismiss
        actions: [
          {
            id: retryId,
            label: 'Retry',
            primary: true
          }
        ]
      }
    });
    
    return {};
  }
}

// Suggest category for a field name
async function suggestCategoryWithGemini(fieldName, apiKey) {
  if (!apiKey) return 'other';

  const prompt = `Given the form field name "${fieldName}", which category does it belong to?
Reply with ONLY one word from: personal, contact, address, education, professional, other`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
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

// Validate form fields with Gemini - categorize each field properly
async function validateFormFieldsWithGemini(fields, apiKey) {
  if (!apiKey || !fields?.length) return null;

  const fieldDescriptions = fields.map((f, i) => 
    `${f.index}. Label: "${f.label}", Value: "${f.value}", Name: "${f.name || ''}", Placeholder: "${f.placeholder || ''}"`
  ).join('\n');

  const prompt = `You are a form field categorizer. Given these filled form fields with their labels and values:

${fieldDescriptions}

For each field, determine:
1. The proper field name (like firstName, lastName, email, phone, jobTitle, company, university, degree, etc.)
2. The category (personal, contact, address, education, professional, or other)

Return a JSON object where keys are the field indices and values are objects with "fieldName" and "category".

Example input:
0. Label: "Full Name", Value: "John Doe"
1. Label: "Work Email", Value: "john@company.com"
2. Label: "Current Role", Value: "Software Engineer"

Example output:
{"0": {"fieldName": "fullName", "category": "personal"}, "1": {"fieldName": "email", "category": "contact"}, "2": {"fieldName": "jobTitle", "category": "professional"}}

Rules:
- Use camelCase for fieldName (e.g., firstName, jobTitle, graduationYear)
- Categories: personal (name, dob, gender), contact (email, phone), address (street, city, zip, country), education (university, degree, gpa), professional (company, jobTitle, linkedin), other (everything else)
- Return ONLY the JSON object, no markdown, no explanation.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
      })
    });

    if (!response.ok) throw new Error('Gemini API request failed');

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    // Extract JSON from response
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log('Gemini validated fields:', result);
      return result;
    }
    return null;
  } catch (error) {
    console.error('Gemini validation error:', error);
    return null;
  }
}

// Generate field content with Gemini based on profile
async function generateFieldWithGemini(field, profileData, apiKey) {
  if (!apiKey) return null;

  const profileSummary = JSON.stringify(profileData);
  const prompt = `You are an AI assistant helping a user fill a form. 
Based on the user's profile data:
${profileSummary}

Generate a professional and concise response for the form field:
Label: "${field.label}"
Name: "${field.name || ''}"
Placeholder: "${field.placeholder || ''}"
Type: "${field.type || 'text'}"

Rules:
- If it's a short field (like "Job Title" or "City"), provide a 1-3 word answer.
- If it's a long field (like "Bio" or "Cover Letter"), provide a 1-2 paragraph professional response.
- Use ONLY the information provided in the profile. If info is missing, make a polite, generic placeholder or skip.
- Return ONLY the generated text, no explanation or conversational filler.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) throw new Error('Gemini API request failed');

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (error) {
    console.error('Gemini generation error:', error);
    return null;
  }
}

// Extract profile data from documents/images using Gemini Multi-modal
async function extractFromDocumentWithGemini(fileData, mimeType, apiKey) {
  if (!apiKey) return null;

  const prompt = `Extract all relevant personal and professional information from this document to populate a user profile.
Identify: Full Name, Email, Phone, Address, Job Title, Company, Skills, Education (School, Degree, GPA), and Bio.
Return the data as a structured JSON object with categories: personal, contact, address, professional, education.
Only include fields you are confident about. Return VALID JSON only.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: fileData // Base64 string
              }
            }
          ]
        }],
        generationConfig: { 
          temperature: 0.1, 
          response_mime_type: "application/json" 
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error Detail:', errorText);
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Gemini document extraction error:', error);
    return null;
  }
}

// Extract profile data from a LinkedIn URL using Gemini
async function extractFromUrlWithGemini(url, apiKey) {
  if (!apiKey) return null;

  const prompt = `Visit or analyze this LinkedIn profile URL: ${url}
Extract as much information as possible.
Break down composite fields into granular parts and return them ALL in the following structure:

- personal: { 
    fullName, firstName, lastName, middleName (if any), 
    jobTitle, headline, bio_summary 
  }
- contact: { 
    email, phone, linkedin_url, website, twitter, github 
  }
- professional: { 
    current_company, company_website, 
    experience: [ { company, title, duration, description } ] 
  }
- education: { 
    university, degree, major, graduation_year, 
    schools: [ { school, degree, fieldOfStudy, dates } ] 
  }
- address: {
    city, state, country, zip (if inferrable)
  }
- other: {
    skills (comma separated list), languages
  }

If you cannot access the link directly, use the URL structure and your knowledge base to extract as much as possible.
Return VALID JSON only. Ensure you provide BOTH the full name AND the first/last names separately.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1, 
          response_mime_type: "application/json" 
        }
      })
    });

    if (!response.ok) throw new Error('Gemini API request failed');

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Gemini URL extraction error:', error);
    return null;
  }
}

// Generate Cover Letter
async function generateCoverLetterWithGemini(jobDescription, profileData, tone, apiKey) {
  if (!apiKey) return 'Please set your Gemini API key in settings.';

  const prompt = `
    Write a ${tone} cover letter for the following job description.
    
    My Profile:
    ${JSON.stringify(profileData, null, 2)}
    
    Job Description:
    ${jobDescription}
    
    Keep it concise (under 300 words). Focus on relevant skills.
    Do not include placeholders like "[Your Name]" if possible, use the name from my profile.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API Error');
    
    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error('Cover Letter Gen Error:', error);
    return `Error generating cover letter: ${error.message}`;
  }
}

// Intelligent Form Understanding
async function analyzeFormContext(formData, apiKey) {
  if (!apiKey || !formData) return null;
  
  const prompt = `Analyze this web form and provide insights:

Page Title: ${formData.pageTitle}
Page URL: ${formData.pageUrl}
Form Fields: ${formData.fields.join(', ')}
Field Labels: ${JSON.stringify(formData.labels)}

Determine:
1. Form Purpose (job_application, contact_form, registration, survey, checkout, other)
2. Recommended Profile (personal, work, job_apps)
3. Industry/Domain (tech, finance, healthcare, education, retail, other)
4. Confidence Level (0-100)

Return ONLY JSON:
{
  "formType": "...",
  "recommendedProfile": "...",
  "industry": "...",
  "confidence": number,
  "reasoning": "brief explanation"
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error('Form context analysis error:', error);
    return null;
  }
}

// Auto-Complete Suggestions
async function generateAutoComplete(fieldContext, apiKey) {
  if (!apiKey || !fieldContext.currentText) return null;
  
  const prompt = `Complete this sentence naturally and professionally:

Field: ${fieldContext.fieldName}
Current text: "${fieldContext.currentText}"
Context: ${fieldContext.formType || 'general form'}
User profile hints: ${fieldContext.profileHints || ''}

Provide 2-3 short completion suggestions (10-30 words each).
Return ONLY JSON array: ["suggestion 1", "suggestion 2", "suggestion 3"]`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const jsonMatch = text?.match(/\[[\s\S]*\]/);
    
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error('Auto-complete error:', error);
    return null;
  }
}
// Optimize existing profile data - cleanup, splitting, and categorization
async function optimizeProfileDataWithGemini(profileData, apiKey) {
  if (!apiKey || !profileData) return null;

  const prompt = `You are a data cleaning expert for a browser extension. 
I have a user's profile data that needs cleaning and optimization:
${JSON.stringify(profileData)}

Please perform the following:
1. Break down composite fields into specific ones (e.g., if Name is "Aman Anand", add firstName: "Aman" and lastName: "Anand").
2. Re-categorize fields into (personal, contact, address, education, professional, other) if they are misplaced.
3. Standardize formatting (Proper Case for names, consistent phone formats).
4. If address is a single string, split it into street, city, state, zip.
5. DE-DUPLICATE: Remove redundant fields that mean the same thing.

Return the FULL OPTIMIZED profile as a structured JSON object.
Return VALID JSON ONLY. No explanation.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1, 
          response_mime_type: "application/json" 
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error?.message || `API Error: ${response.status}` };
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) return { error: 'Empty response from AI' };
    
    try {
      // Handle cases where AI might wrap JSON in markdown blocks
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, resultText);
      return { error: 'Failed to parse AI response as JSON' };
    }
  } catch (error) {
    console.error('Profile optimization error:', error);
    return { error: error.message };
  }
}

// Analyze all fields on a page at once using Gemini
async function analyzePageFieldsWithGemini(fields, apiKey) {
  if (!apiKey || !fields?.length) return {};

  const prompt = `You are a form expert. I have a list of form fields from a webpage.
Identify which piece of personal data each field expects.
Fields:
${JSON.stringify(fields.map((f, i) => ({ id: i, label: f.label, placeholder: f.placeholder, name: f.name })))}

Possible data types: firstName, lastName, fullName, email, phone, street, city, state, zip, country, company, jobTitle, university, degree, graduationYear, skills, bio.

Return a JSON mapping of { "field_id": "data_type" }.
If a field is unclear, use "unknown".
Return ONLY VALID JSON.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1, 
          response_mime_type: "application/json" 
        }
      })
    });

    if (!response.ok) return {};

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonMatch = resultText?.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : resultText || '{}');
  } catch (error) {
    console.error('Page analysis error:', error);
    return {};
  }
}
