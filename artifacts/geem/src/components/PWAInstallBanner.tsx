import { useState, useEffect } from "react";
import { X, Download, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

const DISMISS_KEY = "pwa_banner_dismissed_until";
const DISMISS_DAYS = 30;
const SHOW_DELAY_MS = 2500;

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  const isStandalone = !!(window.navigator as { standalone?: boolean }).standalone;
  return isIos && isSafari && !isStandalone;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as { standalone?: boolean }).standalone
  );
}

function isDismissed() {
  const until = localStorage.getItem(DISMISS_KEY);
  return !!until && Date.now() < parseInt(until, 10);
}

interface Props {
  appName?: string;
  appIcon?: string;
}

export function PWAInstallBanner({ appName = "Geem", appIcon = "/icon-192.png" }: Props) {
  const { canInstall, install } = usePwaInstall();
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;
    const iosDevice = isIosSafari();
    setIos(iosDevice);

    if (iosDevice) {
      const t = setTimeout(() => setShow(true), SHOW_DELAY_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!canInstall || isStandalone() || isDismissed()) return;
    const t = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [canInstall]);

  function dismiss() {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
  }

  async function handleInstall() {
    await install();
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="pointer-events-auto mx-3 mb-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* header row */}
        <div className="flex items-start gap-3 p-4">
          <img src={appIcon} alt={appName} className="h-14 w-14 rounded-2xl flex-shrink-0 shadow object-cover" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Smartphone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Install App</span>
            </div>
            <p className="font-bold text-sm text-foreground leading-tight">{appName}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {ios
                ? "Install on your iPhone for faster access, offline use, and a full-screen experience."
                : "Install for faster access, offline support, and a full-screen experience — no App Store needed."}
            </p>

            {ios ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1 text-xs text-foreground">
                <span className="text-muted-foreground">Tap the</span>
                <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded px-1.5 py-0.5 font-medium">
                  <Share className="h-3 w-3" /> Share
                </span>
                <span className="text-muted-foreground">button, then</span>
                <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded px-1.5 py-0.5 font-medium">
                  <Plus className="h-3 w-3" /> Add to Home Screen
                </span>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold" onClick={handleInstall}>
                  <Download className="h-3.5 w-3.5" />
                  Install Now
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={dismiss}>
                  Not now
                </Button>
              </div>
            )}
          </div>

          <button
            onClick={dismiss}
            className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* iOS bottom action */}
        {ios && (
          <div className="border-t border-border bg-muted/40 px-4 py-2 flex justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={dismiss}>
              Got it
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
