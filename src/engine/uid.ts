let counter = 0;

/**
 * Monotonic unique ID generator. Date.now() alone is not enough — scenario
 * generators can run twice within the same millisecond (e.g. repeated sandbox
 * runs), which produced duplicate React list keys. The counter guarantees
 * uniqueness within the session even for same-ms bursts.
 */
export const uid = (prefix: string): string => {
  counter = (counter + 1) % 0xffffff;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
};