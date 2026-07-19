import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOtpTimer } from "@/hooks/useOtpTimer";
import { axiosInstance } from "@/lib/axios";
import { getRecaptchaToken } from "@/lib/recaptcha";
import {
  Eye, EyeOff, UserPlus, Shield, Mail, Phone, User, AtSign,
  CheckCircle2, Loader2, MessageSquare, Smartphone, MessageCircle,
  ArrowLeft, Clock
} from "lucide-react";

import { useShopBranding } from "@/lib/shopBranding";

type Step = "form" | "channel" | "otp" | "done";

export default function ShopSignUp() {
  const branding = useShopBranding();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("form");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [otp, setOtp] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const { secondsLeft, canResend, startTimer } = useOtpTimer(60);

  function validateForm(): string | null {
    if (!name.trim()) return "Full name is required.";
    if (!email.trim() && !mobile.trim()) return "Please provide at least an email or mobile number.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function handleInitiate(channel: "email" | "sms" | "whatsapp") {
    setError("");
    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken("register");
      const { data } = await axiosInstance.post("/shop/auth/register/initiate", {
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        mobile: mobile.trim() || undefined,
        password,
        channel,
        recaptchaToken,
      });
      if (!data.ok) throw new Error(data.error || "Failed to send OTP");
      toast({ title: `OTP sent via ${data.sentVia}`, description: "Check your selected channel for the code." });
      setSelectedChannel(channel);
      setStep("otp");
      startTimer();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send OTP. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!otp.trim()) { setError("Please enter the verification code."); return; }
    setLoading(true);
    try {
      const { data } = await axiosInstance.post("/shop/auth/register/verify", {
        code: otp.trim(),
        email: email.trim() || undefined,
        mobile: mobile.trim() || undefined,
      });
      localStorage.setItem("geem_shop_token", data.token);
      setStep("done");
      toast({ title: "Account created!", description: "Welcome to Geem." });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Verification failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/shop">
            <img src={branding.logo ?? "/icon-192.png"} alt={branding.companyName} className="h-10 w-auto mx-auto cursor-pointer" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {step === "done" ? "Account Verified!" : "Create a Geem account"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "channel" ? "How should we send your verification code?" :
             step === "otp" ? "Enter the 6-digit code we sent you" :
             step === "done" ? "You're all set" :
             "Shop smarter, track orders easily"}
          </p>
        </div>

        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-8">
          {/* ── DONE ── */}
          {step === "done" && (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <p className="text-sm text-slate-500">Your account has been created and verified successfully.</p>
              <Button className="w-full bg-blue-600 text-white" onClick={() => navigate("/shop/account")}>Go to My Account</Button>
            </div>
          )}

          {/* ── OTP ── */}
          {step === "otp" && (
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="otp" className="text-slate-700 font-medium text-sm">Verification Code</Label>
                <Input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="border-slate-200 bg-slate-50 focus:bg-white text-center text-lg tracking-[0.5em] font-mono" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 text-white font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : "Verify & Create Account"}
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
                onClick={() => handleInitiate(selectedChannel)}>
                {canResend ? `Resend Code via ${selectedChannel.charAt(0).toUpperCase() + selectedChannel.slice(1)}` : `Wait ${secondsLeft}s`}
              </Button>
              <button type="button" onClick={() => setStep("channel")}
                className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 w-full">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </form>
          )}

          {/* ── CHANNEL SELECTION ── */}
          {step === "channel" && (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
              )}
              <p className="text-sm text-slate-600">Select how you'd like to receive your 6-digit verification code:</p>
              <div className="grid gap-3">
                {email.trim() && (
                  <button type="button" disabled={loading} onClick={() => handleInitiate("email")}
                    className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-slate-800">Email</p>
                      <p className="text-xs text-slate-500">{email}</p>
                    </div>
                  </button>
                )}
                {mobile.trim() && (
                  <button type="button" disabled={loading} onClick={() => handleInitiate("sms")}
                    className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
                    <Smartphone className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-slate-800">SMS</p>
                      <p className="text-xs text-slate-500">{mobile}</p>
                    </div>
                  </button>
                )}
                {mobile.trim() && (
                  <button type="button" disabled={loading} onClick={() => handleInitiate("whatsapp")}
                    className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
                    <MessageCircle className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-slate-800">WhatsApp</p>
                      <p className="text-xs text-slate-500">{mobile}</p>
                    </div>
                  </button>
                )}
              </div>
              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending verification code…
                </div>
              )}
              <button type="button" onClick={() => setStep("form")}
                className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 w-full">
                <ArrowLeft className="h-3.5 w-3.5" /> Edit Details
              </button>
            </div>
          )}

          {/* ── FORM ── */}
          {step === "form" && (
            <form onSubmit={(e) => { e.preventDefault(); const err = validateForm(); if (err) { setError(err); return; } setError(""); setStep("channel"); }} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-slate-700 font-medium text-sm flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> Full Name <span className="text-red-500">*</span>
                </Label>
                <Input id="name" type="text" placeholder="Ali Hassan" value={name}
                  onChange={e => setName(e.target.value)} autoComplete="name"
                  className="border-slate-200 bg-slate-50 focus:bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-slate-700 font-medium text-sm flex items-center gap-1.5">
                  <AtSign className="h-3.5 w-3.5 text-slate-400" /> Username <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Input id="username" type="text" placeholder="ali_hassan" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                  autoComplete="username" className="border-slate-200 bg-slate-50 focus:bg-white" />
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500 mb-3">Provide <strong>at least one</strong> contact method:</p>
                <div className="space-y-1.5 mb-3">
                  <Label htmlFor="email" className="text-slate-700 font-medium text-sm flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> Email
                  </Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} autoComplete="email"
                    className="border-slate-200 bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile" className="text-slate-700 font-medium text-sm flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> Mobile
                  </Label>
                  <Input id="mobile" type="tel" placeholder="0307-8680005" value={mobile}
                    onChange={e => setMobile(e.target.value)} autoComplete="tel"
                    className="border-slate-200 bg-slate-50 focus:bg-white" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Password <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? "text" : "password"} placeholder="Min. 6 characters" value={password}
                      onChange={e => setPassword(e.target.value)} autoComplete="new-password"
                      className="border-slate-200 bg-slate-50 focus:bg-white pr-10" />
                    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-slate-700 font-medium text-sm">Confirm Password <span className="text-red-500">*</span></Label>
                  <Input id="confirm" type={showPw ? "text" : "password"} placeholder="Repeat your password" value={confirm}
                    onChange={e => setConfirm(e.target.value)} autoComplete="new-password"
                    className="border-slate-200 bg-slate-50 focus:bg-white" />
                </div>
              </div>
              <Button type="submit" className="w-full bg-blue-600 text-white font-semibold mt-1">
                Continue <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </form>
          )}

          {step !== "done" && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/shop/sign-in">
                <span className="text-blue-600 font-medium hover:underline cursor-pointer">Sign in</span>
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5" />
          Your information is protected · Geem.pk
        </div>
      </div>
    </div>
  );
}
