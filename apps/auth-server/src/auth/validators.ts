export interface LoginInput {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface RegisterInput extends LoginInput {
  name?: string;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const sanitizeName = (name: string | undefined): string => {
  if (!name) {
    return "";
  }

  return name.replace(/[<>]/g, "").trim().slice(0, 120);
};
