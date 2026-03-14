import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';

/**
 * Component to protect routes that require authentication
 * If user is not logged in, redirects to login page
 */
const AuthProtectedRoute = ({ children }) => {
  const { user, loading } = useUser();
  const location = useLocation();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  // If no user, redirect to login with state to return here after login
  if (!user) {
    return (
      <Navigate 
        to="/login" 
        state={{ 
          from: location.pathname,
          message: "Please sign in to access this page"
        }} 
        replace 
      />
    );
  }

  return children;
};

export default AuthProtectedRoute;
