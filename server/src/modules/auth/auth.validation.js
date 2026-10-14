const { z } = require('zod');

const studentRegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(150),
  rollNumber: z.string().min(3, 'Roll number is required').max(50),
  laminatedIdNumber: z.string().min(3, 'Laminated hostel ID number is required').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[0-9+() -]{7,20}$/, 'Invalid phone number (7-20 digits)'),
  gender: z.enum(['male', 'female'], { errorMap: () => ({ message: 'Gender must be male or female' }) }),
  blockId: z.coerce.number().int().positive('Please select a valid hostel block'),
  className: z.string().min(2, 'Class/Degree is required (e.g., B.Tech CSE)').max(50),
  academicYear: z.coerce.number().int().min(1).max(5, 'Academic year must be between 1 and 5'),
  parentName: z.string().min(2, 'Parent name is required').max(150),
  parentPhone: z.string().regex(/^[0-9+() -]{7,20}$/, 'Invalid parent phone number'),
  emergencyContact: z.string().regex(/^[0-9+() -]{7,20}$/, 'Invalid emergency contact number'),
  allergies: z.string().max(500).optional().default('None'),
  dietPreference: z.enum(['veg', 'non_veg']).optional().default('veg'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const wardenRegisterSchema = z.object({
  collegeIdNumber: z.string().min(3, 'College ID number is required').max(50),
  fullName: z.string().min(2, 'Full name is required').max(150),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[0-9+() -]{7,20}$/, 'Invalid phone number'),
  gender: z.enum(['male', 'female'], { errorMap: () => ({ message: 'Gender must be male or female' }) }),
  blockId: z.coerce.number().int().positive('Please select an assigned block'),
  isNightDeputy: z.coerce.boolean().optional().default(false),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier (Laminated ID, College ID, or Email) is required'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email address is required'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Valid email address is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const studentApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

module.exports = {
  studentRegisterSchema,
  wardenRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  studentApprovalSchema,
};
