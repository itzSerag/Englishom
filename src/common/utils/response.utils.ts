

/**
 * Public function to clean a single object
 * Removes sensitive fields and normalizes IDs
 */
export function cleanResponse<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: string[] = ['password', 'otp', '__v'],
): T {
  if (!obj) return obj;

  let cleaned = { ...obj };

  // Remove sensitive fields
  for (const field of sensitiveFields) {
    delete cleaned[field];
  }
  // Normalize _id/id/userId to consistent strings
  cleaned = normalizeObject(cleaned);
  return cleaned;
}


/**
 * Internal helper to normalize MongoDB ObjectId fields to strings
 * Keeps _id format for consistency across the app
 */
function normalizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj) return obj;

  const clone = { ...obj } as any;

  // Convert _id to string if it exists
  if (clone._id && typeof clone._id === 'object') {
    clone._id = clone._id.toString();
  }

  // Convert userId to string if it exists and is an ObjectId
  if (clone.userId && typeof clone.userId === 'object') {
    clone.userId = clone.userId.toString();
  }

  return clone;
}


/**
 * Public function to clean an array of objects
 * Applies cleanResponse to each element
 */
export function cleanResponseArray<T extends Record<string, any>>(
  array: T[],
  sensitiveFields: string[] = ['password', 'otp', '__v'],
): T[] {
  if (!Array.isArray(array)) return array;

  return array.map((item) => cleanResponse(item, sensitiveFields));
}

/**
 * Normalize ObjectId fields to strings without changing field names
 * For backward compatibility with existing code - keeps _id format
 */
export function normalizeObjectIds<T extends Record<string, any>>(obj: T): T {
  if (!obj) return obj;

  const normalized = { ...obj } as any;

  // Convert _id to string if it exists (keep the field name)
  if (normalized._id && typeof normalized._id === 'object') {
    normalized._id = normalized._id.toString();
  }

  // Convert userId to string if it exists and is an ObjectId
  if (normalized.userId && typeof normalized.userId === 'object') {
    normalized.userId = normalized.userId.toString();
  }

  return normalized;
}
