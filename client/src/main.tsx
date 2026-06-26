import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef } from 'react';
import App from './App.js';
import AdminApp from './admin/AdminApp.js';
import './index.css';

function Root() {
  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRef = useRef(isAdmin);

  // Keep ref in sync with state
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

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
        const next = !isAdminRef.current;
        setIsAdmin(next);
        window.history.pushState({}, '', next ? '/admin' : '/');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (isAdmin) return <AdminApp />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
