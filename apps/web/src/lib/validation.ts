import * as Yup from 'yup';

export const COMMON_EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.com.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co.in': 'yahoo.co.in',
  'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'hotmai.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlock.com': 'outlook.com',
  'iclud.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'icloud.con': 'icloud.com',
  'icloud.co': 'icloud.com',
  'redifmail.com': 'rediffmail.com',
  'rediff.com': 'rediffmail.com',
  'rediffmail.con': 'rediffmail.com',
};

export const INVALID_EMAIL_TLDS = new Set(['con', 'cmo', 'coom', 'cm', 'ocm', 'comm']);

export function getEmailValidationError(email?: string | null): string | null {
  const normEmail = (email || '').trim().toLowerCase();
  if (!normEmail) {
    return 'Email is required';
  }

  // 1. Strict regex format check
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(normEmail) || normEmail.includes('..')) {
    return 'Enter a valid email address (e.g. name@example.com)';
  }

  const parts = normEmail.split('@');
  if (parts.length !== 2) {
    return 'Enter a valid email address';
  }

  const [userPart, domain] = parts;
  if (!userPart || userPart.startsWith('.') || userPart.endsWith('.')) {
    return 'Enter a valid email username';
  }

  if (!domain || domain.length < 3 || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return 'Enter a valid email domain';
  }

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return 'Enter a valid email domain extension';
  }

  if (INVALID_EMAIL_TLDS.has(tld)) {
    return `Misspelled email domain ending (.${tld}). Did you mean .com?`;
  }

  const typoCorrection = COMMON_EMAIL_DOMAIN_TYPOS[domain];
  if (typoCorrection) {
    return `Invalid email address. Did you mean "${userPart}@${typoCorrection}"?`;
  }

  return null;
}

export const emailSchema = Yup.string()
  .trim()
  .required('Email is required')
  .test('is-valid-email', function (value) {
    const error = getEmailValidationError(value);
    if (error) {
      return this.createError({ message: error });
    }
    return true;
  });

export const passwordSchema = Yup.string()
  .min(6, 'Password must be at least 6 characters')
  .required('Password is required');
