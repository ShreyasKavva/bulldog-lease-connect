/**
 * Q174 — seeded sample listings are all owned by one placeholder account
 * ("LeaseUp Demo"). Nobody can sign into it, so messages sent there will never
 * get a reply. We label those listings instead of silently swallowing the send.
 */
export const DEMO_USER_ID = "d0000000-0000-4000-8000-000000000001";

export function isDemoListing(userId?: string | null) {
  return userId === DEMO_USER_ID;
}
