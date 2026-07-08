import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { isIccid, imeiLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  ChevronLeft, GripVertical, Trash2, PlusCircle, Search,
  User, Pencil, X, ChevronDown, RefreshCw, CreditCard, Wallet,
} from "lucide-react";

interface Currency { code: string; symbol: string; name: string; flag: string; }

const CURRENCIES: Currency[] = [
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", flag: "🇵🇰" },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SAR", symbol: "SR", name: "Saudi Riyal", flag: "🇸🇦" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", flag: "🇹🇷" },
  { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar", flag: "🇰🇼" },
  { code: "QAR", symbol: "QR", name: "Qatari Riyal", flag: "🇶🇦" },
];

function CurrencyDropdown({ selected, rate, loading, onSelect }: { selected: Currency; rate: number; loading: boolean; onSelect: (c: Currency) => void; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded px-2 py-0.5 bg-gray-50 hover:bg-gray-100 transition-colors">
        {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <span>{selected.flag}</span>}
        <span className="font-medium">{selected.code} ({selected.symbol})</span>
        {selected.code !== "PKR" && !loading && <span className="text-[10px] text-muted-foreground/60">1 PKR = {rate.toFixed(4)} {selected.code}</span>}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 bg-white border rounded-lg shadow-xl overflow-hidden" style={{ top: "100%" }}>
          <div className="max-h-64 overflow-y-auto">
            {CURRENCIES.map(c => (
              <button key={c.code} type="button"
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-blue-50 transition-colors ${selected.code === c.code ? "bg-blue-50/70 font-medium" : ""}`}
                onClick={() => { onSelect(c); setOpen(false); }}>
                <span className="text-base">{c.flag}</span>
                <div className="flex-1 min-w-0"><span className="font-medium">{c.code}</span><span className="text-muted-foreground ml-1.5 text-xs">{c.name}</span></div>
                <span className="text-muted-foreground text-xs">{c.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface InvItem { id: number; productName: string; brandName: string; modelName: string; imei: string; deviceId: string | null; ptaStatus: string | null; sellingPrice: number; }
interface Customer { id: number; name: string; mobile: string; email?: string | null; address?: string | null; city?: string | null; walletBalance?: number; }
interface LineItem { key: string; inventoryItemId: number | null; description: string; details: string; imei: string; deviceId: string | null; ptaStatus: string | null; qty: number; price: string; taxRate: number; taxLabel: string; searchQuery: string; searchOpen: boolean; isCreatingItem: boolean; newDesc: string; newPrice: string; }

let _key = 0;
function newLine(): LineItem { return { key: String(++_key), inventoryItemId: null, description: "", details: "", imei: "", deviceId: null, ptaStatus: null, qty: 1, price: "", taxRate: 0, taxLabel: "", searchQuery: "", searchOpen: false, isCreatingItem: false, newDesc: "", newPrice: "" }; }

// ── Tax dropdown ──────────────────────────────────────────────────────────────
interface TaxOption { id: string; label: string; detail: string; rate: number; }
const BUILT_IN_TAXES_POS: TaxOption[] = [
  { id: "st18", label: "Sales Tax 18%", detail: "NTN: 6943433", rate: 18 },
];
let _sessionTaxesPOS: TaxOption[] = [];
function getAllTaxesPOS() { return [...BUILT_IN_TAXES_POS, ..._sessionTaxesPOS]; }
function addSessionTaxPOS(t: TaxOption) { _sessionTaxesPOS = [..._sessionTaxesPOS, t]; }

function TaxDropdown({ taxRate, taxLabel, onSelect }: { taxRate: number; taxLabel: string; onSelect: (rate: number, label: string) => void; }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRateStr, setNewRateStr] = useState("");
  const [taxes, setTaxes] = useState<TaxOption[]>(getAllTaxesPOS);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCreating(false); setSearch(""); } }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const selected = taxRate > 0 ? (taxes.find(t => t.rate === taxRate && t.label === taxLabel) ?? { id: "?", label: taxLabel || `Tax ${taxRate}%`, detail: "", rate: taxRate }) : null;
  const filtered = taxes.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.detail.toLowerCase().includes(search.toLowerCase()));
  function handleCreate() {
    const r = parseFloat(newRateStr);
    if (!newName.trim() || isNaN(r) || r <= 0) return;
    const t: TaxOption = { id: `c_${Date.now()}`, label: newName.trim(), detail: "", rate: r };
    addSessionTaxPOS(t);
    setTaxes(getAllTaxesPOS());
    onSelect(t.rate, t.label);
    setOpen(false); setCreating(false); setNewName(""); setNewRateStr("");
  }
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(o => !o); setCreating(false); setSearch(""); }}
        className={`flex items-center justify-between gap-1 text-sm border rounded px-2 py-1 w-full transition-colors ${selected ? "border-gray-300 bg-white" : "border-gray-200 bg-gray-50 text-muted-foreground hover:bg-gray-100"}`}>
        <span className="truncate">{selected ? selected.label : "Select a tax"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 bg-white border rounded-lg shadow-xl overflow-hidden" style={{ top: "100%" }}>
          {!creating ? (
            <>
              <div className="p-2 border-b bg-gray-50/70">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input autoFocus className="w-full pl-7 pr-2 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500 bg-white" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filtered.map(t => (
                  <button key={t.id} type="button" className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${taxRate === t.rate && taxLabel === t.label ? "bg-blue-50/60 font-medium" : ""}`}
                    onMouseDown={e => { e.preventDefault(); onSelect(t.rate, t.label); setOpen(false); setSearch(""); }}>
                    <p>{t.label}</p>
                    {t.detail && <p className="text-xs text-muted-foreground">({t.detail})</p>}
                  </button>
                ))}
                {!filtered.length && <p className="px-3 py-3 text-sm text-muted-foreground text-center">No taxes found</p>}
              </div>
              <div className="border-t bg-gray-50/70">
                <button type="button" className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors" onMouseDown={e => { e.preventDefault(); setCreating(true); setSearch(""); }}>
                  <PlusCircle className="h-4 w-4" />Create a new tax
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Tax</p>
              <input autoFocus className="w-full px-2 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Tax name (e.g. GST 5%)" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
              <div className="flex items-center gap-1.5">
                <input className="flex-1 px-2 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Rate" value={newRateStr} onChange={e => setNewRateStr(e.target.value.replace(/[^\d.]/g, ""))} onKeyDown={e => e.key === "Enter" && handleCreate()} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={!newName.trim() || !newRateStr} className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 transition-colors" onMouseDown={e => { e.preventDefault(); handleCreate(); }}>Add tax</button>
                <button type="button" className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50 transition-colors" onMouseDown={e => { e.preventDefault(); setCreating(false); }}>Back</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LineRow({ line, results, isActive, onActivate, onUpdate, onRemove, onSelect, onConfirmNew, canDelete, symbol, rate }: {
  line: LineItem; results: InvItem[]; isActive: boolean; onActivate: () => void; onUpdate: (p: Partial<LineItem>) => void;
  onRemove: () => void; onSelect: (item: InvItem) => void; onConfirmNew: () => void; canDelete: boolean; symbol: string; rate: number;
  }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const amount = line.qty * parseFloat(line.price || "0");
  useEffect(() => {
    function onDown(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onUpdate({ searchOpen: false, isCreatingItem: false }); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  useEffect(() => { if (line.searchOpen && isActive && searchInputRef.current) searchInputRef.current.focus(); }, [line.searchOpen, isActive]);
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && results.length > 0) { e.preventDefault(); onSelect(results[0]); }
    if (e.key === "Escape") onUpdate({ searchOpen: false });
  }
  return (
    <div ref={wrapRef} className="relative">
      <div className="grid grid-cols-[16px_150px_1fr_76px_88px_88px_24px] gap-x-3 py-3 items-start">
        <div className="pt-2"><GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab" /></div>
        <div>
          <input className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Type an item name"
            readOnly={!line.searchOpen} value={line.searchOpen ? line.searchQuery : line.description}
            onFocus={() => { onActivate(); onUpdate({ searchOpen: true, searchQuery: line.description }); }}
            onChange={e => onUpdate({ searchQuery: e.target.value })} onKeyDown={onKeyDown} />
          {!line.searchOpen && (line.deviceId || line.imei) && (
            <div className="mt-0.5 pl-1 font-mono space-y-0.5">
              {line.deviceId ? <><p className="text-xs font-semibold text-foreground/80">Device ID: {line.deviceId}</p>{line.imei && <p className="text-xs text-muted-foreground">{imeiLabel(line.imei)}: {line.imei}</p>}</> : line.imei && <p className="text-xs font-semibold text-foreground/80">{imeiLabel(line.imei)}: {line.imei}</p>}
              {line.ptaStatus === "approved" && <p className="font-sans text-[10px] font-medium text-green-600">✓ PTA Approved</p>}
            </div>
          )}
        </div>
        <textarea className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none" rows={3} placeholder="Description or details…" value={line.details} onChange={e => onUpdate({ details: e.target.value })} />
        <input type="number" min={1} className="w-full px-2 py-1.5 text-sm border rounded text-right outline-none focus:ring-1 focus:ring-blue-500" value={line.qty} onChange={e => onUpdate({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
        <input className="w-full px-2 py-1.5 text-sm border rounded text-right outline-none focus:ring-1 focus:ring-blue-500" placeholder="0.00" value={line.price} onChange={e => onUpdate({ price: e.target.value.replace(/[^\d.]/g, "") })} />
        <div className="pt-2 text-right text-sm font-medium text-muted-foreground">{amount > 0 ? `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</div>
        <div className="pt-2">{canDelete && <button type="button" onClick={onRemove} className="text-muted-foreground/50 hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>}</div>
      </div>

      {/* Tax sub-row — only when an item has been added */}
      {line.description && (
        <div className="flex items-center justify-end gap-3 pb-1.5">
          <span className="text-sm text-muted-foreground">Tax</span>
          <div className="w-[150px]">
            <TaxDropdown taxRate={line.taxRate} taxLabel={line.taxLabel} onSelect={(r, l) => onUpdate({ taxRate: r, taxLabel: l })} />
          </div>
          <div className="w-[88px] text-right text-sm text-muted-foreground font-medium">
            {line.taxRate > 0 && (line.qty * parseFloat(line.price || "0")) > 0
              ? `${symbol}${((line.qty * parseFloat(line.price || "0")) * line.taxRate / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </div>
          <div className="w-[24px] flex items-center justify-center">
            {line.taxRate > 0 && (
              <button type="button" onClick={() => onUpdate({ taxRate: 0, taxLabel: "" })} className="text-muted-foreground/50 hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {line.searchOpen && isActive && (
        <div className="absolute left-5 right-6 z-50 bg-white border rounded-lg shadow-xl overflow-hidden" style={{ top: "calc(100% - 4px)" }}>
          {!line.isCreatingItem ? (
            <>
              <div className="p-2 border-b bg-gray-50/70">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input ref={searchInputRef} className="w-full pl-8 pr-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500 bg-white" placeholder="Search by name, model, IMEI, device ID…" value={line.searchQuery} onChange={e => onUpdate({ searchQuery: e.target.value })} onKeyDown={onKeyDown} />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {results.map(item => (
                  <button key={item.id} className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 flex justify-between items-start gap-4 border-b last:border-0" onMouseDown={e => { e.preventDefault(); onSelect(item); }}>
                    <div className="min-w-0"><p className="text-sm font-medium truncate">{item.productName}</p><p className="text-xs text-muted-foreground truncate">{item.deviceId ? `Device ID: ${item.deviceId}` : item.imei ? `${imeiLabel(item.imei)}: ${item.imei}` : item.brandName}</p></div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{symbol}{(item.sellingPrice * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </button>
                ))}
                {line.searchQuery.length >= 1 && !results.length && <p className="px-4 py-3 text-sm text-muted-foreground text-center">No matching items</p>}
                {!line.searchQuery && <p className="px-4 py-4 text-sm text-muted-foreground text-center">Start typing to search…</p>}
              </div>
              <div className="border-t bg-gray-50/70">
                <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm text-blue-600 flex items-center gap-2" onClick={() => onUpdate({ isCreatingItem: true, newDesc: line.searchQuery, newPrice: "" })}>
                  <PlusCircle className="h-4 w-4" />Create a new item
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Item</p>
              <input autoFocus className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Description *" value={line.newDesc} onChange={e => onUpdate({ newDesc: e.target.value })} onKeyDown={e => e.key === "Enter" && line.newDesc && line.newPrice && onConfirmNew()} />
              <input className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Price (Rs) *" value={line.newPrice} onChange={e => onUpdate({ newPrice: e.target.value.replace(/[^\d.]/g, "") })} onKeyDown={e => e.key === "Enter" && line.newDesc && line.newPrice && onConfirmNew()} />
              <div className="flex gap-2 pt-1">
                <button type="button" className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 transition-colors" disabled={!line.newDesc || !line.newPrice} onClick={() => { if (line.newDesc && line.newPrice) onConfirmNew(); }}>Add item</button>
                <button type="button" className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50 transition-colors" onClick={() => onUpdate({ isCreatingItem: false })}>Back</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function POS() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const today = new Date().toISOString().split("T")[0];
  const custPanelRef = useRef<HTMLDivElement>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [creatingCust, setCreatingCust] = useState(false);
  const [custHighlight, setCustHighlight] = useState(0);
  const [newCust, setNewCust] = useState({ name: "", mobile: "", email: "", address: "", city: "" });

  const [saleDate, setSaleDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeQuery = lines.find(l => l.key === activeKey)?.searchQuery ?? "";

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(CURRENCIES[0]);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);
  const ratesCache = useRef<Record<string, number>>({});
  const prevRateRef = useRef(1);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "bank" | "other" | "wallet">("cash");
  const [useWallet, setUseWallet] = useState(false);

  useEffect(() => {
    if (selectedCurrency.code === "PKR") { setExchangeRate(1); return; }
    if (ratesCache.current[selectedCurrency.code] !== undefined) { setExchangeRate(ratesCache.current[selectedCurrency.code]); return; }
    setRateLoading(true);
    fetch("https://open.er-api.com/v6/latest/PKR").then(r => r.json()).then((data: { rates: Record<string, number> }) => {
      if (data.rates) { Object.assign(ratesCache.current, data.rates); setExchangeRate(data.rates[selectedCurrency.code] ?? 1); }
    }).catch(() => {}).finally(() => setRateLoading(false));
  }, [selectedCurrency.code]);

  useEffect(() => {
    const oldRate = prevRateRef.current, newRate = exchangeRate;
    if (oldRate !== newRate && oldRate > 0 && newRate > 0) {
      setLines(ls => ls.map(l => { const old = parseFloat(l.price || "0"); if (old === 0) return l; return { ...l, price: parseFloat(((old / oldRate) * newRate).toFixed(6)).toString() }; }));
    }
    prevRateRef.current = newRate;
  }, [exchangeRate]);

  const { data: custResults } = useQuery({ queryKey: ["pos-cust", custQuery], queryFn: () => axiosInstance.get<{ customers: Customer[] }>(`/customers?search=${encodeURIComponent(custQuery)}&limit=8`).then(r => r.data), enabled: custQuery.length >= 1 });
  const custList = custResults?.customers ?? [];
  useEffect(() => { setCustHighlight(0); }, [custList.length, custQuery]);

  const { data: itemResults } = useQuery({ queryKey: ["pos-items", activeQuery], queryFn: () => axiosInstance.get<{ items: InvItem[] }>(`/inventory?search=${encodeURIComponent(activeQuery)}&status=in_stock&limit=10`).then(r => r.data), enabled: activeQuery.length >= 1 });

  useEffect(() => {
    function onDown(e: MouseEvent) { if (custPanelRef.current && !custPanelRef.current.contains(e.target as Node)) { setCustOpen(false); setCreatingCust(false); } }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const createCustMutation = useMutation({
    mutationFn: (b: object) => axiosInstance.post("/customers", b).then(r => r.data),
    onSuccess: (c: Customer) => { setCustomer(c); setCustOpen(false); setCreatingCust(false); setNewCust({ name: "", mobile: "", email: "", address: "", city: "" }); toast({ title: "Customer created" }); },
    onError: () => toast({ title: "Error creating customer", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: (b: object) => axiosInstance.post("/invoices", b).then(r => r.data),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast({ title: "Sale processed!", description: data.invoiceNumber }); navigate(`/invoices/${data.id}`); },
    onError: () => toast({ title: "Error processing sale", variant: "destructive" }),
  });

  function updateLine(key: string, patch: Partial<LineItem>) { setLines(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l)); }

  function selectItem(key: string, item: InvItem) {
    const parts: string[] = [];
    if (item.deviceId) parts.push(`Device ID: ${item.deviceId}`);
    if (item.imei) parts.push(`${imeiLabel(item.imei)}: ${item.imei}`);
    if (item.ptaStatus === "approved") parts.push("✓ PTA Approved");
    updateLine(key, { inventoryItemId: item.id, description: item.productName, details: parts.join("\n"), deviceId: item.deviceId ?? null, imei: item.imei ?? "", ptaStatus: item.ptaStatus ?? null, price: selectedCurrency.code === "PKR" || exchangeRate <= 0 ? String(item.sellingPrice) : parseFloat((item.sellingPrice * exchangeRate).toFixed(6)).toString(), searchQuery: item.productName, searchOpen: false, isCreatingItem: false });
    setActiveKey(null);
  }

  function confirmNewItem(key: string) {
    const line = lines.find(l => l.key === key);
    if (!line) return;
    updateLine(key, { description: line.newDesc, price: line.newPrice, searchQuery: line.newDesc, searchOpen: false, isCreatingItem: false });
    setActiveKey(null);
  }

  const walletAvailable = customer?.walletBalance ?? 0;
  const subtotal = lines.reduce((s, l) => s + l.qty * parseFloat(l.price || "0"), 0);
  const discountAmt = parseFloat(discount || "0");
  const taxMap = new Map<string, { label: string; rate: number; amount: number }>();
  for (const l of lines) {
    if (l.taxRate > 0 && l.taxLabel) {
      const k = `${l.taxLabel}__${l.taxRate}`;
      const lineAmt = l.qty * parseFloat(l.price || "0");
      const entry = taxMap.get(k);
      if (entry) { entry.amount += lineAmt * l.taxRate / 100; }
      else { taxMap.set(k, { label: l.taxLabel, rate: l.taxRate, amount: lineAmt * l.taxRate / 100 }); }
    }
  }
  const taxBreakdown = [...taxMap.values()];
  const totalTax = taxBreakdown.reduce((s, t) => s + t.amount, 0);
  const total = subtotal - discountAmt + totalTax;
  const walletApplied = useWallet && walletAvailable > 0 ? Math.min(walletAvailable, total) : 0;
  const amountDue = total - walletApplied;

  function validate() {
    if (!customer) { toast({ title: "Please select a customer", variant: "destructive" }); return false; }
    if (!lines.filter(l => l.description && parseFloat(l.price || "0") > 0).length) { toast({ title: "Add at least one item", variant: "destructive" }); return false; }
    return true;
  }

  function doSave(status: "draft" | "paid") {
    if (!customer) return;
    const valid = lines.filter(l => l.description && parseFloat(l.price || "0") > 0);
    const effectiveMethod = status === "paid" ? (amountDue <= 0 ? "wallet" : payMethod) : undefined;
    const payload = {
      customerId: customer.id, date: saleDate, dueDate: saleDate,
      discount: String(discountAmt), notes: notes || undefined, status,
      currency: selectedCurrency.code, currencySymbol: selectedCurrency.symbol,
      walletAmountUsed: walletApplied > 0 ? walletApplied : undefined,
      paymentMethod: effectiveMethod,
      items: valid.map(l => ({ description: l.description, imei: l.imei || undefined, inventoryItemId: l.inventoryItemId || undefined, qty: l.qty, price: parseFloat(l.price), taxRate: l.taxRate })),
    };
    setShowPayDialog(false);
    saveMutation.mutate(payload);
  }

  const isBusy = saveMutation.isPending;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/invoices")}><ChevronLeft className="h-4 w-4" />Invoices</Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Point of Sale</span>
      </div>

      <div className="border rounded-xl bg-white shadow-sm overflow-visible">

        {/* ── Customer + Sale meta ── */}
        <div className="grid grid-cols-5 gap-6 p-6 border-b">
          <div className="col-span-2" ref={custPanelRef}>
            {customer ? (
              <div className="border rounded-lg p-4 min-h-[140px]">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Bill to</p>
                <p className="font-semibold text-sm leading-snug">{customer.name}</p>
                {customer.address && <p className="text-sm text-muted-foreground leading-snug mt-0.5">{customer.address}</p>}
                {customer.city && <p className="text-sm text-muted-foreground">{customer.city}</p>}
                {customer.mobile && <p className="text-sm mt-1.5">{customer.mobile}</p>}
                {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
                {(customer.walletBalance ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                    <Wallet className="h-3 w-3" />
                    Wallet: Rs {(customer.walletBalance ?? 0).toLocaleString()} available
                  </div>
                )}
                <div className="mt-2.5"><button className="text-xs text-blue-600 hover:underline" onClick={() => { setCustOpen(true); setCreatingCust(false); setCustQuery(""); }}>Choose a different customer</button></div>
              </div>
            ) : (
              <div className="relative">
                <button onClick={() => { setCustOpen(true); setCreatingCust(false); }}
                  className="w-full border-2 border-dashed rounded-lg min-h-[140px] flex flex-col items-center justify-center gap-2 text-blue-500 hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                  <div className="w-10 h-10 rounded-full border-2 border-blue-200 flex items-center justify-center bg-white">
                    <User className="h-5 w-5" /><PlusCircle className="h-3 w-3 -mt-3 -mr-3 text-blue-600 bg-white rounded-full" />
                  </div>
                  <span className="text-sm font-medium">Add a customer</span>
                </button>
                {custOpen && (
                  <div className="absolute z-50 mt-1 left-0 right-0 bg-white border rounded-lg shadow-xl overflow-hidden">
                    {!creatingCust ? (
                      <>
                        <div className="p-2 border-b bg-gray-50/70">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <input autoFocus className="w-full pl-8 pr-3 py-1.5 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-blue-500" placeholder="Search by name, mobile or address…" value={custQuery}
                              onChange={e => setCustQuery(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "ArrowDown") { e.preventDefault(); setCustHighlight(i => Math.min(i + 1, custList.length - 1)); }
                                else if (e.key === "ArrowUp") { e.preventDefault(); setCustHighlight(i => Math.max(i - 1, 0)); }
                                else if (e.key === "Enter") { e.preventDefault(); const picked = custList[custHighlight]; if (picked) { setCustomer(picked); setCustOpen(false); setCustQuery(""); } }
                                else if (e.key === "Escape") setCustOpen(false);
                              }} />
                          </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {custList.map((c, idx) => (
                            <button key={c.id} className={`w-full text-left px-4 py-2.5 border-b last:border-0 transition-colors ${idx === custHighlight ? "bg-blue-100" : "hover:bg-blue-50/60"}`}
                              onMouseDown={e => { e.preventDefault(); setCustomer(c); setCustOpen(false); setCustQuery(""); }} onMouseEnter={() => setCustHighlight(idx)}>
                              <p className="text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.mobile}{c.city ? ` · ${c.city}` : ""}</p>
                            </button>
                          ))}
                          {custQuery.length >= 1 && !custList.length && <p className="px-4 py-3 text-sm text-muted-foreground text-center">No customers found</p>}
                          {!custQuery && <p className="px-4 py-4 text-sm text-muted-foreground text-center">Start typing to search…</p>}
                        </div>
                        <div className="border-t bg-gray-50/70">
                          <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm text-blue-600 flex items-center gap-2" onClick={() => { setCreatingCust(true); setNewCust(n => ({ ...n, name: custQuery })); }}>
                            <PlusCircle className="h-4 w-4" />Create {custQuery ? `"${custQuery}"` : "a new customer"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Customer</p>
                        <input className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Full name *" value={newCust.name} onChange={e => setNewCust(n => ({ ...n, name: e.target.value }))} />
                        <input className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Phone *" value={newCust.mobile} onChange={e => setNewCust(n => ({ ...n, mobile: e.target.value }))} />
                        <input className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Email" value={newCust.email} onChange={e => setNewCust(n => ({ ...n, email: e.target.value }))} />
                        <input className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="Address" value={newCust.address} onChange={e => setNewCust(n => ({ ...n, address: e.target.value }))} />
                        <input className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="City" value={newCust.city} onChange={e => setNewCust(n => ({ ...n, city: e.target.value }))} />
                        <div className="flex gap-2 pt-1">
                          <button type="button" disabled={!newCust.name || !newCust.mobile || createCustMutation.isPending} className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
                            onClick={() => createCustMutation.mutate({ name: newCust.name, mobile: newCust.mobile, email: newCust.email || undefined, address: newCust.address || undefined, city: newCust.city || undefined })}>
                            {createCustMutation.isPending ? "Saving…" : "Create Customer"}
                          </button>
                          <button type="button" className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50 transition-colors" onClick={() => setCreatingCust(false)}>Back</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sale meta (right 3 cols) */}
          <div className="col-span-3 space-y-3">
            <div className="grid grid-cols-[120px_1fr] items-start gap-3">
              <label className="text-sm text-right text-muted-foreground pt-1.5">Sale date</label>
              <input type="date" className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Items ── */}
        <div className="px-6 pt-5 pb-2 border-b">
          <div className="mb-4">
            <button className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 rounded-md px-3 py-1 hover:bg-blue-50 transition-colors"><Pencil className="h-3.5 w-3.5" />Edit columns</button>
          </div>
          <div className="grid grid-cols-[16px_150px_1fr_76px_88px_88px_24px] gap-x-3 pb-2 border-b">
            <div /><div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Quantity</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Price</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Amount</div>
            <div />
          </div>
          <div>
            {lines.map(line => (
              <LineRow key={line.key} line={line} results={activeKey === line.key ? (itemResults?.items ?? []) : []} isActive={activeKey === line.key}
                onActivate={() => setActiveKey(line.key)} onUpdate={p => updateLine(line.key, p)} onRemove={() => setLines(ls => ls.filter(l => l.key !== line.key))}
                onSelect={item => selectItem(line.key, item)} onConfirmNew={() => confirmNewItem(line.key)} canDelete={true}
                symbol={selectedCurrency.symbol} rate={exchangeRate} />
            ))}
          </div>
          <button type="button" className="mt-2 mb-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors" onClick={() => setLines(ls => [...ls, newLine()])}>
            <PlusCircle className="h-4 w-4" />Add an item
          </button>
        </div>

        {/* ── Totals ── */}
        <div className="px-6 py-5 border-b">
          <div className="flex items-start">
            <div className="flex-1 flex items-center justify-center pt-6">
              <div className="w-7 h-7 rounded-full border-4 border-green-400 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-green-400" /></div>
            </div>
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{selectedCurrency.symbol}{fmt(subtotal)}</span></div>
              {taxBreakdown.map(t => (
                <div key={`${t.label}__${t.rate}`} className="flex justify-between text-muted-foreground">
                  <span>{t.label} ({t.rate}%)</span>
                  <span>{selectedCurrency.symbol}{fmt(t.amount)}</span>
                </div>
              ))}
              {!discountOpen ? (
                <button className="flex items-center gap-1.5 text-blue-600 text-xs hover:text-blue-700 transition-colors" onClick={() => setDiscountOpen(true)}>
                  <PlusCircle className="h-3.5 w-3.5" />Add a discount
                </button>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">{selectedCurrency.symbol}</span>
                    <input autoFocus className="w-24 text-right px-2 py-0.5 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500" placeholder="0.00" value={discount} onChange={e => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} />
                    <button onClick={() => { setDiscountOpen(false); setDiscount(""); }}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center border-t pt-2 mt-1">
                <div className="flex items-center gap-2">
                  <span>Total</span>
                  <CurrencyDropdown selected={selectedCurrency} rate={exchangeRate} loading={rateLoading} onSelect={setSelectedCurrency} />
                </div>
                <span className="font-semibold">{selectedCurrency.symbol}{fmt(total)}</span>
              </div>
              {walletAvailable > 0 && (
                <div className="border rounded-lg bg-emerald-50 border-emerald-200 px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded" />
                    <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-800">
                      Use wallet balance (Rs {walletAvailable.toLocaleString()} available)
                    </span>
                  </label>
                  {useWallet && walletApplied > 0 && (
                    <div className="flex justify-between mt-1.5 text-xs text-emerald-700 font-medium pl-6">
                      <span>Wallet deduction</span>
                      <span>− Rs {walletApplied.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-base border-t pt-2">
                <span>Amount Due</span>
                <div className="text-right">
                  <div>{selectedCurrency.symbol}{fmt(amountDue)}</div>
                  {selectedCurrency.code !== "PKR" && exchangeRate > 0 && <div className="text-xs font-normal text-muted-foreground mt-0.5">≈ Rs{fmt(amountDue / exchangeRate)} PKR</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Notes</p>
          <textarea className="w-full text-sm text-blue-600/70 placeholder:text-blue-400/50 border-0 outline-none resize-none bg-transparent" rows={3} placeholder="Enter notes visible to your customer" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={() => navigate("/invoices")}>Cancel</Button>
        <Button variant="outline" onClick={() => { if (validate()) doSave("draft"); }} disabled={isBusy}>Save as Draft</Button>
        <Button onClick={() => { if (validate()) setShowPayDialog(true); }} disabled={isBusy} className="gap-2">
          <CreditCard className="h-4 w-4" />{isBusy ? "Processing…" : "Process Sale"}
        </Button>
      </div>

      {/* ── Payment dialog ── */}
      {showPayDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-80 p-6 space-y-4">
            <h2 className="text-lg font-bold">Process Payment</h2>
            <div className="text-2xl font-bold text-center py-2 border rounded-lg">{selectedCurrency.symbol}{fmt(amountDue)}</div>
            {walletApplied > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5">
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                Rs {walletApplied.toLocaleString()} will be deducted from wallet
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</p>
              {amountDue <= 0 ? (
                <button className="w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium border-emerald-500 bg-emerald-50 text-emerald-700 flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Wallet
                </button>
              ) : (
                (["cash", "card", "bank", "other"] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors capitalize ${payMethod === m ? "border-blue-500 bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`}>{m}</button>
                ))
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => doSave("paid")} disabled={isBusy}>{isBusy ? "Saving…" : "Confirm Sale"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
