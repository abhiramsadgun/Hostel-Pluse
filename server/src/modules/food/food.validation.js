const { z } = require('zod');

// Schema for updating a menu template row (day_of_week + meal_type)
const templateUpdateSchema = z.object({
  mealTime: z.string().min(3, 'Meal timing is required').max(50),
  vegItems: z.string().min(3, 'Vegetarian menu items are required').max(500),
  nonvegItems: z.string().max(500).optional().default(''),
  nonvegAvailable: z.boolean().default(false),
});

// Single meal preference submission
const singlePreferenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mealType: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
  choice: z.enum(['veg', 'non_veg']),
});

// Batch meal preference submission
const batchPreferenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  choices: z.array(
    z.object({
      mealType: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
      choice: z.enum(['veg', 'non_veg']),
    })
  ).min(1, 'At least one meal preference choice is required'),
});

// Cutoff configuration schema
const cutoffConfigSchema = z.object({
  hour: z.coerce.number().int().min(0).max(23, 'Hour must be between 0 and 23'),
  minute: z.coerce.number().int().min(0).max(59, 'Minute must be between 0 and 59'),
});

// Report query schema
const reportQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'snacks', 'dinner', 'all']).optional(),
  blockId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// Student default diet preference schema
const dietPreferenceSchema = z.object({
  dietPreference: z.enum(['veg', 'non_veg'], {
    required_error: 'Diet preference must be veg or non_veg',
  }),
});

module.exports = {
  templateUpdateSchema,
  singlePreferenceSchema,
  batchPreferenceSchema,
  cutoffConfigSchema,
  reportQuerySchema,
  dietPreferenceSchema,
};
