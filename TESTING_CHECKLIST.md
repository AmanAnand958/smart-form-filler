# Smart Form Filler - Testing Checklist

**Date Started**: ___________  
**Tester**: ___________  
**Version**: 2.0.0

---

## ✅ Authentication & Account Management

- [ ] **Signup**: New account created successfully
- [ ] **Login**: Existing account logs in correctly  
- [ ] **Token Storage**: Auth token saved in Chrome storage
- [ ] **Session Persistence**: Session maintained after extension reload
- [ ] **Invalid Credentials**: Error message shown for wrong password
- [ ] **Guest Mode**: Form filling works without login

**Notes**: _____________________________________________________

---

## ✅ Profile Management

- [ ] **Default Profiles**: 3 profiles exist (personal, work, job_apps)
- [ ] **Create New Profile**: Custom profile created
- [ ] **Edit Profile**: Profile data updated successfully
- [ ] **Delete Profile**: Profile removed from list
- [ ] **Profile Switching**: Can switch between profiles
- [ ] **Category Structure**: All 6 categories visible and editable

**Notes**: _____________________________________________________

---

## ✅ Form Detection & Basic Fill

### Test Form (test_form.html)
- [ ] **Form Opens**: test_form.html loads without issues
- [ ] **Field Detection**: All 7 form fields detected
- [ ] **Manual Fill**: Can click "Fill" button in popup
- [ ] **Auto-Fill**: Form populates with profile data
- [ ] **Correct Mapping**:
  - [ ] Full Name → name field
  - [ ] Email → email field
  - [ ] Bio → bio textarea
  - [ ] University → university field
  - [ ] Language selection works
- [ ] **Submit Button**: Form can be submitted after filling

**Notes**: _____________________________________________________

---

## ✅ Templates

- [ ] **LinkedIn Template**: Loads with relevant fields
- [ ] **Indeed Template**: Loads with relevant fields
- [ ] **GitHub Template**: Loads with relevant fields
- [ ] **Workday Template**: Full comprehensive form template
- [ ] **Job Application**: Complete job app template
- [ ] **Contact Form**: Basic contact template
- [ ] **Apply Template**: Selected template applies to profile

**Notes**: _____________________________________________________

---

## ✅ Field Matching - Personal

- [ ] **firstName** variations: First Name, fname, given name
- [ ] **lastName** variations: Last Name, lname, surname
- [ ] **fullName** variations: Full Name, name field
- [ ] **middleName**: Middle name detected
- [ ] **dob**: Birth date, DOB, birthday detected
- [ ] **gender**: Gender field detected
- [ ] **nationality**: Nationality field detected

**Notes**: _____________________________________________________

---

## ✅ Field Matching - Contact

- [ ] **email** variations: email, email address, correo
- [ ] **phone** variations: phone, mobile, tel, cell
- [ ] **alternateEmail**: Secondary email detected
- [ ] **alternatePhone**: Work phone, home phone detected

**Notes**: _____________________________________________________

---

## ✅ Field Matching - Address

- [ ] **street**: Address, street, dirección detected
- [ ] **apartment**: Apt, unit, suite detected
- [ ] **city**: City, town, locality detected
- [ ] **state**: State, province, región detected
- [ ] **zip**: Zip, postal code, pin code detected
- [ ] **country**: Country, nation, pais detected

**Notes**: _____________________________________________________

---

## ✅ Field Matching - Education

- [ ] **university**: University, college, school detected
- [ ] **degree**: Degree, qualification, diploma detected
- [ ] **major**: Major, field of study, specialization detected
- [ ] **minor**: Minor field detected
- [ ] **gpa**: GPA, CGPA, grade detected
- [ ] **graduationYear**: Graduation year, completion year detected
- [ ] **startYear**: Start year, joining year detected
- [ ] **educationLevel**: Highest qualification detected

**Notes**: _____________________________________________________

---

## ✅ Field Matching - Professional

- [ ] **company**: Company, organization, employer detected
- [ ] **jobTitle**: Job title, position, role detected
- [ ] **department**: Department, team detected
- [ ] **linkedin**: LinkedIn field detected
- [ ] **github**: GitHub field detected
- [ ] **website**: Website, portfolio detected
- [ ] **twitter**: Twitter/X field detected
- [ ] **experience**: Years of experience detected
- [ ] **salary**: Salary, compensation detected

**Notes**: _____________________________________________________

---

## ✅ Field Matching - Other

- [ ] **skills**: Skills, expertise detected
- [ ] **languages**: Languages field detected
- [ ] **bio**: Bio, about, summary detected
- [ ] **hobbies**: Hobbies, interests detected
- [ ] **resume**: CV/resume field identified (not filled)
- [ ] **coverLetter**: Cover letter field identified (not filled)

**Notes**: _____________________________________________________

---

## ✅ Keyboard Shortcuts

- [ ] **Alt+F**: Fills current form (Windows/Linux)
- [ ] **Alt+F**: Fills current form (Mac)
- [ ] **Alt+Shift+F**: Opens extension popup
- [ ] **No Conflicts**: Shortcuts don't conflict with other extensions

**Notes**: _____________________________________________________

---

## ✅ Context Menu

- [ ] **Right-click Menu**: "Fill Form" option appears
- [ ] **Fill on Click**: Form fills when option selected
- [ ] **Works on Fields**: Works on individual form fields
- [ ] **Works on Page**: Works on entire page

**Notes**: _____________________________________________________

---

## ✅ Settings & Preferences

- [ ] **Auto-Fill Toggle**: Can enable/disable auto-fill
- [ ] **Guest Mode**: Toggle works
- [ ] **Show Confirmation**: Confirmation popup toggle works
- [ ] **Learn from Forms**: Learning toggle works
- [ ] **Gemini API Key**: Can enter and save API key
- [ ] **Settings Persist**: Settings saved after reload

**Notes**: _____________________________________________________

---

## ✅ Learning System

- [ ] **Manual Fill Detection**: Manually filled field is detected
- [ ] **Pattern Learning**: New patterns are learned
- [ ] **Auto-Apply Learning**: Learned fields auto-fill next time
- [ ] **History Display**: Learning history visible
- [ ] **Multi-field Learning**: Multiple fields learned in one fill

**Notes**: _____________________________________________________

---

## ✅ Special Scenarios

- [ ] **Shadow DOM**: Forms in shadow DOM are detected
- [ ] **iframes**: Nested form in iframe is filled
- [ ] **Lazy-loaded Forms**: Dynamically loaded forms detected
- [ ] **Dropdowns**: Select/option fields populated correctly
- [ ] **Textareas**: Long-form fields like bio work
- [ ] **Hidden Fields**: Hidden fields handled correctly
- [ ] **Pre-filled Fields**: Pre-filled fields respected

**Notes**: _____________________________________________________

---

## ✅ Edge Cases

- [ ] **Empty Profile**: Gracefully handles empty data
- [ ] **Partial Data**: Works with incomplete profiles
- [ ] **Multiple Forms**: Multiple forms on page all fill
- [ ] **Special Characters**: Handles @, #, $, etc. correctly
- [ ] **Very Long Strings**: Long text fields work
- [ ] **Numbers & Symbols**: Numeric/symbol data fills correctly
- [ ] **Unicode**: International characters work

**Notes**: _____________________________________________________

---

## ✅ UI/UX

- [ ] **Popup Responsiveness**: Popup opens quickly
- [ ] **Visual Feedback**: Visual feedback on form fill
- [ ] **Error Messages**: Clear error messages shown
- [ ] **Success Messages**: Confirmation on successful fill
- [ ] **UI Layout**: All buttons/fields visible and accessible
- [ ] **Mobile Responsiveness**: Popup responsive on small screens
- [ ] **Accessibility**: Keyboard navigation works

**Notes**: _____________________________________________________

---

## ✅ Performance

- [ ] **Popup Load Time**: < 500ms
- [ ] **Form Detection**: < 1000ms
- [ ] **Memory Usage**: Reasonable memory consumption
- [ ] **Multiple Fills**: Can fill 10+ times without slowdown
- [ ] **No Memory Leaks**: Memory doesn't increase after 100 fills
- [ ] **Console Clean**: No errors in console

**Notes**: _____________________________________________________

---

## ✅ Backend Integration (if applicable)

- [ ] **Server Running**: Backend server starts without errors
- [ ] **Health Check**: `/health` endpoint responds
- [ ] **Signup Endpoint**: `/api/auth/signup` works
- [ ] **Login Endpoint**: `/api/auth/login` works
- [ ] **Profile Get**: `/api/profile` returns data
- [ ] **Profile Update**: `/api/profile` updates data
- [ ] **Token Validation**: JWT validation works

**Notes**: _____________________________________________________

---

## Summary

**Total Tests**: ___ / ___  
**Passed**: ___  
**Failed**: ___  
**Blocked**: ___  

**Overall Status**: 
- [ ] ✅ All tests passed
- [ ] ⚠️ Some tests failed (see notes)
- [ ] ❌ Critical issues found

**Critical Issues Found**:
_________________________________________________________________

_________________________________________________________________

**Recommendations**:
_________________________________________________________________

_________________________________________________________________

**Sign-off**: _____________________  
**Date**: _____________________
