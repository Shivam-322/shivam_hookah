"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // NEXT_PUBLIC_ prefix is required for client-side access.
      // Admin emails are not secrets — real security is enforced server-side
      // (upload-image route validates email; verify-payment validates signature).
      const adminEmails = [
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_1,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_2,
      ].filter(Boolean);

      setIsAdmin(
        currentUser && currentUser.email
          ? adminEmails.includes(currentUser.email)
          : false
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
