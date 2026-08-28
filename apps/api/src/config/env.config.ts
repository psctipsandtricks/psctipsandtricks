import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(4000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().default('super-secret-psc-jwt-key-2026'),
  JWT_REFRESH_SECRET: Joi.string().default('super-secret-psc-refresh-jwt-key-2026'),
  SUPABASE_URL: Joi.string().allow('').optional(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').optional(),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().default('http://localhost:4000/auth/google/callback'),
  // Platform OAuth client IDs, accepted as audiences on /auth/google/native in
  // addition to GOOGLE_CLIENT_ID. Only needed for a mobile build configured to
  // request a token for its own client rather than the web one.
  GOOGLE_ANDROID_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_IOS_CLIENT_ID: Joi.string().allow('').optional(),
  APPLE_CLIENT_ID: Joi.string().allow('').optional(),
  APPLE_TEAM_ID: Joi.string().allow('').optional(),
  APPLE_KEY_ID: Joi.string().allow('').optional(),
  APPLE_PRIVATE_KEY: Joi.string().allow('').optional(),
  APPLE_CALLBACK_URL: Joi.string().default('http://localhost:4000/auth/apple/callback'),
  RAZORPAY_KEY_ID: Joi.string().allow('').optional(),
  RAZORPAY_KEY_SECRET: Joi.string().allow('').optional(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  RAZORPAY_MODE: Joi.string().valid('test', 'live', 'demo').default('test'),
  // Firebase Cloud Messaging service account — from Firebase console >
  // Project settings > Service accounts > Generate new private key. All three
  // are optional: without them notifications are still saved and readable in
  // the app, they just are not pushed.
  FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
});
