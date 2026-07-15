import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { axiosInstance } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOtpTimer } from "@/hooks/useOtpTimer";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { Loader2, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2, Mail, Smartphone, MessageCircle, Clock } from "lucide-react";
import { useShopBranding } from "@/lib/shopBranding";

interface LoginResponse {
  token: string;
  user: { id: number; name: string; username: string | null; email: string; role: string };
}


function parseUserAgent(ua: string) {
  const u = ua.toLowerCase();
  const browser =
    u.includes("edg/") ? "Edge" :
    u.includes("opr/") || u.includes("opera") ? "Opera" :
    u.includes("samsung") ? "Samsung Browser" :
    u.includes("firefox") ? "Firefox" :
    u.includes("chrome") ? "Chrome" :
    u.includes("safari") ? "Safari" : "Unknown";
  const os =
    u.includes("windows nt 11") ? "Windows 11" :
    u.includes("windows nt 10") ? "Windows 10" :
    u.includes("windows") ? "Windows" :
    u.includes("iphone") ? "iOS (iPhone)" :
    u.includes("ipad") ? "iOS (iPad)" :
    u.includes("android") ? "Android" :
    u.includes("mac os x") ? "macOS" :
    u.includes("linux") ? "Linux" : "Unknown";
  const deviceType =
    u.includes("ipad") || u.includes("tablet") ? "tablet" :
    u.includes("mobile") || u.includes("iphone") || u.includes("android") ? "mobile" : "desktop";
  return { browser, os, deviceType };
}

function getGPS(timeoutMs = 12000): Promise<GeolocationCoordinates | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      pos => { clearTimeout(timer); resolve(pos.coords); },
      ()  => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: true, timeout: timeoutMs - 500 },
    );
  });
}

type Screen = "login" | "forgot" | "forgot-channel" | "forgot-otp" | "reset";

export default function Login() {
  const branding = useShopBranding();
  const [, setLocation] = useLocation();
  const [screen, setScreen] = useState<Screen>("login");

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [gpsState, setGpsState] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [reconnecting, setReconnecting] = useState(false);

  // Forgot password flow
  const [fpIdentifier, setFpIdentifier] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpResetToken, setFpResetToken] = useState("");
  const [fpName, setFpName] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpLastChannel, setFpLastChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const { secondsLeft, canResend, startTimer } = useOtpTimer(60);

  // Reset password form
  const [rpPassword, setRpPassword] = useState("");
  const [rpConfirm, setRpConfirm] = useState("");
  const [showRpPw, setShowRpPw] = useState(false);
  const [rpLoading, setRpLoading] = useState(false);
  const [rpError, setRpError] = useState("");
  const [rpSuccess, setRpSuccess] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("geem_token");
    if (!token) return;
    setReconnecting(true);
    const tryReconnect = async () => {
      try {
        const resp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          if (pollRef.current) clearInterval(pollRef.current);
          setLocation("/dashboard");
        } else {
          if (pollRef.current) clearInterval(pollRef.current);
          localStorage.removeItem("geem_token");
          setReconnecting(false);
        }
      } catch { /* server still starting */ }
    };
    void tryReconnect();
    pollRef.current = setInterval(tryReconnect, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setLoginError("");
    setIsPending(true);

    setGpsState("requesting");
    const coords = await getGPS();
    setGpsState(coords ? "granted" : "denied");

    const ua = navigator.userAgent;
    const { browser, os, deviceType } = parseUserAgent(ua);

    try {
      const recaptchaToken = await getRecaptchaToken("admin_login");
      const { data } = await axiosInstance.post<LoginResponse>("/auth/login", {
        email, password,
        recaptchaToken,
        latitude:  coords ? String(coords.latitude)  : null,
        longitude: coords ? String(coords.longitude) : null,
        locationName: coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : null,
        browser, os, deviceType,
      });
      localStorage.setItem("geem_token", data.token);
      setLocation("/dashboard");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg    = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setLoginError(msg ?? (status === 401 ? "Invalid email, mobile, or password" : "Login failed — please try again"));
    } finally { setIsPending(false); }
  };

  async function handleForgotRequest(channel: "email" | "sms" | "whatsapp") {
    setFpError("");
    setFpLoading(true);
    try {
      const { data } = await axiosInstance.post<{ ok: boolean; sent: boolean; sentVia?: string; error?: string }>("/auth/forgot-password", { identifier: fpIdentifier.trim(), channel });
      if (data.ok && data.sent) {
        setFpLastChannel(channel);
        setScreen("forgot-otp");
        startTimer();
      } else {
        setFpError(data.error || "No active account found with that identifier.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send OTP.";
      setFpError(msg);
    } finally { setFpLoading(false); }
  }

  async function handleForgotVerify(e: React.FormEvent) {
    e.preventDefault();
    setFpError("");
    if (!fpOtp.trim()) { setFpError("Please enter the verification code."); return; }
    setFpLoading(true);
    try {
      const { data } = await axiosInstance.post<{ ok: boolean; resetToken?: string; error?: string }>("/auth/forgot-password/verify", { identifier: fpIdentifier.trim(), code: fpOtp.trim() });
      if (data.ok && data.resetToken) {
        setFpResetToken(data.resetToken);
        setScreen("reset");
      } else {
        setFpError(data.error ?? "Verification failed.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Invalid or expired code.";
      setFpError(msg);
    } finally { setFpLoading(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setRpError("");
    if (rpPassword.length < 8) { setRpError("Password must be at least 8 characters."); return; }
    if (rpPassword !== rpConfirm) { setRpError("Passwords do not match."); return; }
    setRpLoading(true);
    try {
      await axiosInstance.post("/auth/reset-password", { resetToken: fpResetToken, newPassword: rpPassword });
      setRpSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Reset failed. Token may have expired.";
      setRpError(msg);
    } finally { setRpLoading(false); }
  }

  void gpsState;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card p-8 rounded-xl shadow-xl border border-border">
        <div className="text-center mb-7">
          <div className="flex justify-center mb-4">
            <img src={branding.logo ?? "/geem-logo-banner.svg"} alt="Geem" className="h-14 w-auto object-contain" />
          </div>
          <p className="text-muted-foreground text-sm">
            {screen === "login" ? "Sign in to your account" :
             screen.startsWith("forgot") ? "Reset your password" :
             "Set a new password"}
          </p>
        </div>

        {/* ── LOGIN SCREEN ── */}
        {screen === "login" && (
          reconnecting ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Server is restarting after update…</p>
              <p className="text-xs text-muted-foreground">You will be signed in automatically once the server is back.</p>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground mt-2"
                onClick={() => { if (pollRef.current) clearInterval(pollRef.current); localStorage.removeItem("geem_token"); setReconnecting(false); }}>
                Sign in manually instead
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <p className="text-sm text-destructive text-center bg-destructive/10 rounded-lg py-2 px-3">{loginError}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email, Mobile, or Username</Label>
                <Input id="email" type="text" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username" placeholder="email, mobile number, or username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} required value={password}
                    onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="pr-10" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in…</> : "Sign In"}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => { setScreen("forgot"); setLoginError(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                  Forgot password?
                </button>
              </div>
            </form>
          )
        )}

        {/* ── FORGOT: IDENTIFIER ── */}
        {screen === "forgot" && (
          <form onSubmit={(e) => { e.preventDefault(); if (!fpIdentifier.trim()) { setFpError("Please enter your email, mobile, or username."); return; } setFpError(""); setScreen("forgot-channel"); }} className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your identifier and we'll send a verification code.</p>
            {fpError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{fpError}</div>}
            <div className="space-y-2">
              <Label htmlFor="fp-id">Email, Mobile, or Username</Label>
              <Input id="fp-id" type="text" value={fpIdentifier}
                onChange={e => setFpIdentifier(e.target.value)} placeholder="your email or mobile number" />
            </div>
            <Button type="submit" className="w-full" disabled={fpLoading}>
              <KeyRound className="h-4 w-4 mr-2" />{fpLoading ? "Sending…" : "Continue"}
            </Button>
            <button type="button" onClick={() => setScreen("login")}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </button>
          </form>
        )}

        {/* ── FORGOT: CHANNEL SELECTION ── */}
        {screen === "forgot-channel" && (
          <div className="space-y-4">
            {fpError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{fpError}</div>}
            <p className="text-sm text-muted-foreground">Send verification code to <strong>{fpIdentifier}</strong> via:</p>
            <div className="grid gap-3">
              <button type="button" disabled={fpLoading} onClick={() => handleForgotRequest("email")}
                className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent transition text-left">
                <Mail className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Email</span>
              </button>
              <button type="button" disabled={fpLoading} onClick={() => handleForgotRequest("sms")}
                className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent transition text-left">
                <Smartphone className="h-5 w-5 text-green-600" />
                <span className="font-medium">SMS</span>
              </button>
              <button type="button" disabled={fpLoading} onClick={() => handleForgotRequest("whatsapp")}
                className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent transition text-left">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                <span className="font-medium">WhatsApp</span>
              </button>
            </div>
            {fpLoading && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Sending…</div>}
            <button type="button" onClick={() => setScreen("forgot")}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </div>
        )}

        {/* ── FORGOT: OTP ── */}
        {screen === "forgot-otp" && (
          <form onSubmit={handleForgotVerify} className="space-y-4">
            {fpError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{fpError}</div>}
            <div className="space-y-2">
              <Label htmlFor="fp-otp">Verification Code</Label>
              <Input id="fp-otp" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={fpOtp}
                onChange={e => setFpOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.5em] font-mono" />
            </div>
            <Button type="submit" className="w-full" disabled={fpLoading}>
              {fpLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : "Verify & Continue"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              {secondsLeft > 0 ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Resend in {secondsLeft}s
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">Code expired. Resend to get a new one.</span>
              )}
            </div>
            <Button type="button" variant="outline" className="w-full" disabled={fpLoading || !canResend}
              onClick={() => handleForgotRequest(fpLastChannel)}>
              {canResend ? `Resend Code via ${fpLastChannel.charAt(0).toUpperCase() + fpLastChannel.slice(1)}` : `Wait ${secondsLeft}s`}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setScreen("forgot-channel")} disabled={fpLoading}>Use Different Channel</Button>
            <button type="button" onClick={() => setScreen("forgot")}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </form>
        )}

        {/* ── RESET PASSWORD SCREEN ── */}
        {screen === "reset" && (
          rpSuccess ? (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Password reset!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {fpName ? `${fpName}, your` : "Your"} password has been updated. You can now sign in.
                </p>
              </div>
              <Button className="w-full" onClick={() => { setScreen("login"); setRpSuccess(false); setRpPassword(""); setRpConfirm(""); }}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {fpName && <p className="text-sm text-muted-foreground">Setting new password for <strong>{fpName}</strong>.</p>}
              {rpError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{rpError}</div>}
              <div className="space-y-2">
                <Label htmlFor="rp-pw">New Password <span className="text-xs text-muted-foreground">(min. 8 characters)</span></Label>
                <div className="relative">
                  <Input id="rp-pw" type={showRpPw ? "text" : "password"} value={rpPassword}
                    onChange={e => setRpPassword(e.target.value)} placeholder="New password" className="pr-10" />
                  <button type="button" onClick={() => setShowRpPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                    {showRpPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-confirm">Confirm New Password</Label>
                <Input id="rp-confirm" type="password" value={rpConfirm}
                  onChange={e => setRpConfirm(e.target.value)} placeholder="Repeat password" />
              </div>
              <Button type="submit" className="w-full" disabled={rpLoading}>
                {rpLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Set New Password"}
              </Button>
              <button type="button" onClick={() => setScreen("forgot-otp")}
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
