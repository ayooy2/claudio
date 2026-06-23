import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import App from './App.js';
import AdminApp from './admin/AdminApp.js';
import './index.css';

function Root() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Check URL for admin route
  useEffect(() => {
    const check = () => setIsAdmin(window.location.pathname.startsWith('/admin'));
    check();
    window.addEventListener('popstate', check);
    return () => window.removeEventListener('popstate', check);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+A to toggle admin
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setIsAdmin(prev => {
          const next = !prev;
          window.history.pushState({}, '', next ? '/admin' : '/');
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAdmin]);

  if (isAdmin) return <AdminApp />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
