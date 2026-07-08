import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { axiosInstance } from "@/lib/axios";
import { useAuth as useClerkAuth } from "@clerk/react";

export interface ShopCustomer {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  mobile: string | null;
}

interface RegisterData {
  name: string;
  username?: string;
  email?: string;
  mobile?: string;
  password: string;
}

interface ShopAuthContextValue {
  customer: ShopCustomer | null;
  isLoaded: boolean;
  login: (identifier: string, password: string, recaptchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  getToken: () => string | null;
}

const ShopAuthContext = createContext<ShopAuthContextValue | null>(null);

export const SHOP_TOKEN_KEY = "geem_shop_token";

export function ShopAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // Clerk hooks are only available when ShopAuthProvider is rendered inside a
  // ClerkProvider (see App.tsx). Falls back to a no-op shape otherwise.
  const { isLoaded: clerkIsLoaded, isSignedIn: clerkIsSignedIn, getToken: clerkGetToken } = useClerkAuth();
  const exchangingGoogle = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem(SHOP_TOKEN_KEY);
    if (!token) { setIsLoaded(true); return; }
    axiosInstance
      .get<ShopCustomer>("/shop/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCustomer(r.data))
      .catch(() => localStorage.removeItem(SHOP_TOKEN_KEY))
      .finally(() => setIsLoaded(true));
  }, []);

  // After a "Continue with Google" redirect completes, Clerk has its own
  // session but Geem doesn't yet — exchange it for a Geem shop session.
  useEffect(() => {
    if (!clerkIsLoaded || !clerkIsSignedIn) return;
    if (localStorage.getItem(SHOP_TOKEN_KEY) || exchangingGoogle.current) return;
    exchangingGoogle.current = true;
    (async () => {
      try {
        const clerkToken = await clerkGetToken();
        const { data } = await axiosInstance.post<{ token: string; customer: ShopCustomer }>(
          "/shop/auth/google",
          {},
          { headers: { Authorization: `Bearer ${clerkToken}` } },
        );
        localStorage.setItem(SHOP_TOKEN_KEY, data.token);
        setCustomer(data.customer);
      } catch {
        // Leave the user on the page; they can retry sign-in with Google or password.
      } finally {
        exchangingGoogle.current = false;
      }
    })();
  }, [clerkIsLoaded, clerkIsSignedIn]);

  const login = useCallback(async (identifier: string, password: string, recaptchaToken?: string) => {
    const { data } = await axiosInstance.post<{ token: string; customer: ShopCustomer }>(
      "/shop/auth/login",
      { identifier, password, recaptchaToken },
    );
    localStorage.setItem(SHOP_TOKEN_KEY, data.token);
    setCustomer(data.customer);
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(SHOP_TOKEN_KEY);
    if (token) {
      try {
        await axiosInstance.post("/shop/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch {}
    }
    localStorage.removeItem(SHOP_TOKEN_KEY);
    setCustomer(null);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    // The new OTP flow is handled in ShopSignUp.tsx directly (initiate + verify)
    // This fallback exists for legacy consumers — but will error since /shop/auth/register now requires OTP
    const { data: result } = await axiosInstance.post<{ token: string; customer: ShopCustomer }>(
      "/shop/auth/register",
      data,
    );
    localStorage.setItem(SHOP_TOKEN_KEY, result.token);
    setCustomer(result.customer);
  }, []);

  const getToken = useCallback(() => localStorage.getItem(SHOP_TOKEN_KEY), []);

  return (
    <ShopAuthContext.Provider value={{ customer, isLoaded, login, logout, register, getToken }}>
      {children}
    </ShopAuthContext.Provider>
  );
}

export function useShopAuth() {
  const ctx = useContext(ShopAuthContext);
  if (!ctx) throw new Error("useShopAuth must be used inside ShopAuthProvider");
  return ctx;
}
