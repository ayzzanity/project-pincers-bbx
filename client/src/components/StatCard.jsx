import { Card, Statistic } from 'antd';

export default function StatCard({ title, value, prefix, suffix, highlight = false, className = '' }) {
  return (
    <Card className={`bbx-card ${highlight ? 'bbx-card-accent' : ''} ${className}`}>
      <Statistic
        title={<span className="text-xs font-bold uppercase tracking-normal text-bbx-muted">{title}</span>}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{
          color: highlight ? '#d71920' : '#171717',
          fontWeight: 850,
          letterSpacing: 0
        }}
        className="stat-number"
      />
    </Card>
  );
}
