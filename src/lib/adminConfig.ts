// Create a new file: lib/adminConfig.ts
export const ADMIN_EMAILS = [
  'ithatejesh@gmail.com',
  'ivsntejesh@gmail.com'
];

export const isUserAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};