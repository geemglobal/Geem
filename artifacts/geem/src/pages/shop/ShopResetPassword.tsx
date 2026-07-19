import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { axiosInstance } from "@/lib/axios";
import { ArrowLeft, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";

import { useShopBranding } from "@/lib/shopBranding";

export default function ShopResetPassword() {
  const branding = useShopBranding();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await axiosInstance.post("/shop/auth/reset-password", { resetToken: token, newPassword: password });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Reset failed. Token may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/shop">
            <img src={branding.logo ?? "/icon-192.png"} alt={branding.companyName} className="h-10 w-auto mx-auto cursor-pointer" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {success ? "Password Updated!" : "Set a New Password"}
          </h1>
        </div>

        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-8">
          {success ? (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <p className="text-sm text-slate-500">Your password has been updated successfully.</p>
              <Button className="w-full" onClick={() => navigate("/shop/sign-in")}>Sign In Now</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {!token && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                  Invalid or missing reset token. Please request a new reset link.
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-700 font-medium text-sm">New Password</Label>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                    className="border-slate-200 bg-slate-50 focus:bg-white pr-10" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-slate-700 font-medium text-sm">Confirm Password</Label>
                <Input id="confirm" type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)} placeholder="Repeat password"
                  className="border-slate-200 bg-slate-50 focus:bg-white" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 text-white font-semibold" disabled={loading || !token}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Update Password"}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link href="/shop/sign-in">
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
