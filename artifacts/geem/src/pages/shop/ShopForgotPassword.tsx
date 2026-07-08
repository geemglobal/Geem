import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOtpTimer } from "@/hooks/useOtpTimer";
import { axiosInstance } from "@/lib/axios";
import {
  KeyRound, ArrowLeft, CheckCircle2, Loader2,
  Mail, Smartphone, MessageCircle, Eye, EyeOff, Clock
} from "lucide-react";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "identifier" | "channel" | "otp" | "reset" | "done";

export default function ShopForgotPassword() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastChannel, setLastChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const { secondsLeft, canResend, startTimer } = useOtpTimer(60);

  async function handleRequest(channel: "email" | "sms" | "whatsapp") {
    setError("");
    setLoading(true);
    try {
      const { data } = await axiosInstance.post<{ ok: boolean; sent: boolean; sentVia?: string; error?: string }>("/shop/auth/forgot-password", { identifier: identifier.trim(), channel });
      if (data.ok && data.sent) {
        toast({ title: `OTP sent via ${data.sentVia}`, description: "Check your selected channel." });
        setLastChannel(channel);
        setStep("otp");
        startTimer();
      } else {
        setError(data.error || "No account found with that identifier.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send OTP.";
      setError(msg);
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!otp.trim()) { setError("Please enter the verification code."); return; }
    setLoading(true);
    try {
      const { data } = await axiosInstance.post<{ ok: boolean; resetToken?: string; error?: string }>("/shop/auth/forgot-password/verify", { identifier: identifier.trim(), code: otp.trim() });
      if (data.ok && data.resetToken) {
        setResetToken(data.resetToken);
        setStep("reset");
      } else {
        setError(data.error ?? "Verification failed.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Invalid or expired code.";
      setError(msg);
    } finally { setLoading(false); }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await axiosInstance.post("/shop/auth/reset-password", { resetToken, newPassword: password });
      setStep("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Reset failed.";
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/shop">
            <img src={`${BASE_PATH}/geem-logo.svg`} alt="Geem" className="h-10 w-auto mx-auto cursor-pointer" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {step === "done" ? "Password Updated!" : "Reset Your Password"}
          </h1>
        </div>

        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-8">
          {/* ── DONE ── */}
          {step === "done" && (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <p className="text-sm text-slate-500">Your password has been updated successfully.</p>
              <Button className="w-full bg-blue-600 text-white" onClick={() => navigate("/shop/sign-in")}>Sign In Now</Button>
            </div>
          )}

          {/* ── RESET PASSWORD ── */}
          {step === "reset" && (
            <form onSubmit={handleReset} className="space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-700 font-medium text-sm">New Password</Label>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} placeholder="Min. 8 characters" value={password}
                    onChange={e => setPassword(e.target.value)} className="border-slate-200 bg-slate-50 focus:bg-white pr-10" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-slate-700 font-medium text-sm">Confirm Password</Label>
                <Input id="confirm" type="password" placeholder="Repeat password" value={confirm}
                  onChange={e => setConfirm(e.target.value)} className="border-slate-200 bg-slate-50 focus:bg-white" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 text-white font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Update Password"}
              </Button>
            </form>
          )}

          {/* ── OTP ── */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>}
              <div className="space-y-1.5">
                <Label htmlFor="otp" className="text-slate-700 font-medium text-sm">Verification Code</Label>
                <Input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="border-slate-200 bg-slate-50 focus:bg-white text-center text-lg tracking-[0.5em] font-mono" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 text-white font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : "Verify Code"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                {secondsLeft > 0 ? (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> Resend in {secondsLeft}s
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">Code expired. Resend to get a new one.</span>
                )}
              </div>
              <Button type="button" variant="outline" className="w-full" disabled={loading || !canResend}
                onClick={() => handleRequest(lastChannel)}>
                {canResend ? `Resend Code via ${lastChannel.charAt(0).toUpperCase() + lastChannel.slice(1)}` : `Wait ${secondsLeft}s`}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("channel")} disabled={loading}>Use Different Channel</Button>
            </form>
          )}

          {/* ── CHANNEL SELECTION ── */}
          {step === "channel" && (
            <div className="space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>}
              <p className="text-sm text-slate-600">Send verification code to <strong>{identifier}</strong> via:</p>
              <div className="grid gap-3">
                <button type="button" disabled={loading} onClick={() => handleRequest("email")}
                  className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div><p className="font-medium text-slate-800">Email</p></div>
                </button>
                <button type="button" disabled={loading} onClick={() => handleRequest("sms")}
                  className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
                  <Smartphone className="h-5 w-5 text-green-600" />
                  <div><p className="font-medium text-slate-800">SMS</p></div>
                </button>
                <button type="button" disabled={loading} onClick={() => handleRequest("whatsapp")}
                  className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                  <div><p className="font-medium text-slate-800">WhatsApp</p></div>
                </button>
              </div>
              {loading && <div className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Sending…</div>}
              <button type="button" onClick={() => setStep("identifier")}
                className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 w-full">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          )}

          {/* ── IDENTIFIER ── */}
          {step === "identifier" && (
            <form onSubmit={(e) => { e.preventDefault(); if (!identifier.trim()) { setError("Please enter your email or mobile number."); return; } setError(""); setStep("channel"); }} className="space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>}
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-slate-700 font-medium text-sm">Email or Mobile Number</Label>
                <Input id="identifier" type="text" placeholder="e.g. info@geem.pk or 03001234567"
                  value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="email"
                  className="border-slate-200 bg-slate-50 focus:bg-white" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 text-white font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : "Send Reset Code"}
              </Button>
            </form>
          )}

          {step !== "done" && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <Link href="/shop/sign-in">
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 cursor-pointer">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
