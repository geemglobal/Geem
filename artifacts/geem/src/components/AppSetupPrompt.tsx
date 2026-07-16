/**
 * AppSetupPrompt — unified PWA install + permissions prompt.
 *
 * Key design decisions:
 * - Separate localStorage keys for browser vs standalone (installed PWA) so
 *   dismissing "Skip" in the browser never blocks the standalone app from asking.
 * - When the `appinstalled` event fires, immediately advance to the perms step
 *   without waiting for the next launch.
 * - In standalone mode the delay is shorter (1.5 s) because the user
 *   intentionally opened the installed app.
 * - Works for: Chrome/Edge/Samsung/Opera (native prompt), iOS Safari
 *   (manual steps), Firefox (menu steps), all other browsers.
 */
import { useState, useEffect, useRef } from "react";
import {
  Bell, MapPin, X, Download, Share, Plus,
  Smartphone, CheckCircle2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Storage keys ────────────────────────────────────────────────────────── */
const KEY_INSTALLED   = "geem_pwa_installed_v2";
const KEY_SNOOZE      = "geem_pwa_snooze_v2";
/** Perms done when running in a BROWSER tab */
const KEY_PERMS_BR    = "geem_perms_browser_v3";
/** Perms done when running as an INSTALLED standalone PWA */
const KEY_PERMS_SA    = "geem_perms_standalone_v3";

const SNOOZE_DAYS   = 3;
const DELAY_BROWSER = 3000;
const DELAY_SA      = 1500; // shorter — user opened the installed app intentionally

/* ─── Platform helpers ───────────────────────────────────────────────────── */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getIsStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as { standalone?: boolean }).standalone
  );
}

function detectBrowser(): "ios-safari" | "firefox" | "native" {
  const ua = navigator.userAgent;
  const isIos    = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edg|opr\//i.test(ua);
  if (isIos && isSafari)        return "ios-safari";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  return "native"; // Chrome / Edge / Samsung / Opera
}

function isFirefoxAndroid() {
  const ua = navigator.userAgent;
  return /firefox|fxios/i.test(ua) && /android/i.test(ua);
}

function isFirefoxDesktop() {
  const ua = navigator.userAgent;
  return /firefox/i.test(ua) && !/android|mobile/i.test(ua);
}

/* ─── Notification ding sound ────────────────────────────────────────────── */
function playDing() {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1046, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => { void ctx.close(); };
  } catch { /* not critical */ }
}

type Step = "install" | "perms";

interface Props {
  appName?: string;
  appIcon?: string;
}

export function AppSetupPrompt({
  appName = "Geem",
  appIcon = "/icon-192.png",
}: Props) {
  const standalone   = useRef(getIsStandalone());
  const permsKey     = standalone.current ? KEY_PERMS_SA : KEY_PERMS_BR;

  const [steps,     setSteps]     = useState<Step[]>([]);
  const [stepIdx,   setStepIdx]   = useState(0);
  const [visible,   setVisible]   = useState(false);
  const [permsDone, setPermsDone] = useState(false);

  const nativePrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canNative,  setCanNative] = useState(false);
  const browser = useRef(detectBrowser());

  /* ── listen for native install events ── */
  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      nativePrompt.current = e as BeforeInstallPromptEvent;
      setCanNative(true);
      // If the decision timer already ran and set visible=true (waiting on this event),
      // make sure steps include install so the card appears now.
      setSteps(prev => {
        if (prev.length > 0 && !prev.includes("install")) {
          // Prepend install step only if perms is queued and install wasn't added
          // (happens when event fires after the 3s timer ran and perms-only was set)
          return ["install", ...prev];
        }
        return prev;
      });
      setVisible(true);
    }
    function onInstalled() {
      localStorage.setItem(KEY_INSTALLED, "1");
      nativePrompt.current = null;
      setCanNative(false);
      // Advance past install to perms immediately after install
      setStepIdx(idx => {
        return idx; // stay — advanceOrClose() called from handleInstall()
      });
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [permsKey]);

  /* ── fallback: if native prompt never arrives after 15s, skip to perms ── */
  useEffect(() => {
    if (!visible) return;
    if (steps[stepIdx] !== "install") return;
    if (browser.current !== "native") return;
    if (canNative) return; // already have the prompt, no fallback needed
    const t = setTimeout(() => {
      // Native prompt never arrived — app is already installed or browser blocked it.
      // Move to perms if there is one, otherwise close.
      setStepIdx(idx => {
        const next = idx + 1;
        if (next < steps.length) return next;
        setVisible(false);
        return idx;
      });
    }, 15000);
    return () => clearTimeout(t);
  }, [visible, steps, stepIdx, canNative]);

  /* ── decide which steps to show ── */
  useEffect(() => {
    const delay = standalone.current ? DELAY_SA : DELAY_BROWSER;
    const t = setTimeout(() => {
      const sa        = standalone.current;
      const installed = sa || localStorage.getItem(KEY_INSTALLED) === "1";
      const snoozed   = Date.now() < parseInt(localStorage.getItem(KEY_SNOOZE) ?? "0", 10);
      const permsDoneLocal = localStorage.getItem(permsKey) === "1";

      const needSteps: Step[] = [];

      // Install step — only if not already installed and not snoozed
      if (!installed && !snoozed) {
        const b = browser.current;
        if (b === "ios-safari" || b === "firefox" || b === "native") {
          needSteps.push("install");
        }
      }

      // Permissions step — uses context-aware key so browser dismiss ≠ standalone dismiss
      if (!permsDoneLocal) needSteps.push("perms");

      if (needSteps.length === 0) return;
      setSteps(needSteps);
      setStepIdx(0);
      setVisible(true);
    }, delay);
    return () => clearTimeout(t);
  }, [permsKey]);

  /* ── helpers ── */
  function advanceOrClose() {
    setStepIdx(idx => {
      const next = idx + 1;
      if (next < steps.length) return next;
      setVisible(false);
      return idx;
    });
  }

  function snooze() {
    localStorage.setItem(KEY_SNOOZE, String(Date.now() + SNOOZE_DAYS * 86_400_000));
    advanceOrClose();
  }

  async function handleInstall() {
    if (browser.current === "native" && nativePrompt.current) {
      await nativePrompt.current.prompt();
      const { outcome } = await nativePrompt.current.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(KEY_INSTALLED, "1");
        // advance to perms — `appinstalled` event will also fire, that's fine
        advanceOrClose();
        return;
      }
      // dismissed — snooze install and move on
      snooze();
      return;
    }
    // iOS Safari / Firefox — user read the instructions, tapped "Done"
    advanceOrClose();
  }

  async function handlePermissions() {
    // 1. Notifications
    let notifGranted = Notification.permission === "granted";
    if (!notifGranted && "Notification" in window && Notification.permission === "default") {
      try {
        const r = await Notification.requestPermission();
        notifGranted = r === "granted";
      } catch { /* ignore */ }
    }
    if (notifGranted) playDing();

    // 2. GPS / Location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          try {
            localStorage.setItem("geem_gps_v2", JSON.stringify({
              lat:      pos.coords.latitude,
              lng:      pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              ts:       Date.now(),
            }));
          } catch { /* ignore */ }
        },
        () => { /* denied — fine */ },
        { timeout: 15000, maximumAge: 300_000, enableHighAccuracy: false },
      );
    }

    localStorage.setItem(permsKey, "1");
    setPermsDone(true);
    setTimeout(() => setVisible(false), 1200);
  }

  function skipPerms() {
    localStorage.setItem(permsKey, "1");
    setVisible(false);
  }

  /* ── nothing to render ── */
  if (!visible || steps.length === 0) return null;

  const currentStep = steps[stepIdx];
  const totalSteps  = steps.length;

  /* Native prompt hasn't arrived yet — wait silently.
   * When beforeinstallprompt fires, setCanNative(true) triggers a re-render
   * and the install card appears.  The 15-second fallback effect above handles
   * the case where the event never arrives (already installed / blocked). */
  if (currentStep === "install" && browser.current === "native" && !canNative) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-300"
        onClick={() => { if (currentStep === "install") snooze(); }}
      />

      {/* Card */}
      <div className="pointer-events-auto relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-90 duration-300">

        {/* ── Gradient header ── */}
        <div className="relative bg-gradient-to-br from-primary to-primary/70 px-5 pt-6 pb-8">
          <button
            onClick={() => currentStep === "install" ? snooze() : skipPerms()}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <img
              src={appIcon}
              alt={appName}
              className="h-12 w-12 rounded-2xl shadow-lg object-cover border-2 border-white/30"
            />
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">
                {currentStep === "install" ? "Get the App" : "Enable Permissions"}
              </p>
              <p className="text-white font-bold text-base leading-tight">{appName}</p>
            </div>
          </div>

          {totalSteps > 1 && (
            <div className="flex gap-1.5 mt-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === stepIdx ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Pull-up content panel ── */}
        <div className="-mt-5 rounded-t-3xl bg-card relative z-10">

          {/* ══ INSTALL STEP ══ */}
          {currentStep === "install" && (
            <div className="px-5 pt-6 pb-5">
              <h2 className="text-lg font-bold text-foreground mb-1">Install on your device</h2>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Add {appName} to your home screen — faster, full-screen, works offline.
              </p>

              {/* Benefits */}
              <ul className="space-y-2.5 mb-6">
                {[
                  { icon: "⚡", text: "Loads instantly, faster than the browser" },
                  { icon: "📵", text: "Works offline — browse without internet" },
                  { icon: "🔔", text: "Get order alerts & push notifications" },
                  { icon: "🏠", text: "Home screen icon, no address bar" },
                ].map((b) => (
                  <li key={b.text} className="flex items-center gap-2.5 text-sm text-foreground">
                    <span className="text-base w-6 text-center flex-shrink-0">{b.icon}</span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>

              {/* iOS Safari instructions */}
              {browser.current === "ios-safari" && (
                <div className="mb-5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Install on iPhone / iPad:</p>
                  <ol className="space-y-1.5">
                    {[
                      { icon: <Share className="h-3.5 w-3.5" />,        text: "Tap the Share button below" },
                      { icon: <Plus className="h-3.5 w-3.5" />,         text: 'Choose "Add to Home Screen"' },
                      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: 'Tap "Add" to confirm' },
                    ].map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-blue-700">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-800 text-[10px]">
                          {i + 1}
                        </span>
                        <span className="flex items-center gap-1">{s.icon} {s.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Firefox instructions */}
              {browser.current === "firefox" && (
                <div className="mb-5 rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
                  <p className="text-xs font-semibold text-orange-800 mb-2">
                    {isFirefoxAndroid() ? "Install on Firefox Android:" : "Install on Firefox:"}
                  </p>
                  <ol className="space-y-1.5">
                    {(isFirefoxAndroid()
                      ? ["Tap the ⋮ menu (top right)", 'Choose "Add to Home Screen"', 'Tap "Add" to confirm']
                      : isFirefoxDesktop()
                      ? ["Click the ⊕ install icon in the address bar", "Click \"Install\"", "Click \"Install\" again to confirm"]
                      : ["Open the browser menu", 'Choose "Add to Home Screen"', "Confirm installation"]
                    ).map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-orange-700">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-800 text-[10px]">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Native one-tap install */}
              {browser.current === "native" && canNative && (
                <Button
                  className="w-full h-12 font-semibold text-base gap-2 mb-2.5"
                  onClick={handleInstall}
                >
                  <Download className="h-5 w-5" />
                  Install Now — It's Free
                </Button>
              )}

              {/* iOS / Firefox — "Done" after reading */}
              {(browser.current === "ios-safari" || browser.current === "firefox") && (
                <Button
                  className="w-full h-12 font-semibold text-base gap-2 mb-2.5"
                  onClick={handleInstall}
                >
                  <Smartphone className="h-5 w-5" />
                  Done — I've Added It
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full h-9 text-sm text-muted-foreground"
                onClick={snooze}
              >
                Not now (remind me later)
              </Button>
            </div>
          )}

          {/* ══ PERMISSIONS STEP ══ */}
          {currentStep === "perms" && !permsDone && (
            <div className="px-5 pt-6 pb-5">
              {/* Icons */}
              <div className="flex items-center justify-center gap-4 mb-5">
                <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center gap-1 shadow-sm">
                  <Bell className="h-7 w-7 text-blue-600" />
                  <span className="text-[9px] font-semibold text-blue-600 uppercase tracking-wider">Alerts</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="h-16 w-16 rounded-2xl bg-green-50 border border-green-100 flex flex-col items-center justify-center gap-1 shadow-sm">
                  <MapPin className="h-7 w-7 text-green-600" />
                  <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Location</span>
                </div>
              </div>

              <h2 className="text-lg font-bold text-foreground text-center mb-1">Stay Connected</h2>
              <p className="text-sm text-muted-foreground text-center mb-5 leading-relaxed">
                Allow notifications and location for the best experience.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-3">
                  <Bell className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Order &amp; Delivery Alerts</p>
                    <p className="text-xs text-blue-700 mt-0.5">Sound alerts when your order ships or needs attention.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-100 px-3.5 py-3">
                  <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">GPS Location</p>
                    <p className="text-xs text-green-700 mt-0.5">Auto-fill your city and confirm delivery coverage area.</p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-12 font-semibold text-base gap-2 mb-2.5"
                onClick={handlePermissions}
              >
                <Bell className="h-5 w-5" />
                Allow Notifications &amp; Location
              </Button>
              <Button
                variant="ghost"
                className="w-full h-9 text-sm text-muted-foreground"
                onClick={skipPerms}
              >
                Skip for now
              </Button>
            </div>
          )}

          {/* ══ SUCCESS ══ */}
          {currentStep === "perms" && permsDone && (
            <div className="px-5 pt-8 pb-10 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">You're all set!</h2>
              <p className="text-sm text-muted-foreground">
                You'll receive order alerts and we can assist with delivery location.
              </p>
            </div>
          )}

          <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      </div>
    </div>
  );
}
