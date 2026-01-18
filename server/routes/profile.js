const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/profile - Get user's form data
router.get('/', auth, async (req, res) => {
  try {
    res.json({
      formData: req.user.formData || {},
      profiles: req.user.profiles || {}
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/profile - Update user's form data
router.put('/', auth, async (req, res) => {
  try {
    const { formData, profiles } = req.body;
    
    if (!formData && !profiles) {
      return res.status(400).json({ error: 'formData or profiles is required' });
    }
    
    // Merge existing form data with new data
    const user = await User.findById(req.user._id);
    if (formData) {
      user.formData = {
        ...(user.formData?.toObject?.() || user.formData || {}),
        ...formData
      };
    }
    if (profiles) {
      user.profiles = {
        ...(user.profiles?.toObject?.() || user.profiles || {}),
        ...profiles
      };
    }
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      formData: user.formData,
      profiles: user.profiles
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/profile/field - Update a single field
router.patch('/field', auth, async (req, res) => {
  try {
    const { fieldName, fieldValue } = req.body;
    
    if (!fieldName) {
      return res.status(400).json({ error: 'fieldName is required' });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user.formData) {
      user.formData = {};
    }
    
    // Handle nested custom fields
    if (fieldName.startsWith('customFields.')) {
      const customFieldName = fieldName.replace('customFields.', '');
      if (!user.formData.customFields) {
        user.formData.customFields = {};
      }
      user.formData.customFields[customFieldName] = fieldValue;
    } else {
      user.formData[fieldName] = fieldValue;
    }
    
    user.markModified('formData');
    await user.save();
    
    res.json({
      message: 'Field updated successfully',
      fieldName,
      fieldValue
    });
  } catch (error) {
    console.error('Update field error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
