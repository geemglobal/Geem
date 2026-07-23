import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { useLocation } from "wouter";
import {
  Search, Package, Users, FileText, X, AlertCircle,
  MessageSquarePlus, ChevronDown, ChevronUp, ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleInfo {
  invoiceId: number | null;
  invoiceNumber: string | null;
  paymentStatus: string | null;
  saleDate: string | null;
  customerId: number;
  customerName: string | null;
  customerMobile: string | null;
  customerCity: string | null;
}

interface InventoryResult {
  id: number;
  imei: string;
  deviceId: string | null;
  psid: string | null;
  status: string;
  ptaStatus: string;
  sellingPrice: number;
  brandName: string;
  modelName: string;
  saleInfo: SaleInfo | null;
}

interface SearchResult {
  inventory: InventoryResult[];
  customers: Array<{
    id: number; name: string; phone: string;
    email: string | null; cnic: string | null; city: string | null;
  }>;
  invoices: Array<{
    id: number; invoiceNumber: string; status: string; total: number; date: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  in_stock:  "bg-green-100 text-green-700",
  sold:      "bg-blue-100 text-blue-700",
  returned:  "bg-orange-100 text-orange-700",
  defective: "bg-red-100 text-red-700",
};

const paymentColors: Record<string, string> = {
  paid:    "text-green-600",
  partial: "text-amber-600",
  draft:   "text-gray-500",
  overdue: "text-red-600",
};

function paymentLabel(s: string | null) {
  if (!s) return "—";
  return { paid: "Paid", partial: "Partial", draft: "Unpaid", overdue: "Overdue" }[s] ?? s;
}

function ptaLabel(s: string) {
  return { approved: "Approved", unpaid: "Unpaid", paid: "Paid", pta_blocked: "Blocked" }[s] ?? s;
}

function ptaColor(s: string) {
  return s === "approved" ? "text-green-600"
    : s === "pta_blocked" ? "text-red-600"
    : s === "paid" ? "text-blue-600"
    : "text-amber-600";
}

function waLink(mobile: string | null, msg: string) {
  if (!mobile) return null;
  const num = mobile.replace(/\D/g, "").replace(/^0/, "92");
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

// ── Complaint Dialog ──────────────────────────────────────────────────────────

function ComplaintDialog({
  open, onClose, item,
}: {
  open: boolean;
  onClose: () => void;
  item: InventoryResult | null;
}) {
  const [issue, setIssue] = useState("");
  const [created, setCreated] = useState<{ ticketNumber: string } | null>(null);

  useEffect(() => { if (!open) { setIssue(""); setCreated(null); } }, [open]);

  const mutation = useMutation({
    mutationFn: (body: object) =>
      axiosInstance.post("/service-tickets", body).then(r => r.data),
    onSuccess: (data) => setCreated(data),
  });

  if (!item) return null;
  const si = item.saleInfo;

  function submit() {
    if (!issue.trim() || !si || !item) return;
    mutation.mutate({
      customerId: si.customerId,
      inventoryItemId: item.id,
      imei: item.imei,
      productName: `${item.brandName} ${item.modelName}`,
      invoiceId: si.invoiceId ?? undefined,
      issueDescription: issue.trim(),
      warrantyValid: false,
    });
  }

  const ticketMsg = created && si && item
    ? `Dear ${si.customerName ?? "Customer"}, your complaint has been registered.\n\nTicket: ${created.ticketNumber}\nDevice: ${item.brandName} ${item.modelName} (IMEI: ${item.imei})\nIssue: ${issue.trim()}\n\nWe will update you shortly.\n\n– Geem Team`
    : "";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-orange-500" />
            Make a Complaint
          </DialogTitle>
        </DialogHeader>

        {!created ? (
          <>
            {/* Device info */}
            <div className="rounded-lg bg-muted/50 border px-3 py-2.5 space-y-1 text-sm">
              <div className="font-medium">{item.brandName} {item.modelName}</div>
              <div className="text-muted-foreground font-mono text-xs">{item.imei}</div>
              {si && (
                <div className="flex gap-3 text-xs text-muted-foreground pt-0.5">
                  <span>Customer: <span className="text-foreground font-medium">{si.customerName ?? "—"}</span></span>
                  {si.customerMobile && <span>📞 {si.customerMobile}</span>}
                </div>
              )}
            </div>

            {/* Issue */}
            <div className="space-y-1.5">
              <Label htmlFor="complaint-issue">Issue Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="complaint-issue"
                value={issue}
                onChange={e => setIssue(e.target.value)}
                placeholder="Describe the problem in detail…"
                rows={4}
                className="resize-none"
              />
            </div>

            {mutation.isError && (
              <p className="text-xs text-destructive">Failed to create ticket. Please try again.</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={submit}
                disabled={!issue.trim() || mutation.isPending}
                className="gap-1.5"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                {mutation.isPending ? "Creating…" : "Create Ticket"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Ticket Created — <span className="font-mono">{created.ticketNumber}</span></span>
              </div>

              <p className="text-sm text-muted-foreground">
                Notify the customer using the links below:
              </p>

              <div className="flex flex-col gap-2">
                {si?.customerMobile && (
                  <a
                    href={waLink(si.customerMobile, ticketMsg) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-sm font-medium"
                  >
                    <span>💬</span> Send WhatsApp Message
                    <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                  </a>
                )}
                {si?.customerMobile && (
                  <a
                    href={`sms:${si.customerMobile}?body=${encodeURIComponent(`Ticket ${created.ticketNumber} created for your ${item.brandName} ${item.modelName}. We'll update you shortly. – Geem`)}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <span>📱</span> Send SMS
                    <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                  </a>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                You can also view and update this ticket from <strong>Service Tickets</strong> in the sidebar.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => window.open(`/service-tickets`, "_self")} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> View Ticket
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── SoldItemCard ──────────────────────────────────────────────────────────────

function SoldItemCard({
  item, onComplaint, onGoInvoice,
}: {
  item: InventoryResult;
  onComplaint: () => void;
  onGoInvoice: () => void;
}) {
  const si = item.saleInfo!;
  return (
    <div className="mx-2 mb-1.5 rounded-lg border border-blue-200 bg-blue-50/60 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-100/60 border-b border-blue-200">
        <span className="text-xs font-semibold text-blue-700">Sold Device</span>
        {si.invoiceNumber && (
          <button
            onClick={onGoInvoice}
            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
          >
            {si.invoiceNumber} <ExternalLink className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Details grid */}
      <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">Customer</span>
          <div className="font-medium text-foreground">{si.customerName ?? "—"}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Mobile</span>
          <div className="font-medium text-foreground">{si.customerMobile ?? "—"}</div>
        </div>
        <div>
          <span className="text-muted-foreground">City</span>
          <div className="font-medium text-foreground">{si.customerCity ?? "—"}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Sale Date</span>
          <div className="font-medium text-foreground">{si.saleDate ?? "—"}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Payment</span>
          <div className={`font-semibold ${paymentColors[si.paymentStatus ?? ""] ?? "text-foreground"}`}>
            {paymentLabel(si.paymentStatus)}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">PTA</span>
          <div className={`font-semibold ${ptaColor(item.ptaStatus)}`}>
            {ptaLabel(item.ptaStatus)}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="px-3 pb-2">
        <button
          onClick={onComplaint}
          className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md px-2.5 py-1.5 transition-colors"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Make a Complaint / Service Ticket
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedSold, setExpandedSold] = useState<Record<number, boolean>>({});
  const [complaintItem, setComplaintItem] = useState<InventoryResult | null>(null);
  const [autoNavigate, setAutoNavigate] = useState(false);
  const [, setLocation] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fire query only on submitted (Enter-pressed) query
  const { data, isFetching } = useQuery<SearchResult>({
    queryKey: ["global-search", submittedQ],
    queryFn: () =>
      axiosInstance.get<SearchResult>(`/search?q=${encodeURIComponent(submittedQ)}`).then(r => r.data),
    enabled: submittedQ.length >= 2,
    staleTime: 15_000,
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Ctrl+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const go = useCallback((href: string) => {
    setOpen(false);
    setQ("");
    setSubmittedQ("");
    setActiveIndex(-1);
    setAutoNavigate(false);
    setLocation(href);
  }, [setLocation]);

  // Returns the best navigation target for the first result in data
  function getFirstHref(d: SearchResult): string | null {
    if (d.inventory.length > 0) {
      const item = d.inventory[0];
      if (item.status === "in_stock") return `/pos?itemId=${item.id}`;
      if (item.saleInfo?.invoiceId) return `/invoices/${item.saleInfo.invoiceId}`;
      return "/inventory";
    }
    if (d.invoices.length > 0) return `/invoices/${d.invoices[0].id}`;
    if (d.customers.length > 0) return "/customers";
    return null;
  }

  // Auto-navigate to first result as soon as results arrive
  useEffect(() => {
    if (!autoNavigate || isFetching || !data) return;
    const href = getFirstHref(data);
    if (href) {
      go(href);
    } else {
      // No results found — stay on dropdown and show "no results"
      setAutoNavigate(false);
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, autoNavigate, isFetching]);

  const flatItems = useMemo(() => {
    if (!data) return [];
    const items: { href: string }[] = [];
    (data.inventory ?? []).forEach(item =>
      items.push({ href: item.status === "in_stock" ? `/pos?itemId=${item.id}` : `/invoices/${item.saleInfo?.invoiceId ?? ""}` })
    );
    (data.customers ?? []).forEach(() => items.push({ href: "/customers" }));
    (data.invoices ?? []).forEach(inv => items.push({ href: `/invoices/${inv.id}` }));
    return items;
  }, [data]);

  useEffect(() => { setActiveIndex(-1); }, [submittedQ]);

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      // If an item is highlighted — navigate to it (Enter = open)
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        go(flatItems[activeIndex].href);
        return;
      }
      // Otherwise fire the search and auto-navigate to first result
      const trimmed = q.trim();
      if (trimmed.length >= 2) {
        // If same query already has fresh results, jump immediately
        if (submittedQ === trimmed && data && !isFetching) {
          const href = getFirstHref(data);
          if (href) { go(href); return; }
        }
        setAutoNavigate(true);
        setSubmittedQ(trimmed);
        setExpandedSold({});
      }
      return;
    }
    if (!open || flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => {
        const next = Math.min(i + 1, flatItems.length - 1);
        scrollActiveIntoView(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => {
        const next = i <= 0 ? -1 : i - 1;
        scrollActiveIntoView(next);
        return next;
      });
    }
  }

  function scrollActiveIntoView(idx: number) {
    if (!dropdownRef.current || idx < 0) return;
    const el = dropdownRef.current.querySelector(`[data-result-index="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }

  const total = (data?.inventory.length ?? 0) + (data?.customers.length ?? 0) + (data?.invoices.length ?? 0);
  const showDropdown = open && submittedQ.length >= 2;

  let resultIdx = -1;

  return (
    <>
      <div ref={ref} className="relative w-64 lg:w-80">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search IMEI, customer… (Enter to search)"
            className="pl-8 pr-7 h-8 text-sm bg-muted/40 border-muted"
          />
          {q ? (
            <button onClick={() => { setQ(""); setSubmittedQ(""); setOpen(false); setActiveIndex(-1); }}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="absolute right-2 top-1.5 text-xs text-muted-foreground bg-muted px-1 rounded hidden lg:block">⌘K</span>
          )}
        </div>

        {/* Hint when typing but not yet submitted */}
        {open && q.length >= 2 && q.trim() !== submittedQ && (
          <div className="absolute top-full mt-1 w-full bg-popover border rounded-lg shadow-md z-[100] px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <Search className="h-3 w-3" />
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">Enter</kbd> to search for <strong>"{q.trim()}"</strong>
          </div>
        )}

        {showDropdown && (
          <div ref={dropdownRef} className="absolute top-full mt-1.5 w-full min-w-[380px] right-0 bg-popover border border-border rounded-lg shadow-xl z-[100] overflow-hidden max-h-[500px] overflow-y-auto">
            {isFetching && (
              <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="animate-pulse">Searching for "{submittedQ}"…</span>
              </div>
            )}

            {!isFetching && total === 0 && (
              <div className="p-6 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No results for <strong>"{submittedQ}"</strong></p>
                <p className="text-xs text-muted-foreground mt-1">Try IMEI, customer name, CNIC, or invoice number</p>
              </div>
            )}

            {/* ── Inventory ── */}
            {data && data.inventory.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 flex items-center gap-1.5 border-b border-border sticky top-0">
                  <Package className="h-3 w-3" /> Inventory ({data.inventory.length})
                </div>
                {data.inventory.map(item => {
                  resultIdx++;
                  const isActive = resultIdx === activeIndex;
                  const idx = resultIdx;
                  const isSold = item.status === "sold" && !!item.saleInfo;
                  const isExpanded = !!expandedSold[item.id];

                  return (
                    <div key={item.id}>
                      <button
                        data-result-index={idx}
                        onClick={() => {
                          if (isSold) {
                            setExpandedSold(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          } else {
                            go(`/pos?itemId=${item.id}`);
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 transition-colors text-sm border-b border-border/50 ${isSold ? "" : "last:border-0"} ${isActive ? "bg-accent" : "hover:bg-accent"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-medium">{item.brandName} {item.modelName}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{item.imei}</span>
                            {item.deviceId && <span className="ml-1 text-xs text-muted-foreground">ID:{item.deviceId}</span>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0 items-center">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColors[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {item.status === "in_stock" ? "In Stock" : item.status}
                            </span>
                            {isSold && (isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>Rs {item.sellingPrice.toLocaleString()}</span>
                          {item.ptaStatus && (
                            <span className={ptaColor(item.ptaStatus)}>PTA: {ptaLabel(item.ptaStatus)}</span>
                          )}
                          {item.psid && <span>PSID: {item.psid}</span>}
                          {item.status === "in_stock" && (
                            <span className="text-green-600 font-medium ml-auto">→ Create invoice</span>
                          )}
                          {isSold && !isExpanded && item.saleInfo?.customerName && (
                            <span className="ml-auto text-blue-600">👤 {item.saleInfo.customerName}</span>
                          )}
                        </div>
                      </button>

                      {/* Expanded sold info */}
                      {isSold && isExpanded && (
                        <SoldItemCard
                          item={item}
                          onComplaint={() => { setComplaintItem(item); setOpen(false); }}
                          onGoInvoice={() => item.saleInfo?.invoiceId
                            ? go(`/invoices/${item.saleInfo.invoiceId}`)
                            : undefined
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Customers ── */}
            {data && data.customers.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 flex items-center gap-1.5 border-b border-border sticky top-0">
                  <Users className="h-3 w-3" /> Customers ({data.customers.length})
                </div>
                {data.customers.map(c => {
                  resultIdx++;
                  const isActive = resultIdx === activeIndex;
                  const idx = resultIdx;
                  return (
                    <button
                      key={c.id}
                      data-result-index={idx}
                      onClick={() => go("/customers")}
                      className={`w-full text-left px-3 py-2.5 transition-colors text-sm border-b border-border/50 last:border-0 ${isActive ? "bg-accent" : "hover:bg-accent"}`}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>📞 {c.phone}</span>
                        {c.city && <span>📍 {c.city}</span>}
                        {c.cnic && <span>ID: {c.cnic}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Invoices ── */}
            {data && data.invoices.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 flex items-center gap-1.5 border-b border-border sticky top-0">
                  <FileText className="h-3 w-3" /> Invoices ({data.invoices.length})
                </div>
                {data.invoices.map(inv => {
                  resultIdx++;
                  const isActive = resultIdx === activeIndex;
                  const idx = resultIdx;
                  return (
                    <button
                      key={inv.id}
                      data-result-index={idx}
                      onClick={() => go(`/invoices/${inv.id}`)}
                      className={`w-full text-left px-3 py-2.5 transition-colors text-sm border-b border-border/50 last:border-0 ${isActive ? "bg-accent" : "hover:bg-accent"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium font-mono">{inv.invoiceNumber}</span>
                        <Badge
                          variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {inv.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Rs {inv.total.toLocaleString()} • {inv.date}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {flatItems.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/30 border-t text-center">
                ↑↓ navigate &nbsp;·&nbsp; Enter to search / open &nbsp;·&nbsp; Esc to close &nbsp;·&nbsp; Click sold item to expand
              </div>
            )}
          </div>
        )}
      </div>

      {/* Complaint dialog — rendered outside the search dropdown */}
      <ComplaintDialog
        open={!!complaintItem}
        onClose={() => setComplaintItem(null)}
        item={complaintItem}
      />
    </>
  );
}
