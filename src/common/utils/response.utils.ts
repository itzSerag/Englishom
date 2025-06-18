/**
 * Utility functions for cleaning response objects before sending to client
 */

/**
 * Remove sensitive fields from user/admin objects before returning to client
 * @param obj - The object to clean
 * @param sensitiveFields - Array of field names to remove (default: ['password'])
 * @returns Cleaned object without sensitive fields
 */
export function cleanSensitiveFields<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: string[] = ['password']
): any {
  if (!obj) return obj;
  
  const cleaned = { ...obj };
  
  // Remove sensitive fields
  sensitiveFields.forEach(field => {
    delete cleaned[field];
  });
  
  // Convert _id to string if it exists
  if ((cleaned as any)?._id) {
    (cleaned as any)._id = (cleaned as any)._id.toString();
  }
  
  return cleaned;
}

/**
 * Clean an array of objects
 * @param array - Array of objects to clean
 * @param sensitiveFields - Array of field names to remove
 * @returns Array of cleaned objects
 */
export function cleanSensitiveFieldsArray<T extends Record<string, any>>(
  array: T[],
  sensitiveFields: string[] = ['password']
): any[] {
  if (!array || !Array.isArray(array)) return array;
  
  return array.map(obj => cleanSensitiveFields(obj, sensitiveFields));
}
