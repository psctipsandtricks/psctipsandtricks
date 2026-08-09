import * as Yup from 'yup';

export const emailSchema = Yup.string().trim().email('Enter a valid email address').required('Email is required');

export const passwordSchema = Yup.string()
  .min(6, 'Password must be at least 6 characters')
  .required('Password is required');
