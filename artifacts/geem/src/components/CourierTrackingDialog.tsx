import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar, CheckCircle2, Clock3, ExternalLink, MapPin, Package,
  RefreshCw, ShieldCheck, Truck, UserRound, Weight,
} from "lucide-react";

export interface CourierTrackingData {
  courier: string;
  provider: string | null;
  cn: string;
  found: boolean;
  supported: boolean;
  status: string | null;
  message: string;
  sourceUrl: string | null;
  origin: string | null;
  destination: string | null;
  shipper: string | null;
  consignee: string | null;
  referenceNo: string | null;
  bookingDate: string | null;
  pieces: string | null;
  packetWeight: string | null;
  signedFor: string | null;
  deliveredTo: string | null;
  deliveredAt: string | null;
  details: Array<{ label: string; value: string }>;
  events: Array<{ date: string; time: string | null; description: string }>;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courierId?: number | null;
  provider?: string | null;
  courierName?: string | null;
  cn: string | null | undefined;
  sourceUrl?: string | null;
};

function Info({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

export function CourierTrackingDialog({
  open, onOpenChange, courierId, provider, courierName, cn, sourceUrl,
}: Props) {
  const query = useQuery<CourierTrackingData>({
    queryKey: ["courier-live-tracking-dialog", courierId, provider, cn],
    queryFn: () => axiosInstance.get<CourierTrackingData>(
      courierId ? `/couriers/${courierId}/track` : "/courier-tracking",
      { params: courierId ? { cn } : { provider: provider ?? "leopard", cn } },
    ).then(response => response.data),
    enabled: open && Boolean(cn && (courierId || provider || courierName)),
    retry: false,
    staleTime: 0,
  });

  const data = query.data;
  const externalUrl = data?.sourceUrl ?? sourceUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Live Parcel Tracking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 border px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{data?.courier ?? courierName ?? "Courier"} · CN / Tracking No.</p>
              <p className="font-mono text-lg font-bold text-slate-900">{cn}</p>
            </div>
            <div className="flex items-center gap-2">
              {data?.status && <Badge className="bg-blue-600 hover:bg-blue-600">{data.status}</Badge>}
              <Button
                size="icon"
                variant="outline"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                aria-label="Refresh tracking"
              >
                <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {query.isLoading && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-5 text-sm text-blue-800 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Checking Leopards Courier for the latest status…
            </div>
          )}
          {query.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              The courier tracking service could not be reached. Please refresh or use the official tracking page.
            </div>
          )}
          {data && !data.found && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {data.message}
            </div>
          )}

          {data?.found && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Info icon={MapPin} label="From" value={data.origin} />
                <Info icon={MapPin} label="To" value={data.destination} />
                <Info icon={Package} label="Pieces" value={data.pieces} />
                <Info icon={Weight} label="Weight" value={data.packetWeight} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 rounded-xl border p-4">
                <Info icon={UserRound} label="Shipper" value={data.shipper} />
                <Info icon={UserRound} label="Receiver / Consignee" value={data.consignee} />
                <Info icon={Calendar} label="Booking date" value={data.bookingDate} />
                <Info icon={ShieldCheck} label="Reference number" value={data.referenceNo} />
              </div>

              {(data.signedFor || data.deliveredAt || data.deliveredTo) && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-green-900 mb-3">
                    <CheckCircle2 className="h-4 w-4" /> Delivery confirmation
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Info icon={UserRound} label="Signed for by" value={data.signedFor} />
                    <Info icon={Calendar} label="Delivered date & time" value={data.deliveredAt} />
                    <Info icon={MapPin} label="Delivered to" value={data.deliveredTo} />
                  </div>
                </div>
              )}

              {data.events.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-blue-600" /> Shipment activity
                  </h3>
                  <div className="rounded-xl border divide-y">
                    {data.events.map((event, index) => (
                      <div key={`${event.date}-${event.time}-${index}`} className="flex gap-3 px-3 py-3">
                        <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${index === 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                          {index === 0 ? <Truck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{event.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{event.date}{event.time ? ` · ${event.time}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {externalUrl && (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline">
              Open official courier tracking page <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}