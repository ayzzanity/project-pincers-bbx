import { Alert, Button, Card, Empty, Spin } from 'antd';

export function LoadingCard({ message = 'Loading...' }) {
  return (
    <Card className="bbx-card">
      <div className="flex min-h-40 items-center justify-center gap-3">
        <Spin />
        <span className="text-bbx-muted">{message}</span>
      </div>
    </Card>
  );
}

export function ErrorCard({ error, onRetry }) {
  return (
    <Alert
      type="error"
      showIcon
      message="Something went wrong"
      description={
        <div className="space-y-3">
          <div>{error?.message || 'The request could not be completed.'}</div>
          {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
        </div>
      }
    />
  );
}

export function EmptyCard({ title = 'No data yet', description }) {
  return (
    <Card className="bbx-card">
      <Empty description={<span>{description || title}</span>} />
    </Card>
  );
}
