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
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
