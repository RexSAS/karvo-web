// Same as Android ImportPlan.kt: a duplicate is same date, duration and student (case/space-insensitive),
// counted per copy, so two identical lessons on one day are both kept.
const key = l => `${l.date}|${l.durationMinutes}|${l.student.trim().toLowerCase()}`;

export function planImport(existing, incoming) {
  const left = new Map();
  existing.forEach(l => left.set(key(l), (left.get(key(l)) ?? 0) + 1));
  const toAdd = incoming.filter(l => {
    const n = left.get(key(l)) ?? 0;
    if (n > 0) left.set(key(l), n - 1);
    return n === 0;
  });
  return { toAdd, skipped: incoming.length - toAdd.length };
}
