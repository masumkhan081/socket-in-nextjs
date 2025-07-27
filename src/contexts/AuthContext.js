'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [tokenRefreshTimer, setTokenRefreshTimer] = useState(null);

  // Initialize auth state from localStorage on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      
      if (storedUser && storedToken) {
        try {
          // Parse stored user data
          const userData = JSON.parse(storedUser);
          
          // For now, trust the stored data and validate in background
          setUser(userData);
          initializeSocket(storedToken);
          
          // In development, be more lenient with token validation
          const isDevelopment = process.env.NODE_ENV === 'development';
          
          if (!isDevelopment) {
            // Check token expiry in production
            const tokenExpiry = localStorage.getItem('tokenExpiry');
            if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
              console.log('Token expired, logging out');
              logout();
              return;
            }
          }
          
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          // Clear stored data on error
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('tokenExpiry');
        }
      }
      
      setLoading(false);
    };
    
    initializeAuth();
  }, []);

  // Initialize socket connection
  const initializeSocket = (token) => {
    // Disconnect existing socket if any
    if (socket) {
      socket.disconnect();
    }
    
    const newSocket = io('/', {
      auth: {
        token
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      // If socket connection fails due to invalid token, logout user
      if (err.message.includes('Authentication error') || err.message.includes('Invalid token')) {
        logout();
      }
    });

    // Handle token expiration
    newSocket.on('token_expired', () => {
      console.log('Token expired, logging out user');
      logout();
    });

    setSocket(newSocket);
    return newSocket;
  };

  // Login function
  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      
      // Save to state and localStorage
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      
      // Set token expiration time (optional - for automatic refresh)
      const tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      localStorage.setItem('tokenExpiry', tokenExpiry.toString());
      
      // Initialize socket connection
      initializeSocket(data.token);
      
      // Setup automatic token refresh
      setupTokenRefresh();
      
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    // Clean up socket connection
    if (socket) {
      socket.disconnect();
    }
    
    // Clear token refresh timer
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
      setTokenRefreshTimer(null);
    }
    
    // Clear state and localStorage
    setUser(null);
    setSocket(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiry');
  };

  // Get auth token
  const getToken = () => {
    return localStorage.getItem('token');
  };
  
  // Check if user is authenticated
  const isAuthenticated = () => {
    // During hot reload, user might be null but token exists
    const hasToken = !!localStorage.getItem('token');
    const hasUser = !!localStorage.getItem('user');
    
    // In development, be more lenient
    if (process.env.NODE_ENV === 'development') {
      return hasToken && hasUser;
    }
    
    return !!user && hasToken;
  };
  
  // Refresh user data
  const refreshUser = async () => {
    const token = getToken();
    if (!token) return null;
    
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      } else {
        logout();
        return null;
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      logout();
      return null;
    }
  };
  
  // Setup automatic token refresh
  const setupTokenRefresh = () => {
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (!tokenExpiry) return;
    
    const expiryTime = parseInt(tokenExpiry);
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;
    
    // Refresh token 5 minutes before expiry
    const refreshTime = timeUntilExpiry - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      const timer = setTimeout(() => {
        refreshUser();
      }, refreshTime);
      
      setTokenRefreshTimer(timer);
    }
  };
  
  // Check if token is expired
  const isTokenExpired = () => {
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (!tokenExpiry) return true;
    
    return Date.now() > parseInt(tokenExpiry);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      getToken,
      isAuthenticated,
      refreshUser,
      isTokenExpired,
      socket
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
