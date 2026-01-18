# Smart Form Filler - Testing Guide

## Features to Test

### 1. **Authentication & Account Management**
- [ ] **Signup**: Register a new account with email/password
- [ ] **Login**: Sign in with existing credentials
- [ ] **Token Verification**: Check if auth token is validated correctly
- [ ] **Session Persistence**: Verify token is saved in Chrome storage
- [ ] **Guest Mode**: Test form filling without authentication

### 2. **Profile Management**
- [ ] **Default Profiles**: Verify 3 default profiles exist (personal, work, job_apps)
- [ ] **Create Profile**: Add a new custom profile
- [ ] **Edit Profile**: Modify existing profile data
- [ ] **Delete Profile**: Remove a profile
- [ ] **Switch Profiles**: Toggle between different profiles
- [ ] **Profile Data Categories**: Ensure all 6 categories are present:
  - Personal (name, DOB, gender, nationality)
  - Contact (email, phone)
  - Address (street, city, state, zip, country)
  - Education (university, degree, major, GPA, graduation year)
  - Professional (company, job title, LinkedIn, GitHub, website)
  - Other (skills, bio, languages, hobbies)

### 3. **Form Detection & Filling**
- [ ] **Open Test Form**: Load `test_form.html` in browser
- [ ] **Auto-Detection**: Verify form fields are detected automatically
- [ ] **Field Matching**: Check if fields are correctly matched to profile data:
  - Full Name field → fullName
  - Email field → email
  - University field → university
  - Bio textarea → bio
- [ ] **Basic Fill**: Use popup to fill form with current profile
- [ ] **Partial Fill**: Fill only selected fields
- [ ] **Clear Form**: Verify ability to clear form data

### 4. **Templates**
- [ ] **LinkedIn Template**: Load LinkedIn template and verify fields
- [ ] **Indeed Template**: Load Indeed template
- [ ] **GitHub Template**: Load GitHub template
- [ ] **Workday Template**: Load comprehensive Workday template
- [ ] **Job Application Template**: Load full job application template
- [ ] **Contact Form Template**: Load basic contact template
- [ ] **Apply Template**: Apply a template to current profile

### 5. **Advanced Field Matching (Content Script)**
Test pattern recognition for different field types:

#### Personal Fields
- [ ] firstName, lastName, fullName variations (First Name, fname, given name, etc.)
- [ ] Date of birth (birth, dob, date of birth, birthday, born)
- [ ] Gender, nationality

#### Contact Fields
- [ ] Email (e-mail, email address, correo, courriel)
- [ ] Phone (mobile, tel, cell, telefono, numero)
- [ ] Alternate email/phone

#### Address Fields
- [ ] Street/Address (address line, dirección, adresse)
- [ ] Apartment/Unit
- [ ] City (town, locality, ciudad, ville, ort)
- [ ] State/Province (estado, provincia)
- [ ] Zip code (postal, post code, pin code, plz)
- [ ] Country (nation, pais, pays, land)

#### Professional Fields
- [ ] Company (organization, employer, firma, entreprise)
- [ ] Job title (position, role, designation, puesto, poste)
- [ ] LinkedIn, GitHub, website
- [ ] Department, team

#### Education Fields
- [ ] University (college, school, institution, alma mater)
- [ ] Degree (qualification, diploma, certificate)
- [ ] Major (field of study, specialization, concentration)
- [ ] Minor, GPA, graduation year
- [ ] Start/end dates
- [ ] Education level

#### Work Experience
- [ ] Experience (years of, work history)
- [ ] Current/previous employer
- [ ] Start/end dates
- [ ] Salary, compensation
- [ ] Notice period

#### Other Fields
- [ ] Skills, languages, bio
- [ ] Hobbies, interests
- [ ] References
- [ ] Identity documents (passport, license, national ID)
- [ ] Social profiles (Facebook, Instagram, Twitter)

### 6. **Keyboard Shortcuts**
- [ ] **Alt+F** (or Alt+F on Mac): Trigger form fill
- [ ] **Alt+Shift+F**: Open extension popup

### 7. **Context Menu**
- [ ] Right-click on page/form field
- [ ] Verify "Fill Form with Smart Form Filler" option appears
- [ ] Click and verify form is filled

### 8. **Settings & Preferences**
- [ ] **Auto-Fill Toggle**: Enable/disable auto-fill
- [ ] **Guest Mode**: Toggle guest mode on/off
- [ ] **Show Confirmation**: Toggle confirmation popup
- [ ] **Learn from Forms**: Toggle adaptive learning
- [ ] **Gemini AI Key**: Enter and save API key

### 9. **Learning System**
- [ ] **Adaptive Learning**: Fill a field manually, verify it's learned
- [ ] **Pattern Recognition**: Check if newly learned fields are recognized
- [ ] **Learning History**: View what the extension has learned

### 10. **History & Sync**
- [ ] **Fill History**: View previous form fills
- [ ] **Cloud Sync**: Verify data syncs across devices (if backend connected)
- [ ] **Last Used Profile**: Verify previously used profile is remembered

### 11. **Special Scenarios**
- [ ] **Shadow DOM**: Test forms inside shadow DOM
- [ ] **iframes**: Test nested forms in iframes
- [ ] **Lazy-loaded Forms**: Test dynamically loaded forms
- [ ] **Dropdown Selection**: Verify select/option fields work
- [ ] **Textarea Fields**: Test long-text fields like bio
- [ ] **File Upload Fields**: Verify these are skipped appropriately

### 12. **Edge Cases**
- [ ] **Empty Profile**: Try filling with empty profile data
- [ ] **Partial Data**: Fill form with incomplete profile
- [ ] **Multiple Forms**: Test with multiple forms on page
- [ ] **Form Validation**: Check if form validation is respected
- [ ] **Special Characters**: Test with special characters in data

### 13. **Backend Server (if running)**
- [ ] **Server Health**: Check `/health` endpoint
- [ ] **Auth Signup**: POST `/api/auth/signup` with email, password
- [ ] **Auth Login**: POST `/api/auth/login` with credentials
- [ ] **Profile Get**: GET `/api/profile` with auth token
- [ ] **Profile Update**: PUT `/api/profile` with updated data
- [ ] **Token Verification**: Verify JWT validation works

### 14. **Performance & Stability**
- [ ] **Load Time**: Popup opens within reasonable time
- [ ] **Memory Usage**: Extension doesn't consume excessive memory
- [ ] **No Console Errors**: Check for JavaScript errors
- [ ] **Re-scanning**: Test re-scanning when page content changes
- [ ] **Multiple Fills**: Fill same form multiple times successfully

---

## Testing Workflow

### Phase 1: Setup
1. Load the extension in Chrome (manage extensions → Load unpacked)
2. Create a test profile with sample data
3. Open `test_form.html`

### Phase 2: Basic Testing
1. Test popup opening (Alt+Shift+F)
2. Test form detection
3. Test basic form fill
4. Verify filled data is correct

### Phase 3: Advanced Testing
1. Test different templates
2. Test keyboard shortcuts
3. Test context menu
4. Test profile switching

### Phase 4: Edge Cases
1. Test with incomplete data
2. Test with special characters
3. Test form re-detection
4. Test multiple fills

### Phase 5: Backend (Optional)
1. Start server: `npm start` in `/server` directory
2. Test auth endpoints
3. Test profile sync

---

## Running Tests

### Manual Testing Steps:

```bash
# 1. Start the backend (optional, if testing cloud sync)
cd server
npm install
npm start

# 2. Load extension in Chrome
# - Go to chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the "form filler" directory

# 3. Create test data
# - Click extension icon
# - Sign up or login
# - Go to "Learn" tab
# - Add test data to profiles

# 4. Test with test_form.html
# - Open test_form.html in browser
# - Use Alt+F or context menu to fill
# - Verify all fields are filled correctly

# 5. Test other websites
# - Visit various websites with forms
# - Test pattern matching
# - Test partial fills
```

---

## Expected Results

After completing all tests, you should be able to:
- ✅ Sign up/login successfully
- ✅ Create and manage multiple profiles
- ✅ Auto-fill forms with accurate field matching
- ✅ Use keyboard shortcuts and context menu
- ✅ Learn from new forms
- ✅ Apply templates
- ✅ View fill history
- ✅ Toggle settings on/off

---

## Known Limitations

- Requires active internet for backend features (auth, sync)
- File upload fields cannot be automatically filled (security)
- Some CAPTCHAs may block auto-fill
- Shadow DOM support depends on website implementation
- iframes with different origins cannot be filled

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Popup won't open | Check if extension is loaded in `chrome://extensions/` |
| Fields not detected | Check browser console for errors, enable "Learn from forms" |
| Form won't fill | Verify profile has data, check field matching in console |
| Auth not working | Check backend is running, verify API URL in popup.js |
| Keyboard shortcut not working | Check Chrome settings for conflicting shortcuts |
