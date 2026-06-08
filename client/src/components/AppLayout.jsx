import { BarChartOutlined, FlagOutlined, ImportOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Layout, Tag, Typography } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const { Content, Sider } = Layout;

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();

  const navItems = [
    {
      path: '/leaderboard',
      icon: <BarChartOutlined />,
      label: 'Leaderboard'
    },
    {
      path: '/import',
      icon: <ImportOutlined />,
      label: 'Import Tournament'
    },
    {
      path: '/profile',
      icon: <UserOutlined />,
      label: 'My Profile'
    },
    ...(isAdmin
      ? [
          {
            path: '/admin/review',
            icon: <FlagOutlined />,
            label: 'Admin Review'
          }
        ]
      : [])
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <Layout className="min-h-screen">
      <Sider
        width={280}
        breakpoint="lg"
        collapsedWidth="0"
        className="bbx-app-sider border-r border-bbx-line bg-white"
      >
        <div className="bbx-sidebar-brand">
          <img
            src="/brand/zamboanga-pincers-logo.jpg"
            alt="Zamboanga Pincers logo"
            className="bbx-sidebar-brand-logo"
          />
          <div className="min-w-0">
            <div className="brand-title bbx-sidebar-brand-title">Project Pincers</div>
            <div className="bbx-sidebar-brand-subtitle">Zamboanga BBX Rankings</div>
          </div>
        </div>

        <nav className="bbx-sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`bbx-sidebar-nav-item ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="bbx-sidebar-nav-icon">{item.icon}</span>
                <span className="bbx-sidebar-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="bbx-sidebar-account">
          <div className="bbx-sidebar-account-divider">
            <div className="h-px flex-1 bg-bbx-line" />
            <span>Account</span>
            <div className="h-px flex-1 bg-bbx-line" />
          </div>

          <div className="bbx-sidebar-account-card">
            <Typography.Text className="bbx-sidebar-account-kicker">
              Signed in as
            </Typography.Text>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <Typography.Text className="bbx-sidebar-account-name">
                {profile?.display_name || 'BBX Player'}
              </Typography.Text>
              {isAdmin ? (
                <Tag color="red" className="m-0 rounded-md font-bold">
                  Admin
                </Tag>
              ) : null}
            </div>
            <Button
              block
              danger
              size="large"
              className="mt-4 font-bold"
              icon={<LogoutOutlined />}
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </Sider>
      <Layout>
        <Content className="px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto w-full max-w-[1536px]">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
