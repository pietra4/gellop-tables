import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import './App.css';

export const App: React.FC = () => {
  const { user, token, checkAuth, logout } = useAuth();

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
        <h1>Clay-lite</h1>
        <div className="user-info">
          <span>Welcome, {user.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>
      <main className="content">
        <p>Tables coming soon...</p>
      </main>
    </div>
  );
};
