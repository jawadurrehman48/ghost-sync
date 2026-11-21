/** Input limits: keep text readable on a 360px screen and stop pathological input. */
export const LIMITS = {
  name: 60,
  phone: 20,
  reason: 120,
  notes: 500,
  clinicName: 60,
  maxAge: 120,
} as const;
