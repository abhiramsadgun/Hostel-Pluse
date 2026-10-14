const { z } = require('zod');

const submitComplaintSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  categoryKey: z.string().optional(),
  isAnonymous: z.union([z.boolean(), z.string().transform(v => v === 'true' || v === true)]).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Reopened']),
  notes: z.string().optional(),
});

const assignStaffSchema = z.object({
  staffId: z.coerce.number().int().positive('Valid staff ID required'),
  note: z.string().optional(),
});

const resolveComplaintSchema = z.object({
  notes: z.string().min(3, 'Completion notes required'),
});

const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5 stars'),
  comments: z.string().optional(),
});

const categorySchema = z.object({
  name: z.string().min(3),
  key: z.string().min(2),
  department: z.string().default('maintenance'),
  severityWeight: z.coerce.number().int().min(1).max(100),
  slaHours: z.coerce.number().int().min(1).max(168),
  description: z.string().optional(),
});

module.exports = {
  submitComplaintSchema,
  updateStatusSchema,
  assignStaffSchema,
  resolveComplaintSchema,
  feedbackSchema,
  categorySchema,
};
