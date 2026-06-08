import { Tag } from 'antd';
import { titleize } from '../utils/formatters.js';

const colorByStatus = {
  approved: 'green',
  available: 'green',
  clean: 'green',
  pending: 'gold',
  review: 'orange',
  needs_review: 'orange',
  warning: 'orange',
  claimed: 'default',
  rejected: 'red',
  high: 'red',
  low: 'blue',
  optional: 'default',
  info: 'blue'
};

export default function StatusTag({ status, children }) {
  const normalized = String(status || '').toLowerCase();
  const color = colorByStatus[normalized] || 'default';
  const label = normalized === 'approved' ? 'Verified' : titleize(normalized);

  return <Tag color={color}>{children || label}</Tag>;
}
