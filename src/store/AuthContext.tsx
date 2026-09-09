import React, { createContext, useContext, useState, ReactNode } from 'react';

// Shape of the logged-in user's basic info
type User = {
  name: string;
  email: string;
};

// Everything the Auth Context exposes to any screen that uses it
type AuthContextType = {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => boolean;
  signup: (name: string, email: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock in-memory "database" of registered users — this resets every time
// the app fully restarts, since it's just a JS array, not real storage.
// Replace this with a real backend call (Firebase, Supabase, custom API)
// once one exists — the login()/signup() function signatures below are
// designed to swap out cleanly for real network calls later.
const registeredUsers: { name: string; email: string; password: string }[] = [];

// Wraps the whole app (see App.tsx) so any nested screen can access
// auth state via useAuth(), without passing props down manually
// through every level of the navigation tree.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, password: string): boolean => {
    const found = registeredUsers.find((u) => u.email === email && u.password === password);
    if (found) {
      setUser({ name: found.name, email: found.email });
      return true; // login succeeded
    }
    return false; // wrong email or password
  };

  const signup = (name: string, email: string, password: string): boolean => {
    // Prevent duplicate accounts from registering with the same email
    const exists = registeredUsers.some((u) => u.email === email);
    if (exists) return false;

    registeredUsers.push({ name, email, password });
    setUser({ name, email }); // auto-login immediately after signing up
    return true;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook so screens just call useAuth() instead of importing
// useContext + AuthContext every time. Throws a clear error if someone
// tries to use it outside the provider, instead of a silent undefined bug.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}