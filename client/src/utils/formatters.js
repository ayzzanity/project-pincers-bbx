export function formatDate(value) {
  if (!value) return 'None yet';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

export function formatPlacement(value) {
  if (!value) return 'UNPLACED';
  const suffix = value === 1 ? 'ST' : value === 2 ? 'ND' : value === 3 ? 'RD' : 'TH';
  return `${value}${suffix}`;
}

export function titleize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
