const db = require('../../db');
const { audit } = require('../../services/audit');
const { notify } = require('../../services/notify');
const { getStudentsOut } = require('./outpass.stub');
const {
  templateUpdateSchema,
  singlePreferenceSchema,
  batchPreferenceSchema,
  cutoffConfigSchema,
  reportQuerySchema,
  dietPreferenceSchema,
} = require('./food.validation');

/**
 * Get Current Date and Time in Asia/Kolkata Timezone
 */
function getKolkataDateTime(targetDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(targetDate);
  const p = {};
  for (const part of parts) {
    p[part.type] = part.value;
  }

  const year = parseInt(p.year, 10);
  const month = parseInt(p.month, 10);
  const day = parseInt(p.day, 10);
  const hour = parseInt(p.hour, 10);
  const minute = parseInt(p.minute, 10);
  const second = parseInt(p.second, 10);

  const dateStr = `${p.year}-${p.month}-${p.day}`;
  // Reconstruct local equivalent date object for comparison
  const kolkataDateObj = new Date(year, month - 1, day, hour, minute, second);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    kolkataDateObj,
  };
}

/**
 * Retrieve Cutoff Configuration from system_settings
 */
async function getCutoffConfig() {
  try {
    const res = await db.query(`SELECT value FROM system_settings WHERE key = 'food_cutoff_time'`);
    if (res.rows.length > 0) {
      const val = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
      return {
        hour: parseInt(val.hour ?? 21, 10),
        minute: parseInt(val.minute ?? 0, 10),
      };
    }
  } catch (err) {
    console.warn('[FOOD] Cutoff query fallback:', err.message);
  }
  return {
    hour: parseInt(process.env.FOOD_CUTOFF_HOUR || '21', 10),
    minute: parseInt(process.env.FOOD_CUTOFF_MINUTE || '0', 10),
  };
}

/**
 * Check if the cutoff for a target meal date has passed in Asia/Kolkata timezone
 * Rule: For meal date D, cutoff occurs on (D - 1) at cutoffConfig.hour:cutoffConfig.minute IST.
 * 
 * @param {string} targetDateStr - 'YYYY-MM-DD'
 * @param {Object} cutoffConfig - { hour, minute }
 */
function checkMealCutoffStatus(targetDateStr, cutoffConfig) {
  const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
  
  // Cutoff happens on the day prior to targetDate at cutoffConfig.hour:cutoffConfig.minute
  const cutoffTargetDate = new Date(tYear, tMonth - 1, tDay - 1, cutoffConfig.hour, cutoffConfig.minute, 0);

  const nowKolkata = getKolkataDateTime();
  const currentKolkataTime = nowKolkata.kolkataDateObj.getTime();
  const cutoffTime = cutoffTargetDate.getTime();

  const isLocked = currentKolkataTime >= cutoffTime;
  const secondsRemaining = isLocked ? 0 : Math.max(0, Math.floor((cutoffTime - currentKolkataTime) / 1000));

  const pad = n => String(n).padStart(2, '0');
  const cutoffHour12 = cutoffConfig.hour % 12 || 12;
  const ampm = cutoffConfig.hour >= 12 ? 'PM' : 'AM';
  const displayTime = `${pad(cutoffHour12)}:${pad(cutoffConfig.minute)} ${ampm}`;

  return {
    isLocked,
    cutoffHour: cutoffConfig.hour,
    cutoffMinute: cutoffConfig.minute,
    displayTime,
    cutoffDateStr: `${cutoffTargetDate.getFullYear()}-${pad(cutoffTargetDate.getMonth() + 1)}-${pad(cutoffTargetDate.getDate())}`,
    secondsRemaining,
  };
}

/**
 * Convert a Date or 'YYYY-MM-DD' into day_of_week (1 = Monday, 7 = Sunday)
 */
function getDayOfWeek1to7(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const jsDay = dateObj.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  return jsDay === 0 ? 7 : jsDay;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ============================================================================
// 1. WEEKLY MENU TEMPLATES (Admin & Mess Staff Edit, All Users View)
// ============================================================================

/**
 * GET /api/v1/food/template
 * Returns the entire weekly template (28 meals: Monday=1 to Sunday=7)
 */
async function getWeeklyTemplate(req, res) {
  try {
    const { dayOfWeek } = req.query;
    let query = `
      SELECT id, day_of_week, day_name, meal_type, meal_time, veg_items, nonveg_items, nonveg_available, updated_at
      FROM menu_templates
    `;
    const params = [];
    if (dayOfWeek) {
      params.push(parseInt(dayOfWeek, 10));
      query += ` WHERE day_of_week = $1`;
    }

    query += `
      ORDER BY day_of_week ASC,
        CASE meal_type
          WHEN 'breakfast' THEN 1
          WHEN 'lunch' THEN 2
          WHEN 'snacks' THEN 3
          WHEN 'dinner' THEN 4
        END
    `;

    const result = await db.query(query, params);
    const cutoffConfig = await getCutoffConfig();

    return res.status(200).json({
      success: true,
      data: {
        templates: result.rows,
        menus: result.rows,
        cutoffConfig,
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-GET-TEMPLATE] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to fetch menu template: ' + err.message, code: 'TEMPLATE_FETCH_ERROR' },
    });
  }
}

/**
 * PUT /api/v1/food/template/:id
 * Admin / Mess staff updates a template meal's timing, veg items, and nonveg items
 */
async function updateTemplateItem(req, res) {
  try {
    const templateId = parseInt(req.params.id, 10);
    if (!templateId || isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Valid template item ID required in path.', code: 'INVALID_ID' },
      });
    }

    const parseResult = templateUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Invalid template update payload.',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        },
      });
    }

    const { mealTime, vegItems, nonvegItems, nonvegAvailable } = parseResult.data;

    const existing = await db.query('SELECT * FROM menu_templates WHERE id = $1', [templateId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Menu template item not found.', code: 'NOT_FOUND' },
      });
    }

    const updateRes = await db.query(
      `UPDATE menu_templates
       SET meal_time = $1, veg_items = $2, nonveg_items = $3, nonveg_available = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [mealTime, vegItems, nonvegItems || '', nonvegAvailable, templateId]
    );

    const updated = updateRes.rows[0];

    await audit({
      actorId: req.user.id,
      action: 'FOOD_TEMPLATE_UPDATED',
      entity: 'menu_template',
      entityId: templateId,
      details: {
        day: updated.day_name,
        mealType: updated.meal_type,
        mealTime,
        nonvegAvailable,
      },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: `Template for ${updated.day_name} ${updated.meal_type} updated successfully.`,
        template: updated,
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-UPDATE-TEMPLATE] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to update template item: ' + err.message, code: 'TEMPLATE_UPDATE_ERROR' },
    });
  }
}

/**
 * GET /api/v1/food/daily
 * Automatically derives Today's and Tomorrow's menu from the fixed weekly template.
 * No daily posting needed!
 */
async function getDailyMenu(req, res) {
  try {
    const kolkataNow = getKolkataDateTime();
    const todayStr = kolkataNow.dateStr;

    // Calculate tomorrow's date string in Kolkata
    const tomorrowKolkata = new Date(kolkataNow.year, kolkataNow.month - 1, kolkataNow.day + 1);
    const pad = n => String(n).padStart(2, '0');
    const tomorrowStr = `${tomorrowKolkata.getFullYear()}-${pad(tomorrowKolkata.getMonth() + 1)}-${pad(tomorrowKolkata.getDate())}`;

    const todayDayOfWeek = getDayOfWeek1to7(todayStr);
    const tomorrowDayOfWeek = getDayOfWeek1to7(tomorrowStr);

    const templatesRes = await db.query(
      `SELECT * FROM menu_templates 
       WHERE day_of_week IN ($1, $2)
       ORDER BY 
         CASE meal_type 
           WHEN 'breakfast' THEN 1 
           WHEN 'lunch' THEN 2 
           WHEN 'snacks' THEN 3 
           WHEN 'dinner' THEN 4 
         END`,
      [todayDayOfWeek, tomorrowDayOfWeek]
    );

    const todayMeals = templatesRes.rows.filter(r => r.day_of_week === todayDayOfWeek);
    const tomorrowMeals = templatesRes.rows.filter(r => r.day_of_week === tomorrowDayOfWeek);

    const cutoffConfig = await getCutoffConfig();
    const tomorrowCutoff = checkMealCutoffStatus(tomorrowStr, cutoffConfig);

    return res.status(200).json({
      success: true,
      data: {
        serverTimeIST: `${kolkataNow.dateStr} ${pad(kolkataNow.hour)}:${pad(kolkataNow.minute)}:${pad(kolkataNow.second)}`,
        today: {
          date: todayStr,
          dayOfWeek: todayDayOfWeek,
          dayName: DAY_NAMES[todayDayOfWeek],
          meals: todayMeals,
        },
        tomorrow: {
          date: tomorrowStr,
          dayOfWeek: tomorrowDayOfWeek,
          dayName: DAY_NAMES[tomorrowDayOfWeek],
          meals: tomorrowMeals,
        },
        cutoff: tomorrowCutoff,
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-GET-DAILY] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to derive daily menu: ' + err.message, code: 'DAILY_MENU_ERROR' },
    });
  }
}

// ============================================================================
// 2. STUDENT MEAL PREFERENCES (Daily Choices & Profile Diet Preference)
// ============================================================================

/**
 * GET /api/v1/food/preferences?date=YYYY-MM-DD
 * Returns the student's choices for the requested date (defaults to tomorrow).
 * If no explicit choice exists, defaults to student's diet_preference.
 */
async function getStudentPreferences(req, res) {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only registered students can access meal preferences.', code: 'FORBIDDEN' },
      });
    }

    // Determine target date (default to tomorrow in IST)
    const kolkataNow = getKolkataDateTime();
    const pad = n => String(n).padStart(2, '0');
    let targetDateStr = req.query.date;

    if (!targetDateStr) {
      const tomorrowKolkata = new Date(kolkataNow.year, kolkataNow.month - 1, kolkataNow.day + 1);
      targetDateStr = `${tomorrowKolkata.getFullYear()}-${pad(tomorrowKolkata.getMonth() + 1)}-${pad(tomorrowKolkata.getDate())}`;
    }

    // 1. Fetch student diet preference
    const studentRes = await db.query(
      'SELECT id, diet_preference FROM students WHERE id = $1',
      [studentId]
    );
    const studentDietPref = studentRes.rows[0]?.diet_preference || 'veg';

    // 2. Derive menu template for target date's weekday
    const dayOfWeek = getDayOfWeek1to7(targetDateStr);
    const templateRes = await db.query(
      `SELECT * FROM menu_templates 
       WHERE day_of_week = $1
       ORDER BY 
         CASE meal_type 
           WHEN 'breakfast' THEN 1 
           WHEN 'lunch' THEN 2 
           WHEN 'snacks' THEN 3 
           WHEN 'dinner' THEN 4 
         END`,
      [dayOfWeek]
    );

    // 3. Fetch explicit choices from meal_preferences
    const prefsRes = await db.query(
      `SELECT * FROM meal_preferences WHERE student_id = $1 AND date = $2`,
      [studentId, targetDateStr]
    );

    const choiceMap = new Map();
    prefsRes.rows.forEach(p => {
      choiceMap.set(p.meal_type, {
        id: p.id,
        choice: p.choice,
        updatedAt: p.updated_at,
        isExplicit: true,
      });
    });

    const cutoffConfig = await getCutoffConfig();
    const cutoffStatus = checkMealCutoffStatus(targetDateStr, cutoffConfig);

    // 4. Construct response per meal
    const meals = templateRes.rows.map(m => {
      const explicit = choiceMap.get(m.meal_type);
      
      // Default rule: If no explicit choice, use profile diet_preference
      // BUT if student prefers non_veg but this meal has nonveg_available = false, default to 'veg'
      let effectiveChoice = 'veg';
      if (explicit) {
        effectiveChoice = explicit.choice;
      } else {
        effectiveChoice = (studentDietPref === 'non_veg' && m.nonveg_available) ? 'non_veg' : 'veg';
      }

      return {
        mealType: m.meal_type,
        mealTime: m.meal_time,
        vegItems: m.veg_items,
        nonvegItems: m.nonveg_items,
        nonvegAvailable: m.nonveg_available,
        choice: effectiveChoice,
        isExplicit: !!explicit,
        updatedAt: explicit?.updatedAt || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        date: targetDateStr,
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        studentDietPreference: studentDietPref,
        cutoff: cutoffStatus,
        meals,
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-GET-PREFERENCES] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to retrieve meal preferences: ' + err.message, code: 'PREFERENCES_FETCH_ERROR' },
    });
  }
}

/**
 * POST /api/v1/food/preferences
 * Confirms or changes daily meal choice before cutoff.
 * Supports single { date, mealType, choice } or batch { date, choices: [...] }.
 * Enforces:
 * 1. 9:00 PM Asia/Kolkata cutoff lock
 * 2. nonveg_available validation (rejects non-veg if nonveg_available is false)
 */
async function submitMealPreference(req, res) {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only registered students can submit meal preferences.', code: 'FORBIDDEN' },
      });
    }

    // Normalize aliases for compatibility with foundation tests and REST clients
    if (req.body.mealDate && !req.body.date) {
      req.body.date = req.body.mealDate;
    }
    if (!req.body.choice && req.body.selectedOptionId) {
      req.body.choice = req.body.selectedOptionId.toLowerCase().includes('non') ? 'non_veg' : 'veg';
    }

    // Determine if payload is batch or single
    let targetDate = '';
    let choicesToApply = [];

    if (Array.isArray(req.body.choices)) {
      const parseResult = batchPreferenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'Invalid batch preference payload.',
            code: 'VALIDATION_ERROR',
            details: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
          },
        });
      }
      targetDate = parseResult.data.date;
      choicesToApply = parseResult.data.choices;
    } else {
      const parseResult = singlePreferenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'Invalid meal preference payload.',
            code: 'VALIDATION_ERROR',
            details: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
          },
        });
      }
      targetDate = parseResult.data.date;
      choicesToApply = [{ mealType: parseResult.data.mealType, choice: parseResult.data.choice }];
    }

    // 1. Enforce Cut-off in Asia/Kolkata timezone
    const cutoffConfig = await getCutoffConfig();
    const cutoffStatus = checkMealCutoffStatus(targetDate, cutoffConfig);

    if (cutoffStatus.isLocked) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: `Cut-off time has passed for ${targetDate} (locked daily at ${cutoffStatus.displayTime} IST). Changes are strictly prohibited.`,
          code: 'PREFERENCE_LOCKED',
          details: cutoffStatus,
        },
      });
    }

    // 2. Enforce nonveg_available rule on the server
    const dayOfWeek = getDayOfWeek1to7(targetDate);
    const templatesRes = await db.query(
      `SELECT meal_type, nonveg_available FROM menu_templates WHERE day_of_week = $1`,
      [dayOfWeek]
    );

    const templateMap = new Map();
    templatesRes.rows.forEach(t => templateMap.set(t.meal_type, t.nonveg_available));

    for (const item of choicesToApply) {
      if (item.choice === 'non_veg') {
        const isNonvegAllowed = templateMap.get(item.mealType);
        if (!isNonvegAllowed) {
          item.choice = 'veg';
        }
      }
    }

    // 3. Upsert into meal_preferences
    const saved = [];
    for (const item of choicesToApply) {
      const upsertRes = await db.query(
        `INSERT INTO meal_preferences (student_id, date, meal_type, choice, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (student_id, date, meal_type)
         DO UPDATE SET choice = EXCLUDED.choice, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [studentId, targetDate, item.mealType, item.choice]
      );
      saved.push(upsertRes.rows[0]);
    }

    await audit({
      actorId: req.user.id,
      action: 'MEAL_PREFERENCE_CONFIRMED',
      entity: 'meal_preference',
      entityId: saved[0]?.id,
      details: {
        date: targetDate,
        choices: choicesToApply,
      },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Your meal preference has been confirmed successfully.',
        date: targetDate,
        preferences: saved,
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-SUBMIT-PREFERENCE] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to record preference: ' + err.message, code: 'PREFERENCE_SAVE_ERROR' },
    });
  }
}

/**
 * PUT /api/v1/food/diet-preference
 * Allows student to update their default registered diet_preference ('veg' | 'non_veg')
 */
async function updateStudentDietPreference(req, res) {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only students can update diet preference.', code: 'FORBIDDEN' },
      });
    }

    const parseResult = dietPreferenceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Invalid diet preference. Must be veg or non_veg.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const { dietPreference } = parseResult.data;

    await db.query(
      `UPDATE students SET diet_preference = $1 WHERE id = $2`,
      [dietPreference, studentId]
    );

    await audit({
      actorId: req.user.id,
      action: 'STUDENT_DIET_PREF_UPDATED',
      entity: 'student',
      entityId: studentId,
      details: { dietPreference },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: `Default diet preference updated to ${dietPreference === 'non_veg' ? 'Non-Vegetarian' : 'Vegetarian'}.`,
        dietPreference,
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-UPDATE-DIET-PREF] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to update diet preference.', code: 'DIET_UPDATE_ERROR' },
    });
  }
}

// ============================================================================
// 3. KITCHEN COUNT REPORT (Kitchen Mess Staff, Admin & Wardens)
// ============================================================================

/**
 * Helper to compute count aggregations
 */
async function calculateMealCounts({ date, mealType, blockScope, targetBlockId }) {
  // 1. Fetch Students Out on Approved Outpass (Contract Hook)
  const excludedStudentIds = await getStudentsOut(date, mealType || 'any');

  // 2. Query Eligible Active Students
  let studentQuery = `
    SELECT s.id, s.full_name, s.gender, s.diet_preference, s.block_id, b.name AS block_name, b.code AS block_code
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN blocks b ON b.id = s.block_id
    WHERE u.status = 'active'
  `;
  const studentParams = [];

  // Scoping: Wardens are restricted to their assigned blockId and gender
  if (blockScope && !blockScope.isGlobal) {
    studentParams.push(blockScope.blockId);
    studentQuery += ` AND s.block_id = $${studentParams.length}`;
    if (blockScope.gender) {
      studentParams.push(blockScope.gender);
      studentQuery += ` AND s.gender = $${studentParams.length}`;
    }
  } else if (targetBlockId) {
    studentParams.push(targetBlockId);
    studentQuery += ` AND s.block_id = $${studentParams.length}`;
  }

  studentQuery += ` ORDER BY b.code ASC, s.full_name ASC`;

  const studentsRes = await db.query(studentQuery, studentParams);
  const allEligibleStudents = studentsRes.rows;

  // Filter out students on approved outpass
  const presentStudents = allEligibleStudents.filter(s => !excludedStudentIds.includes(s.id));

  // 3. Query Day Templates
  const dayOfWeek = getDayOfWeek1to7(date);
  let templateQuery = `
    SELECT * FROM menu_templates 
    WHERE day_of_week = $1
  `;
  const templateParams = [dayOfWeek];
  if (mealType && mealType !== 'all') {
    templateParams.push(mealType);
    templateQuery += ` AND meal_type = $2`;
  }
  templateQuery += `
    ORDER BY 
      CASE meal_type 
        WHEN 'breakfast' THEN 1 
        WHEN 'lunch' THEN 2 
        WHEN 'snacks' THEN 3 
        WHEN 'dinner' THEN 4 
      END
  `;
  const templatesRes = await db.query(templateQuery, templateParams);

  // 4. Query Explicit Preferences for this Date
  const prefsRes = await db.query(
    `SELECT student_id, meal_type, choice FROM meal_preferences WHERE date = $1`,
    [date]
  );
  const prefMap = new Map();
  prefsRes.rows.forEach(p => {
    prefMap.set(`${p.student_id}_${p.meal_type}`, p.choice);
  });

  // 5. Aggregate per meal and block
  const mealsReport = [];

  for (const t of templatesRes.rows) {
    const mType = t.meal_type;
    let vegCount = 0;
    let nonvegCount = 0;
    const blockBreakdown = {};

    for (const st of presentStudents) {
      // Preference logic: explicit choice, OR student's diet_preference
      const explicitChoice = prefMap.get(`${st.id}_${mType}`);
      let finalChoice = 'veg';

      if (explicitChoice) {
        finalChoice = explicitChoice;
      } else {
        // Default choice: profile diet_preference
        finalChoice = (st.diet_preference === 'non_veg' && t.nonveg_available) ? 'non_veg' : 'veg';
      }

      if (finalChoice === 'non_veg' && t.nonveg_available) {
        nonvegCount++;
      } else {
        vegCount++;
      }

      // Group by Block
      if (!blockBreakdown[st.block_id]) {
        blockBreakdown[st.block_id] = {
          blockId: st.block_id,
          blockName: st.block_name,
          blockCode: st.block_code,
          gender: st.gender,
          totalStudents: 0,
          vegCount: 0,
          nonvegCount: 0,
        };
      }
      blockBreakdown[st.block_id].totalStudents++;
      if (finalChoice === 'non_veg' && t.nonveg_available) {
        blockBreakdown[st.block_id].nonvegCount++;
      } else {
        blockBreakdown[st.block_id].vegCount++;
      }
    }

    mealsReport.push({
      mealType: mType,
      mealTime: t.meal_time,
      vegItems: t.veg_items,
      nonvegItems: t.nonveg_items,
      nonvegAvailable: t.nonveg_available,
      totalStudents: allEligibleStudents.length,
      outpassExcluded: allEligibleStudents.length - presentStudents.length,
      expectedEaters: presentStudents.length,
      vegCount,
      nonvegCount,
      byBlock: Object.values(blockBreakdown),
    });
  }

  return {
    date,
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    totalEligibleStudents: allEligibleStudents.length,
    outpassExcludedCount: allEligibleStudents.length - presentStudents.length,
    expectedEaters: presentStudents.length,
    meals: mealsReport,
    studentList: presentStudents,
  };
}

/**
 * GET /api/v1/food/report
 * Returns the count report for a selected date, meal and block.
 * Mess staff and admin see all blocks; wardens see only their own block and gender.
 */
async function getMealReport(req, res) {
  try {
    const parseResult = reportQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Invalid report query parameters.', code: 'VALIDATION_ERROR' },
      });
    }

    const kolkataNow = getKolkataDateTime();
    const pad = n => String(n).padStart(2, '0');
    let targetDate = parseResult.data.date;

    if (!targetDate) {
      const tomorrowKolkata = new Date(kolkataNow.year, kolkataNow.month - 1, kolkataNow.day + 1);
      targetDate = `${tomorrowKolkata.getFullYear()}-${pad(tomorrowKolkata.getMonth() + 1)}-${pad(tomorrowKolkata.getDate())}`;
    }

    const { mealType, blockId, page, limit } = parseResult.data;

    // Determine Block Scoping (Wardens locked to their block & gender)
    const blockScope = req.scope || req.blockScope || null;

    const report = await calculateMealCounts({
      date: targetDate,
      mealType,
      blockScope,
      targetBlockId: blockId,
    });

    // Simple pagination for student roster
    const totalStudents = report.studentList.length;
    const startIndex = (page - 1) * limit;
    const paginatedStudents = report.studentList.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      success: true,
      data: {
        date: report.date,
        dayName: report.dayName,
        totalEligibleStudents: report.totalEligibleStudents,
        outpassExcludedCount: report.outpassExcludedCount,
        expectedEaters: report.expectedEaters,
        meals: report.meals,
        pagination: {
          total: totalStudents,
          page,
          limit,
          totalPages: Math.ceil(totalStudents / limit) || 1,
        },
        students: paginatedStudents.map(s => ({
          id: s.id,
          name: s.full_name,
          block: s.block_name,
          dietPreference: s.diet_preference,
        })),
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-GET-REPORT] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to generate meal count report: ' + err.message, code: 'REPORT_GEN_ERROR' },
    });
  }
}

/**
 * GET /api/v1/food/report/export
 * Downloads the count report as a formatted CSV file
 */
async function exportMealReportCSV(req, res) {
  try {
    const kolkataNow = getKolkataDateTime();
    const pad = n => String(n).padStart(2, '0');
    let targetDate = req.query.date;

    if (!targetDate) {
      const tomorrowKolkata = new Date(kolkataNow.year, kolkataNow.month - 1, kolkataNow.day + 1);
      targetDate = `${tomorrowKolkata.getFullYear()}-${pad(tomorrowKolkata.getMonth() + 1)}-${pad(tomorrowKolkata.getDate())}`;
    }

    const mealType = req.query.mealType || 'all';
    const blockId = req.query.blockId ? parseInt(req.query.blockId, 10) : undefined;
    const blockScope = req.scope || req.blockScope || null;

    const report = await calculateMealCounts({
      date: targetDate,
      mealType,
      blockScope,
      targetBlockId: blockId,
    });

    // Construct CSV content
    const headers = [
      'Date',
      'Day',
      'Meal Type',
      'Timing',
      'Block Name',
      'Block Code',
      'Gender',
      'Total Registered',
      'Veg Count',
      'Non-Veg Count',
      'Non-Veg Allowed',
    ];

    const rows = [];

    for (const m of report.meals) {
      if (m.byBlock.length === 0) {
        rows.push([
          report.date,
          report.dayName,
          m.mealType.toUpperCase(),
          `"${m.mealTime}"`,
          'All Blocks',
          'ALL',
          'All',
          m.expectedEaters,
          m.vegCount,
          m.nonvegCount,
          m.nonvegAvailable ? 'YES' : 'NO',
        ].join(','));
      } else {
        for (const b of m.byBlock) {
          rows.push([
            report.date,
            report.dayName,
            m.mealType.toUpperCase(),
            `"${m.mealTime}"`,
            `"${b.blockName}"`,
            b.blockCode,
            b.gender,
            b.totalStudents,
            b.vegCount,
            b.nonvegCount,
            m.nonvegAvailable ? 'YES' : 'NO',
          ].join(','));
        }
      }
    }

    const csvData = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="HostelPulse-Kitchen-Report-${targetDate}.csv"`);
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('[FOOD-EXPORT-CSV] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to export CSV report: ' + err.message, code: 'CSV_EXPORT_ERROR' },
    });
  }
}

// ============================================================================
// 4. CUTOFF SETTINGS (Admin & Mess Staff)
// ============================================================================

/**
 * GET /api/v1/food/cutoff
 */
async function getCutoffConfigHandler(req, res) {
  try {
    const config = await getCutoffConfig();
    const pad = n => String(n).padStart(2, '0');
    const hour12 = config.hour % 12 || 12;
    const ampm = config.hour >= 12 ? 'PM' : 'AM';

    return res.status(200).json({
      success: true,
      data: {
        hour: config.hour,
        minute: config.minute,
        displayTime: `${pad(hour12)}:${pad(config.minute)} ${ampm}`,
        timezone: 'Asia/Kolkata',
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to retrieve cutoff time.', code: 'CUTOFF_FETCH_ERROR' },
    });
  }
}

/**
 * PUT /api/v1/food/cutoff
 */
async function updateCutoffConfig(req, res) {
  try {
    const parseResult = cutoffConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'Cutoff time requires valid hour (0-23) and minute (0-59).',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const { hour, minute } = parseResult.data;
    const valueObj = { hour, minute };

    await db.query(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES ('food_cutoff_time', $1, 'Daily meal preference locking cut-off time', CURRENT_TIMESTAMP)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(valueObj)]
    );

    await audit({
      actorId: req.user.id,
      action: 'FOOD_CUTOFF_CONFIG_UPDATED',
      entity: 'system_setting',
      entityId: 'food_cutoff_time',
      details: valueObj,
      ipAddress: req.ip,
    });

    const pad = n => String(n).padStart(2, '0');
    const hour12 = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';

    return res.status(200).json({
      success: true,
      data: {
        message: `Cut-off time updated to ${pad(hour12)}:${pad(minute)} ${ampm} IST.`,
        cutoffConfig: valueObj,
      },
      error: null,
    });
  } catch (err) {
    console.error('[FOOD-UPDATE-CUTOFF] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to update cut-off configuration.', code: 'CUTOFF_UPDATE_ERROR' },
    });
  }
}

module.exports = {
  getWeeklyTemplate,
  updateTemplateItem,
  getDailyMenu,
  getStudentPreferences,
  submitMealPreference,
  updateStudentDietPreference,
  getMealReport,
  exportMealReportCSV,
  getCutoffConfigHandler,
  updateCutoffConfig,
};
