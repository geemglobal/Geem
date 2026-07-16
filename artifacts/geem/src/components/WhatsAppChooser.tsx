import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import type { WAOpenDetail } from "@/lib/whatsapp";

function waUrl(phone: string, text: string | undefined, pkg: "com.whatsapp" | "com.whatsapp.w4b") {
  const textParam = text ? `&text=${encodeURIComponent(text)}` : "";
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    return `intent://send?phone=${phone}${textParam}#Intent;scheme=whatsapp;package=${pkg};S.browser_fallback_url=https%3A%2F%2Fwa.me%2F${phone};end`;
  }
  const scheme = pkg === "com.whatsapp" ? "whatsapp" : "whatsappbusiness";
  return `${scheme}://send?phone=${phone}${textParam}`;
}

export function WhatsAppChooser() {
  const [pending, setPending] = useState<WAOpenDetail | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      setPending((e as CustomEvent<WAOpenDetail>).detail);
    }
    window.addEventListener("wa:open", handler);
    return () => window.removeEventListener("wa:open", handler);
  }, []);

  if (!pending) return null;

  const close = () => setPending(null);
  const mainUrl = waUrl(pending.phone, pending.text, "com.whatsapp");
  const bizUrl = waUrl(pending.phone, pending.text, "com.whatsapp.w4b");

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40" onClick={close} />
      <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <span className="font-bold text-base">Send via WhatsApp</span>
          </div>
          <button onClick={close} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Choose which WhatsApp to open:</p>
        <div className="flex flex-col gap-3">
          <a
            href={mainUrl}
            onClick={close}
            className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors active:scale-95 no-underline"
          >
            <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">WhatsApp</p>
              <p className="text-xs text-gray-500">Personal / main account</p>
            </div>
          </a>
          <a
            href={bizUrl}
            onClick={close}
            className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors active:scale-95 no-underline"
          >
            <div className="w-12 h-12 rounded-full bg-[#128C7E] flex items-center justify-center shrink-0">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">WhatsApp Business</p>
              <p className="text-xs text-gray-500">Business account</p>
            </div>
          </a>
        </div>
        <p className="text-xs text-center text-gray-400 mt-4">Tap outside to cancel</p>
      </div>
    </>
  );
}
