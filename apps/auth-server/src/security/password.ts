import zxcvbn from "zxcvbn";

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number;
  suggestions: string[];
}

const commonPatterns = [/123456/i, /password/i, /qwerty/i, /abc123/i, /letmein/i];

const hasUppercase = (value: string): boolean => /[A-Z]/.test(value);
const hasLowercase = (value: string): boolean => /[a-z]/.test(value);
const hasDigit = (value: string): boolean => /\d/.test(value);
const hasSymbol = (value: string): boolean => /[^A-Za-z0-9]/.test(value);

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters");
  }
  if (!hasUppercase(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!hasLowercase(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!hasDigit(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!hasSymbol(password)) {
    errors.push("Password must contain at least one special character");
  }

  if (commonPatterns.some((pattern) => pattern.test(password))) {
    errors.push("Password contains a common pattern. Choose a more unique password");
  }

  const strength = zxcvbn(password);
  if (strength.score < 3) {
    errors.push(`Password is too weak (${strength.score}/4)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: strength.score,
    suggestions: strength.feedback.suggestions,
  };
};
