export function formatBudget(amount: number): string {
  return '฿' + amount.toLocaleString('th-TH');
}

export function formatDate(
  dateStr: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Date(dateStr).toLocaleDateString('th-TH', opts);
}

export function getInitials(name: string): string {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
