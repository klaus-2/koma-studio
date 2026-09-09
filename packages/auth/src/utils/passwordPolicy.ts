export interface PasswordRequirementChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
  symbol: boolean;
}

export const getPasswordRequirementChecks = (password: string): PasswordRequirementChecks => ({
  length: password.length >= 12,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  digit: /\d/.test(password),
  symbol: /[^A-Za-z0-9]/.test(password),
});

export const getPasswordPolicyErrors = (password: string): string[] => {
  const checks = getPasswordRequirementChecks(password);
  const errors: string[] = [];

  if (!checks.length) {
    errors.push("Password must be at least 12 characters long.");
  }
  if (!checks.uppercase) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!checks.lowercase) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!checks.digit) {
    errors.push("Password must contain at least one number.");
  }
  if (!checks.symbol) {
    errors.push("Password must contain at least one special symbol.");
  }

  return errors;
};

