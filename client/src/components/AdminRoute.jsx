import { Alert } from 'antd';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AdminRoute({ children }) {
  const { isAdmin, profile } = useAuth();

  if (!profile) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Profile unavailable"
        description="Your profile role could not be loaded, so admin tools are hidden."
      />
    );
  }

  if (!isAdmin) {
    return <Alert type="error" showIcon message="Admin access is required." />;
  }

  return children;
}
