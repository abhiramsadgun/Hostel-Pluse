const express = require('express');
const router = express.Router();
const foodController = require('./food.controller');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeToBlock } = require('../../middleware/scopeToBlock');

// 1. Weekly Menu Templates & Daily Derived Menus
router.get('/menu', (req, res, next) => foodController.getWeeklyTemplate(req, res, next));
router.get('/template', authenticate, foodController.getWeeklyTemplate);
router.put('/template/:id', authenticate, requireRole('admin', 'mess'), foodController.updateTemplateItem);
router.get('/daily', authenticate, foodController.getDailyMenu);

// 2. Student Preferences & Choices
router.get('/preferences', authenticate, requireRole('student'), foodController.getStudentPreferences);
router.post('/preferences', authenticate, requireRole('student'), foodController.submitMealPreference);
router.put('/diet-preference', authenticate, requireRole('student'), foodController.updateStudentDietPreference);

// 3. Kitchen Count Report & CSV Export
router.get('/report', authenticate, requireRole('admin', 'mess', 'warden'), scopeToBlock, foodController.getMealReport);
router.get('/report/export', authenticate, requireRole('admin', 'mess', 'warden'), scopeToBlock, foodController.exportMealReportCSV);

const { sendNightlyReminderJob } = require('./reminder.cron');

// 4. Cut-Off Time Settings
router.get('/cutoff', authenticate, foodController.getCutoffConfigHandler);
router.put('/cutoff', authenticate, requireRole('admin', 'mess'), foodController.updateCutoffConfig);

// 5. Test/Manual Reminder Trigger (Admin / Mess)
router.post('/reminder/trigger', authenticate, requireRole('admin', 'mess'), async (req, res) => {
  const result = await sendNightlyReminderJob();
  return res.status(200).json({ success: true, data: result, error: null });
});

module.exports = router;
