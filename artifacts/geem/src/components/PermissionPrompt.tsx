import { Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

export function PermissionPrompt() {
  const { show, allowAll, dismiss } = usePermissions();

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        <div className="flex flex-col items-center pt-8 pb-2 px-6 text-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center">
              <Bell className="h-7 w-7 text-blue-600" />
            </div>
            <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
              <MapPin className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground">Stay Updated</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground leading-relaxed">
            Allow notifications for order alerts and updates, and location access for accurate delivery and local support.
          </p>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2.5">
          <Button className="w-full h-11 font-semibold" onClick={allowAll}>
            Allow & Continue
          </Button>
          <Button variant="ghost" className="w-full h-9 text-sm text-muted-foreground" onClick={dismiss}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
