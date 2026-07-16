import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShopAuth } from "@/lib/shopAuth";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { useSignIn } from "@clerk/react";
import { Eye, EyeOff, LogIn, Shield } from "lucide-react";
import { useShopBranding } from "@/lib/shopBranding";

export default function ShopSignIn() {
  const branding = useShopBranding();
  const { login, isLoaded } = useShopAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signIn } = useSignIn() as any;
  const [, navigate] = useLocation();
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    if (!signIn) return;
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${BASE_PATH}/shop/sso-callback`,
        redirectUrlComplete: `${BASE_PATH}/shop/account`,
      });
    } catch {
      setGoogleLoading(false);
      setError("Google sign-in failed. Please try again.");
    }
  }

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password) { setError("Please enter your login details."); return; }
    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken("login");
      await login(identifier.trim(), password, recaptchaToken);
      navigate("/shop/account");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Invalid credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/shop">
            <img src={branding.logo ?? "/geem-logo-banner.svg"} alt={branding.companyName} className="h-10 w-auto mx-auto cursor-pointer" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sign in to your account</h1>
          <p className="mt-1 text-sm text-slate-500">Access your orders and account details</p>
        </div>

        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-slate-700 font-medium text-sm">
                Email, Mobile, or Username
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="e.g. 0307-8680005 or info@geem.pk"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoComplete="username"
                className="border-slate-200 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Password</Label>
                <Link href="/shop/forgot-password">
                  <span className="text-xs text-blue-600 hover:underline cursor-pointer">Forgot password?</span>
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="border-slate-200 bg-slate-50 focus:bg-white pr-10"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 text-white font-semibold" disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            or
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-200 font-medium"
            disabled={googleLoading || !signIn}
            onClick={handleGoogle}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.3 2.7l6-6C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c2.8 0 5.3 1 7.3 2.7l6-6C33.6 6.5 29 4.5 24 4.5c-7.7 0-14.4 4.3-17.7 10.2z"/><path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13-5.1l-6.4-5.4c-1.9 1.3-4.3 2-6.6 2-5.3 0-9.7-3.4-11.3-8.2l-6.6 5.1C9.5 39.1 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C41.4 35.9 43.5 30.3 43.5 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </Button>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
            New customer?{" "}
            <Link href="/shop/sign-up">
              <span className="text-blue-600 font-medium hover:underline cursor-pointer">Create an account</span>
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5" />
          Secure login · Protected by Google reCAPTCHA
        </div>
      </div>
    </div>
  );
}
