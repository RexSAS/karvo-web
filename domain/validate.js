// Same rules and error order as Android LessonValidation.kt.
export const MAX_DURATION_MINUTES = 1440;

/** Hours/minutes input box → whole number ≥ 0 (blank = 0), or NaN. */
export const parseDurationField = text => text.trim() === '' ? 0 : /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;

export function validateLesson(student, hours, minutes) {
  const total = hours * 60 + minutes, errors = [];
  if (minutes > 59) errors.push('MinutesOver59');
  if (total === 0) errors.push('DurationZero');
  if (total > MAX_DURATION_MINUTES) errors.push('DurationTooLong');
  if (!student.trim()) errors.push('StudentBlank');
  return errors;
}
