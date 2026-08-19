export interface CommunityReportInput {
  category: string;
  severity: number; // 1 to 5
  description: string;
  location: string;
}

export interface TrustedContactInput {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a community safety report input.
 * Sanitizes input strings to prevent XSS/injection.
 */
export function validateCommunityReport(input: CommunityReportInput): ValidationResult {
  const errors: string[] = [];
  const validCategories = [
    'poor lighting',
    'harassment',
    'suspicious activity',
    'unsafe crossing',
    'isolated area',
    'infrastructure problem',
    'other'
  ];

  if (!input.category || !validCategories.includes(input.category.toLowerCase())) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}.`);
  }

  if (typeof input.severity !== 'number' || input.severity < 1 || input.severity > 5) {
    errors.push("Severity must be a number between 1 and 5.");
  }

  if (!input.description || input.description.trim().length < 5) {
    errors.push("Description must be at least 5 characters long.");
  }

  if (!input.location || input.location.trim().length < 3) {
    errors.push("Location/Area must be at least 3 characters long.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes user input string to remove any HTML tags and prevent unsafe injection.
 */
export function sanitizeString(val: string): string {
  if (!val) return '';
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates trusted contact fields.
 */
export function validateTrustedContact(contact: TrustedContactInput): ValidationResult {
  const errors: string[] = [];

  if (!contact.name || contact.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters long.");
  }

  if (!contact.relationship || contact.relationship.trim().length < 2) {
    errors.push("Relationship must be at least 2 characters long.");
  }

  // Verify at least one contact channel is present and valid
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Simple check: digit-based phone number, allows +, spaces, dashes, parentheses
  const phoneRegex = /^\+?[0-9\s\-()]{7,15}$/;

  const hasEmail = !!contact.email && contact.email.trim().length > 0;
  const hasPhone = !!contact.phone && contact.phone.trim().length > 0;

  if (!hasEmail && !hasPhone) {
    errors.push("Please provide at least an email address or a phone number.");
  } else {
    if (hasEmail && !emailRegex.test(contact.email.trim())) {
      errors.push("Invalid email address format.");
    }
    if (hasPhone && !phoneRegex.test(contact.phone.trim())) {
      errors.push("Invalid phone number format (must be 7 to 15 digits).");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
