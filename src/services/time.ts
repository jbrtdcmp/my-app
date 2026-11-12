// The API sends MySQL times like "2026-11-12 21:30:00" in Philippine local time.
export function parseApiTime(value: string): Date {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T'));
}

/** "Just now", "5 min ago", "3 hr ago", "Yesterday, 8:15 PM", or "Nov 9, 8:15 PM". */
export function formatWhen(value: string, now = new Date()): string {
  const date = parseApiTime(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 6 * 60) return `${Math.round(minutes / 60)} hr ago`;
  const time = date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}, ${time}`;
}
