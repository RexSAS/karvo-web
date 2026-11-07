// Same rules and error order as Android LessonValidation.kt.
export const MAX_DURATION_MINUTES = 1440;

export function validateLesson(student, hours, minutes) {
  const total = hours * 60 + minutes, errors = [];
  if (minutes > 59) errors.push('MinutesOver59');
  if (total === 0) errors.push('DurationZero');
  if (total > MAX_DURATION_MINUTES) errors.push('DurationTooLong');
  if (!student.trim()) errors.push('StudentBlank');
  return errors;
}
