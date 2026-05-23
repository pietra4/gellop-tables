import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { TableView } from './components/TableView';
import './App.css';

const AppInner: React.FC = () => {
  const { user, token, checkAuth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, [token, checkAuth]);

  if (!user) {
    return <LoginForm onSuccess={() => checkAuth()} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-link" aria-label="Go to dashboard">
          <span className="brand-mark">GT</span>
          <div className="brand-text">
            <strong>Gellop Tables</strong>
            <span>CRM Data Workspace</span>
          </div>
        </Link>

        <div className="topbar-right">
          <div className="user-chip">
            <span className="user-dot" />
            <span>{user.username}</span>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tables/:id" element={<TableView />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};
