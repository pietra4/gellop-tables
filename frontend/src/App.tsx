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
    <div className="app">
      <div className="header">
        <Link to="/" className="header-link">
          <h1>Clay-lite</h1>
        </Link>
        <div className="user-info">
          <span>{user.username}</span>
          <button onClick={() => { logout(); navigate('/'); }}>Logout</button>
        </div>
      </div>
      <main className="content">
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
