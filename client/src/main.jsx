import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#d71920',
          colorLink: '#d71920',
          colorSuccess: '#16823a',
          colorWarning: '#d98b00',
          colorError: '#b91c1c',
          colorText: '#171717',
          colorBgLayout: '#f7f7f8',
          colorBorderSecondary: '#e5e7eb',
          borderRadius: 8,
          fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        },
        components: {
          Button: {
            controlHeight: 40
          },
          Card: {
            headerFontSize: 18,
            borderRadiusLG: 8
          },
          Menu: {
            itemSelectedBg: '#fff1f1',
            itemSelectedColor: '#d71920',
            itemHoverColor: '#d71920'
          },
          Table: {
            headerBg: '#fafafa',
            headerColor: '#171717'
          }
        }
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
