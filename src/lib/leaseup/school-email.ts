export type SchoolEmailLike = { verified_email?: boolean | null } | null | undefined;

export function hasSchoolEmail(profile: SchoolEmailLike): boolean {
  return !!profile?.verified_email;
}

export const SCHOOL_EMAIL_BADGE = "School email";
export const SCHOOL_EMAIL_LINE = "Signed up with a school email";
export const NO_SCHOOL_EMAIL_LINE = "No school email on file";
