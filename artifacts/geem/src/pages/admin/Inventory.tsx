import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { isIccid, imeiLabel } from "@/lib/utils";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, ChevronLeft, ChevronRight, Pencil, Trash2, X, FileSpreadsheet, CheckCircle2, Download, Receipt, Layers, RefreshCw, Hash, History, MessageSquarePlus, User, Phone, MapPin, CreditCard, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import * as XLSX from "xlsx";

interface InventoryItem {
  id: number; imei: string; deviceId: string | null; brandId: number; modelId: number;
  brandName: string; modelName: string; status: string; ptaStatus: string; psid: string | null;
  landedCost: number; sellingPrice: number; purchaseDate: string; grnNumber: string | null;
  trackerSimNo: string | null;
  supplierInvoiceNumber: string | null; notes: string | null; createdAt: string;
  salesInvoiceId: number | null; salesInvoiceNumber: string | null;
  salePaymentStatus: string | null; saleDate: string | null;
  saleCustomerName: string | null; saleCustomerMobile: string | null;
  saleCustomerCity: string | null; saleCustomerId: number | null;
  imeiChangeCount?: number;
}
interface Brand { id: number; name: string; deviceIdMandatory: boolean; }
interface DeviceModel { id: number; brandId: number; name: string; }
interface ImeiHistoryEntry {
  id: number; inventoryItemId: number; oldImei: string; newImei: string;
  previousStatus: string | null; restoredStatus: string | null;
  reason: string | null; source: string; changedAt: string;
}

const STATUS_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "sold", label: "Sold" },
  { value: "damaged", label: "Damaged" },
  { value: "missing", label: "Missing Item" },
];
const PTA_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "pending", label: "Pending" },
  { value: "dont_pay", label: "Don't Pay" },
  { value: "not_for_use", label: "Not For Use" },
  { value: "pta_blocked", label: "PTA Blocked" },
];

function statusClass(s: string): string {
  if (s === "in_stock")               return "bg-green-100 text-green-700 border-green-200";
  if (s === "sold")                   return "bg-blue-100 text-blue-700 border-blue-200";
  if (s === "damaged")                return "bg-red-100 text-red-700 border-red-200";
  if (s === "missing" || s === "lost") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}
function ptaClass(s: string): string {
  if (s === "approved" || s === "paid")               return "bg-green-100 text-green-700 border-green-200";
  if (s === "unpaid" || s === "blocked" || s === "pta_blocked")  return "bg-red-100 text-red-700 border-red-200";
  if (s === "pending")                                 return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (s === "dont_pay")                                return "bg-purple-100 text-purple-700 border-purple-200";
  if (s === "not_for_use")                             return "bg-gray-100 text-gray-600 border-gray-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}
function fmtStatus(s: string) {
  if (s === "lost") return "Missing Item";
  return STATUS_OPTIONS.find(o => o.value === s)?.label ?? s;
}
function fmtPta(s: string) {
  if (s === "blocked") return "PTA Blocked";
  return PTA_OPTIONS.find(o => o.value === s)?.label ?? s;
}

const emptyForm = {
  imei: "", deviceId: "", brandId: "", modelId: "", status: "in_stock",
  ptaStatus: "approved", psid: "", trackerSimNo: "", landedCost: "", sellingPrice: "",
  purchaseDate: new Date().toISOString().split("T")[0],
  grnNumber: "", supplierInvoiceNumber: "", notes: "",
};

const emptyBulkForm = {
  brandId: "", modelId: "", status: "in_stock", ptaStatus: "approved",
  landedCost: "", sellingPrice: "",
  purchaseDate: new Date().toISOString().split("T")[0],
  grnNumber: "", supplierInvoiceNumber: "", notes: "",
  imeiList: "", deviceIdList: "", requireDeviceId: false,
};

function parseLines(text: string): string[] {
  return text.split(/\n|,/).map(s => s.trim()).filter(Boolean);
}

function exportInventoryCSV(items: InventoryItem[]) {
  const headers = ["IMEI", "Device ID", "Brand", "Model", "Status", "PTA Status", "PSID", "Tracker SIM No", "Landed Cost", "Sell Price", "Purchase Date", "GRN Number", "Supplier Invoice", "Notes"];
  const rows = items.map(i => [
    i.imei, i.deviceId ?? "", i.brandName, i.modelName,
    i.status, i.ptaStatus, i.psid ?? "", i.trackerSimNo ?? "",
    i.landedCost, i.sellingPrice, i.purchaseDate,
    i.grnNumber ?? "", i.supplierInvoiceNumber ?? "", i.notes ?? "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function Inventory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPta, setFilterPta] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [singleRequireDeviceId, setSingleRequireDeviceId] = useState(false);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [statusColMissing, setStatusColMissing] = useState(false);
  const [importDedupStats, setImportDedupStats] = useState<{ dupDeviceId: number; dupImei: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [imeiAssigning, setImeiAssigning] = useState<Set<number>>(new Set());
  const [manualImeiItem, setManualImeiItem] = useState<InventoryItem | null>(null);
  const [manualImeiValue, setManualImeiValue] = useState("");
  const [manualImeiReason, setManualImeiReason] = useState("");
  const [manualImeeSaving, setManualImeeSaving] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function saveManualImei() {
    if (!manualImeiItem) return;
    const imei = manualImeiValue.trim();
    if (!imei) return;
    setManualImeeSaving(true);
    try {
      const reason = manualImeiReason.trim() || "Manual IMEI update";
      await axiosInstance.patch(`/inventory/${manualImeiItem.id}`, { imei, reason });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "IMEI Updated", description: `IMEI changed to ${imei}` });
      setManualImeiItem(null);
      setManualImeiValue("");
      setManualImeiReason("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to update IMEI";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setManualImeeSaving(false);
    }
  }

  async function assignNewImei(item: InventoryItem) {
    setImeiAssigning(prev => new Set(prev).add(item.id));
    try {
      const freeRes = await axiosInstance.get<{ id: number; imei15: string }>("/imei-pool/next-free");
      const poolEntry = freeRes.data;
      await axiosInstance.post(`/imei-pool/${poolEntry.id}/assign`, { inventoryItemId: item.id });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "IMEI Updated",
        description: `New IMEI assigned: ${poolEntry.imei15}`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({
        title: "IMEI Update Failed",
        description: msg === "No free IMEIs in pool"
          ? "No free IMEIs available in the pool. Please generate IMEIs first from the IMEI Pool page."
          : (msg ?? "Something went wrong"),
        variant: "destructive",
      });
    } finally {
      setImeiAssigning(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", page, debouncedSearch, filterStatus, filterPta, filterBrand, filterModel],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterStatus) params.set("status", filterStatus);
      if (filterPta) params.set("ptaStatus", filterPta);
      if (filterBrand) params.set("brandId", filterBrand);
      if (filterModel) params.set("modelId", filterModel);
      return axiosInstance.get<{ items: InventoryItem[]; total: number; summary: Record<string, number> }>(`/inventory?${params}`).then(r => r.data);
    },
  });

  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => axiosInstance.get<Brand[]>("/brands").then(r => r.data) });
  const { data: models } = useQuery({
    queryKey: ["models", filterBrand],
    queryFn: () => axiosInstance.get<DeviceModel[]>(`/models${filterBrand ? `?brandId=${filterBrand}` : ""}`).then(r => r.data),
  });
  const { data: allModels } = useQuery({
    queryKey: ["models", form.brandId, "single"],
    queryFn: () => form.brandId ? axiosInstance.get<DeviceModel[]>(`/models?brandId=${form.brandId}`).then(r => r.data) : Promise.resolve([]),
    enabled: !!form.brandId,
  });
  const { data: bulkModels } = useQuery({
    queryKey: ["models", bulkForm.brandId, "bulk"],
    queryFn: () => bulkForm.brandId ? axiosInstance.get<DeviceModel[]>(`/models?brandId=${bulkForm.brandId}`).then(r => r.data) : Promise.resolve([]),
    enabled: !!bulkForm.brandId,
  });

  const [complaintItem, setComplaintItem] = useState<InventoryItem | null>(null);
  const [complaintDesc, setComplaintDesc] = useState("");
  const [complaintSaving, setComplaintSaving] = useState(false);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
  }, []);

  const handleSearchCommit = useCallback(() => {
    setDebouncedSearch(search);
    setPage(1);
  }, [search]);

  const saveMutation = useMutation({
    mutationFn: (payload: object) => editItem
      ? axiosInstance.patch(`/inventory/${editItem.id}`, payload).then(r => r.data)
      : axiosInstance.post("/inventory", payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setShowForm(false); setEditItem(null); setForm(emptyForm); setSingleRequireDeviceId(false);
      toast({ title: editItem ? "Item updated" : "Item added" });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: object) => axiosInstance.post<{ added: number; skipped: number; errors: string[] }>("/inventory/bulk-add", payload).then(r => r.data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setBulkResult(result);
      toast({ title: `Bulk add: ${result.added} added${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}` });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/inventory/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast({ title: "Deleted" }); setDeleteConfirm(null); },
  });

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setForm({
      imei: item.imei, deviceId: item.deviceId ?? "", brandId: String(item.brandId),
      modelId: String(item.modelId), status: item.status, ptaStatus: item.ptaStatus,
      psid: item.psid ?? "", trackerSimNo: item.trackerSimNo ?? "",
      landedCost: String(item.landedCost), sellingPrice: String(item.sellingPrice),
      purchaseDate: item.purchaseDate, grnNumber: item.grnNumber ?? "",
      supplierInvoiceNumber: item.supplierInvoiceNumber ?? "", notes: item.notes ?? "",
    });
    setSingleRequireDeviceId(false);
    setAddMode("single");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false); setEditItem(null); setForm(emptyForm);
    setSingleRequireDeviceId(false); setBulkForm(emptyBulkForm); setBulkResult(null); setAddMode("single");
  }

  // Derived: is Device ID required for the SINGLE form?
  const singleBrand = brands?.find(b => String(b.id) === form.brandId);
  const singleBrandRequires = singleBrand?.deviceIdMandatory ?? false;
  const singleDeviceIdRequired = singleBrandRequires || singleRequireDeviceId;

  // Derived: is Device ID required for the BULK form?
  const bulkBrand = brands?.find(b => String(b.id) === bulkForm.brandId);
  const bulkBrandRequires = bulkBrand?.deviceIdMandatory ?? false;
  const bulkDeviceIdRequired = bulkBrandRequires || bulkForm.requireDeviceId;

  // Parsed IMEI / Device ID lines for bulk preview
  const parsedImeis = parseLines(bulkForm.imeiList);
  const parsedDeviceIds = parseLines(bulkForm.deviceIdList);

  function handleSave() {
    if (singleDeviceIdRequired && !form.deviceId.trim()) {
      toast({ title: "Device ID required", description: "Please enter a Device ID for this brand/item.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...form,
      brandId: parseInt(form.brandId),
      modelId: parseInt(form.modelId),
      landedCost: parseFloat(form.landedCost) || 0,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
    });
  }

  function handleBulkSave() {
    if (!bulkForm.brandId || !bulkForm.modelId) {
      toast({ title: "Brand and Model required", variant: "destructive" }); return;
    }
    if (parsedImeis.length === 0) {
      toast({ title: "Enter at least one IMEI", variant: "destructive" }); return;
    }
    if (bulkDeviceIdRequired && parsedDeviceIds.length === 0) {
      toast({ title: "Device ID list required", description: `${bulkBrand?.name ?? "This brand"} requires a Device ID for every item.`, variant: "destructive" });
      return;
    }
    const items = parsedImeis.map((imei, i) => ({
      imei,
      deviceId: parsedDeviceIds[i] || undefined,
    }));
    bulkMutation.mutate({
      brandId: parseInt(bulkForm.brandId),
      modelId: parseInt(bulkForm.modelId),
      status: bulkForm.status,
      ptaStatus: bulkForm.ptaStatus,
      landedCost: parseFloat(bulkForm.landedCost) || 0,
      sellingPrice: parseFloat(bulkForm.sellingPrice) || 0,
      purchaseDate: bulkForm.purchaseDate,
      grnNumber: bulkForm.grnNumber || undefined,
      supplierInvoiceNumber: bulkForm.supplierInvoiceNumber || undefined,
      notes: bulkForm.notes || undefined,
      items,
    });
  }

  function downloadExampleFile() {
    const headers = [
      "Sale Date", "Stock", "Brand", "Model", "Device ID", "IMEI",
      "PSID", "PTA Status", "Old IMEI", "Customer Name", "Mobile No",
      "Tracker Sim No", "City", "Shipment CN No", "Sale Price",
      "Payment Received", "Stock Date", "Address",
    ];
    const examples = [
      ["2024-06-10", "Sold",     "Samsung", "Samsung Galaxy A54",  "DEV-001", "351234567890123", "PS123456", "Paid",    "",               "Ali Ahmed",  "03001234567", "03111234567", "Lahore",    "TCS-123456", 75000,  75000,  "2024-05-01", "House 12, Gulberg"],
      ["",           "In Stock", "Apple",   "iPhone 15 Pro Max",   "DEV-002", "351234567890124", "PS654321", "Approved","",               "",           "",            "",            "",          "",           320000, 0,      "2024-05-15", ""],
      ["2024-06-12", "Sold",     "Xiaomi",  "Xiaomi 14 Ultra",     "",        "351234567890125", "",         "Unpaid",  "351234567890000","Zara Malik",  "03451234567", "",            "Karachi",   "LCS-789012", 62000,  60000,  "2024-05-20", "Flat 5, Clifton"],
      ["",           "In Stock", "Samsung", "Samsung Galaxy S24",  "",        "351234567890126", "",         "Pending", "",               "",           "",            "03021234567", "",          "",           105000, 0,      "2024-05-22", ""],
      ["2024-06-14", "Dispatched","Apple",  "iPhone 14",           "DEV-005", "351234567890127", "",         "Approved","",               "Hamid Shah", "03331234567", "",            "Islamabad", "MNP-456789", 130000, 130000, "2024-05-25", "G-10, Islamabad"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
      { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
      { wch: 16 }, { wch: 12 }, { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "geem-inventory-template.xlsx");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
        if (jsonData.length < 2) { toast({ title: "Empty file", description: "No data rows found", variant: "destructive" }); return; }
        const rawHeaders = (jsonData[0] as unknown[]).map(h => String(h ?? "").trim()).filter(h => h !== "");
        setDetectedHeaders(rawHeaders);
        const headerMap: Record<string, number> = {};
        rawHeaders.forEach((h, i) => { headerMap[h.toLowerCase().replace(/\s+/g, " ")] = i; });

        function col(r: unknown[], ...names: string[]): unknown {
          for (const n of names) {
            const idx = headerMap[n.toLowerCase().replace(/\s+/g, " ")];
            if (idx !== undefined) return (r as unknown[])[idx];
          }
          return undefined;
        }

        const rows = jsonData.slice(1).map(row => ({
          IMEI:             col(row as unknown[], "imei", "imei number", "imei no", "imei #", "new un assinged imei number", "new unassigned imei number"),
          "Old IMEI":       col(row as unknown[], "old imei", "oldimei", "old_imei", "previous imei", "original imei"),
          "Device ID":      col(row as unknown[], "device id", "deviceid", "device_id"),
          Brand:            col(row as unknown[], "brand", "brand name", "make", "manufacturer"),
          Model:            col(row as unknown[], "model", "model name", "device model", "device"),
          Status:           col(row as unknown[], "stock", "status", "device status", "item status", "sale status", "sold status", "phone status", "condition", "availability", "current status", "stock status"),
          "PTA Status":     col(row as unknown[], "pta status", "pta", "pta_status", "pta approval", "pta approved", "pta approval status"),
          PSID:             col(row as unknown[], "psid", "ps id", "ps_id"),
          "Landed Cost":    col(row as unknown[], "landed cost", "cost", "cost price", "purchase price", "landed_cost"),
          "Sell Price":     col(row as unknown[], "sale price", "sell price", "selling price", "price", "sell_price"),
          "Purchase Date":  col(row as unknown[], "stock date", "purchase date", "purchase_date", "purcahse date", "stockdate"),
          "Sale Date":      col(row as unknown[], "sale date", "sold date", "saledate", "date of sale"),
          GRN:              col(row as unknown[], "shipment no.", "shipment no", "shipment number", "grn number", "grn no", "grn", "batch no", "batch number"),
          "Customer Name":  col(row as unknown[], "customer name", "customer", "buyer", "buyer name", "client", "client name"),
          "Mobile":         col(row as unknown[], "mobile no", "mobile no.", "mobile", "phone no.", "phone no", "phone", "contact no", "contact"),
          "Tracker Sim No": col(row as unknown[], "tracker sim no", "tracker sim", "tracker sim no.", "sim no", "sim number", "tracking sim"),
          "City":           col(row as unknown[], "city", "customer city"),
          "Address":        col(row as unknown[], "address", "customer address"),
          "Received":       col(row as unknown[], "payment received", "received", "amount received", "paid amount", "amount paid", "receipt"),
          "Balance":        col(row as unknown[], "balance", "remaining", "due", "outstanding"),
          "Payment Method": col(row as unknown[], "payment method", "payment_method", "pay method", "paymethod", "method"),
          "Courier":        col(row as unknown[], "courier", "courier name", "courier_name", "shipping company", "logistics"),
          "Tracking No":    col(row as unknown[], "shipment cn no", "shipment cn", "cn no", "tracking no", "tracking number", "tracking_number", "cn", "cn number", "consignment", "consignment no", "consignment number", "tracking"),
        })).filter(r => r.IMEI && String(r.IMEI).trim() !== "" && String(r.IMEI).trim() !== "0");

        // Deduplicate: Device ID first, then IMEI (keep first occurrence, remove duplicates)
        const seenDeviceIds = new Set<string>();
        let dupDeviceId = 0;
        const afterDeviceDedup = (rows as Record<string, unknown>[]).filter(r => {
          const did = String(r["Device ID"] ?? "").trim();
          if (!did) return true; // no Device ID → keep
          if (seenDeviceIds.has(did)) { dupDeviceId++; return false; }
          seenDeviceIds.add(did);
          return true;
        });
        const seenImeis = new Set<string>();
        let dupImei = 0;
        const deduped = afterDeviceDedup.filter(r => {
          const imei = String(r["IMEI"] ?? "").trim();
          if (!imei) return true;
          if (seenImeis.has(imei)) { dupImei++; return false; }
          seenImeis.add(imei);
          return true;
        });

        setImportRows(deduped);
        setImportDedupStats(dupDeviceId + dupImei > 0 ? { dupDeviceId, dupImei } : null);
        setImportResult(null);
        const statusDetected = deduped.slice(0, 20).some(r => r["Status"] !== undefined && String(r["Status"]).trim() !== "");
        setStatusColMissing(!statusDetected);
        if (deduped.length === 0) {
          toast({ title: "No valid rows found", description: "Check that your Excel has IMEI, Brand, and Model columns", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Failed to read file", description: String(err instanceof Error ? err.message : err), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const rows = importRows.map(r => ({
        imei:            r["IMEI"],
        oldImei:         r["Old IMEI"],
        deviceId:        r["Device ID"],
        brand:           r["Brand"],
        model:           r["Model"],
        status:          r["Status"],
        ptaStatus:       r["PTA Status"],
        psid:            r["PSID"],
        landedCost:      r["Landed Cost"] ?? r["Sell Price"],
        sellPrice:       r["Sell Price"],
        purchaseDate:    r["Purchase Date"] ?? r["Sale Date"],
        saleDate:        r["Sale Date"],
        grnNumber:       r["GRN"],
        customerName:    r["Customer Name"],
        customerMobile:  r["Mobile"],
        trackerSimNo:    r["Tracker Sim No"] ? String(r["Tracker Sim No"]).trim() : undefined,
        customerCity:    r["City"],
        customerAddress: r["Address"],
        received:        r["Received"],
        paymentMethod:   r["Payment Method"],
        courierName:     r["Courier"],
        trackingNumber:  r["Tracking No"],
      }));
      const res = await axiosInstance.post<{ imported: number; skipped: number; errors: string[]; unknownStatuses?: string[] }>("/inventory/import", { rows });
      setImportResult(res.data);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["shop-products"] });
      const unknowns = res.data.unknownStatuses ?? [];
      if (unknowns.length > 0) {
        toast({ title: `Import complete: ${res.data.imported} added, ${res.data.skipped} skipped`, description: `Unknown status values (saved as In Stock): ${unknowns.slice(0, 8).join(", ")}`, variant: "destructive" });
      } else {
        toast({ title: `Import complete: ${res.data.imported} added, ${res.data.skipped} skipped` });
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({ title: "Import failed", description: detail ?? "Server error — check your file format", variant: "destructive" });
    }
    setImporting(false);
  }

  const hasFilters = !!(filterStatus || filterPta || filterBrand || filterModel || debouncedSearch);
  const totalPages = Math.ceil((data?.total ?? 0) / 50);
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">{data?.total?.toLocaleString() ?? 0} total items</p>
        </div>
        <div className="flex gap-2">
          {data?.items && data.items.length > 0 && (
            <Button variant="outline" onClick={() => exportInventoryCSV(data.items)}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
          )}
          <Button variant="outline" onClick={() => { setShowImport(true); setImportResult(null); setImportRows([]); }}>
            <Upload className="h-4 w-4 mr-2" />Import Excel
          </Button>
          <Button onClick={() => { setEditItem(null); setForm(emptyForm); setBulkForm(emptyBulkForm); setBulkResult(null); setSingleRequireDeviceId(false); setAddMode("single"); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />Add Item
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilterStatus("in_stock"); setFilterPta(""); setPage(1); }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">{summary.inStock?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-muted-foreground">In Stock</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilterStatus("sold"); setFilterPta(""); setPage(1); }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-blue-600">{summary.sold?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-muted-foreground">Sold</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilterStatus("damaged"); setFilterPta(""); setPage(1); }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-red-600">{summary.damaged?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-muted-foreground">Damaged</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilterStatus("missing"); setFilterPta(""); setPage(1); }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-yellow-600">{summary.missing?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-muted-foreground">Missing / Lost</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilterStatus("not_for_use"); setFilterPta(""); setPage(1); }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-gray-500">{summary.notForUse?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-muted-foreground">Blocked / N/A</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilterPta("unpaid"); setFilterStatus(""); setPage(1); }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-orange-600">{summary.ptaUnpaid?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-muted-foreground">PTA Unpaid</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilterPta("unpaid"); setFilterStatus("sold"); setPage(1); }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-yellow-600">{summary.ptaPending?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-muted-foreground">PTA Pending</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="bg-card p-4 rounded-lg border space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search IMEI, Brand, Model, Name, Mobile… (Enter)"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearchCommit(); }}
            className="max-w-xs"
          />
          <SearchableSelect
            value={filterBrand}
            onValueChange={v => { setFilterBrand(v); setFilterModel(""); setPage(1); }}
            options={[{ value: "", label: "All Brands" }, ...(brands?.map(b => ({ value: String(b.id), label: b.name })) ?? [])]}
            placeholder="Brand"
            searchPlaceholder="Search brand…"
            className="w-36"
          />
          <SearchableSelect
            value={filterModel}
            onValueChange={v => { setFilterModel(v); setPage(1); }}
            options={[{ value: "", label: "All Models" }, ...(models?.map(m => ({ value: String(m.id), label: m.name })) ?? [])]}
            placeholder="Model"
            searchPlaceholder="Search model…"
            className="w-36"
          />
          <Select value={filterStatus || "_all"} onValueChange={v => { setFilterStatus(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Status</SelectItem>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPta || "_all"} onValueChange={v => { setFilterPta(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="PTA" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All PTA</SelectItem>
              {PTA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDebouncedSearch(""); setFilterStatus(""); setFilterPta(""); setFilterBrand(""); setFilterModel(""); setPage(1); }}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IMEI / ICCID</TableHead>
              <TableHead>Device ID</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>PTA</TableHead>
              <TableHead>PSID</TableHead>
              <TableHead className="text-right">Landed Cost</TableHead>
              <TableHead className="text-right">Sell Price</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                {hasFilters ? "No items match your filters" : "No inventory items yet. Add one or import from Excel."}
              </TableCell></TableRow>
            ) : (
              data.items.map((item) => (
                <>
                <TableRow key={item.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">
                    {isIccid(item.imei) && <span className="text-[10px] font-sans font-medium text-blue-600 mr-1">ICCID</span>}
                    {item.imei}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.deviceId ?? "—"}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{item.brandName}</div>
                    <div className="text-xs text-muted-foreground">{item.modelName}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs border ${statusClass(item.status)}`}>{fmtStatus(item.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs border ${ptaClass(item.ptaStatus)}`}>{fmtPta(item.ptaStatus)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.psid ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm">{item.landedCost > 0 ? `Rs ${item.landedCost.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{item.sellingPrice > 0 ? `Rs ${item.sellingPrice.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.purchaseDate}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 items-center flex-wrap">
                      {item.salesInvoiceId && (
                        <Link href={`/invoices/${item.salesInvoiceId}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title={`Invoice ${item.salesInvoiceNumber}`}>
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                      {item.status === "sold" && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                          title="Create Service Ticket / Complaint"
                          onClick={() => { setComplaintItem(item); setComplaintDesc(""); }}
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(item.status === "pta_blocked" || item.ptaStatus === "blocked") && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Auto-assign next free IMEI from pool"
                            disabled={imeiAssigning.has(item.id)}
                            onClick={() => assignNewImei(item)}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${imeiAssigning.has(item.id) ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Manually enter a new IMEI"
                            onClick={() => { setManualImeiItem(item); setManualImeiValue(item.imei); }}
                          >
                            <Hash className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {(item.imeiChangeCount ?? 0) > 0 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="IMEI change history" onClick={() => setHistoryItem(item)}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
                {item.status === "sold" && (item.saleCustomerName || item.saleDate) && (
                  <TableRow key={`${item.id}-sale`} className="bg-blue-50/50 border-t-0">
                    <TableCell colSpan={10} className="py-1.5 px-4">
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-blue-800">
                        {item.saleCustomerName && (
                          <span className="flex items-center gap-1"><User className="h-3 w-3 opacity-60" />{item.saleCustomerName}</span>
                        )}
                        {item.saleCustomerMobile && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3 opacity-60" />{item.saleCustomerMobile}</span>
                        )}
                        {item.saleCustomerCity && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3 opacity-60" />{item.saleCustomerCity}</span>
                        )}
                        {item.salePaymentStatus && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3 opacity-60" />
                            <span className={item.salePaymentStatus === "paid" ? "text-green-700 font-medium" : item.salePaymentStatus === "partial" ? "text-amber-700 font-medium" : "text-red-700 font-medium"}>
                              {item.salePaymentStatus.charAt(0).toUpperCase() + item.salePaymentStatus.slice(1)}
                            </span>
                          </span>
                        )}
                        {item.saleDate && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3 opacity-60" />Sold {item.saleDate}</span>
                        )}
                        {item.salesInvoiceId ? (
                          <Link href={`/invoices/${item.salesInvoiceId}`} className="flex items-center gap-1 text-blue-600 underline hover:text-blue-800 cursor-pointer">
                            <Receipt className="h-3 w-3 opacity-60" />{item.salesInvoiceNumber ?? "No Invoice"}
                          </Link>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Receipt className="h-3 w-3 opacity-60" />No Invoice
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({data?.total?.toLocaleString()} items)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => !v && closeForm()}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editItem ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
          </DialogHeader>

          {/* Edit mode: always single form */}
          {editItem ? (
            <>
              <div className="overflow-y-auto flex-1 min-h-0 pr-1">
                <SingleItemForm
                  form={form} setForm={setForm}
                  brands={brands} allModels={allModels}
                  deviceIdRequired={singleDeviceIdRequired}
                  brandRequires={singleBrandRequires}
                  requireDeviceId={singleRequireDeviceId}
                  onRequireChange={setSingleRequireDeviceId}
                  isEdit
                />
              </div>
              <DialogFooter className="shrink-0 pt-2">
                <Button variant="outline" onClick={closeForm}>Cancel</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </>
          ) : (
            /* Add mode: tabs for Single / Bulk */
            <Tabs value={addMode} onValueChange={v => { setAddMode(v as "single" | "bulk"); setBulkResult(null); }} className="flex flex-col flex-1 min-h-0">
              <TabsList className="w-full mb-2 shrink-0">
                <TabsTrigger value="single" className="flex-1">Single Item</TabsTrigger>
                <TabsTrigger value="bulk" className="flex-1">
                  <Layers className="h-4 w-4 mr-2" />Bulk Add
                </TabsTrigger>
              </TabsList>

              {/* ── SINGLE TAB ── */}
              <TabsContent value="single" className="flex flex-col flex-1 min-h-0 mt-0 overflow-hidden">
                <div className="overflow-y-auto flex-1 min-h-0 pr-1">
                  <SingleItemForm
                    form={form} setForm={setForm}
                    brands={brands} allModels={allModels}
                    deviceIdRequired={singleDeviceIdRequired}
                    brandRequires={singleBrandRequires}
                    requireDeviceId={singleRequireDeviceId}
                    onRequireChange={setSingleRequireDeviceId}
                    isEdit={false}
                  />
                </div>
                <DialogFooter className="mt-4 shrink-0">
                  <Button variant="outline" onClick={closeForm}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Add Item"}</Button>
                </DialogFooter>
              </TabsContent>

              {/* ── BULK TAB ── */}
              <TabsContent value="bulk" className="flex flex-col flex-1 min-h-0 mt-0 overflow-hidden">
                {bulkResult ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-green-700 font-semibold">
                        <CheckCircle2 className="h-5 w-5" />Bulk Add Complete
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Added: <span className="font-bold text-green-700">{bulkResult.added}</span></div>
                        <div>Skipped: <span className="font-bold text-muted-foreground">{bulkResult.skipped}</span></div>
                      </div>
                      {bulkResult.errors.length > 0 && (
                        <div className="text-xs text-destructive max-h-28 overflow-y-auto space-y-0.5 bg-red-50 p-2 rounded">
                          {bulkResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={closeForm}>Close</Button>
                      <Button onClick={() => { setBulkResult(null); setBulkForm(emptyBulkForm); }}>Add More</Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <>
                    <div className="overflow-y-auto flex-1 min-h-0 pr-1 space-y-4">
                    {/* Shared fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Brand *</Label>
                        <SearchableSelect
                          value={bulkForm.brandId}
                          onValueChange={v => {
                            const selected = brands?.find(b => String(b.id) === v);
                            setBulkForm(f => ({ ...f, brandId: v, modelId: "", requireDeviceId: selected?.deviceIdMandatory ?? false }));
                          }}
                          options={brands?.map(b => ({ value: String(b.id), label: b.name })) ?? []}
                          placeholder="Select brand"
                          searchPlaceholder="Search brand…"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Model *</Label>
                        <SearchableSelect
                          value={bulkForm.modelId}
                          onValueChange={v => setBulkForm(f => ({ ...f, modelId: v }))}
                          options={bulkModels?.map(m => ({ value: String(m.id), label: m.name })) ?? []}
                          placeholder="Select model"
                          searchPlaceholder="Search model…"
                          disabled={!bulkForm.brandId}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select value={bulkForm.status} onValueChange={v => setBulkForm(f => ({ ...f, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>PTA Status</Label>
                        <Select value={bulkForm.ptaStatus} onValueChange={v => setBulkForm(f => ({ ...f, ptaStatus: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PTA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Landed Cost (Rs)</Label>
                        <Input type="number" value={bulkForm.landedCost} onChange={e => setBulkForm(f => ({ ...f, landedCost: e.target.value }))} placeholder="0" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Selling Price (Rs)</Label>
                        <Input type="number" value={bulkForm.sellingPrice} onChange={e => setBulkForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="0" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Purchase Date *</Label>
                        <Input type="date" value={bulkForm.purchaseDate} onChange={e => setBulkForm(f => ({ ...f, purchaseDate: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>GRN Number</Label>
                        <Input value={bulkForm.grnNumber} onChange={e => setBulkForm(f => ({ ...f, grnNumber: e.target.value }))} placeholder="e.g. GRN-0042" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Supplier Invoice #</Label>
                        <Input value={bulkForm.supplierInvoiceNumber} onChange={e => setBulkForm(f => ({ ...f, supplierInvoiceNumber: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Input value={bulkForm.notes} onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                      </div>
                    </div>

                    {/* Device ID requirement control */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="bulk-require-did"
                        checked={bulkForm.requireDeviceId || bulkBrandRequires}
                        disabled={bulkBrandRequires}
                        onCheckedChange={v => setBulkForm(f => ({ ...f, requireDeviceId: !!v }))}
                      />
                      <label htmlFor="bulk-require-did" className={`text-sm select-none ${bulkBrandRequires ? "font-medium text-amber-700" : "cursor-pointer"}`}>
                        {bulkBrandRequires ? `⚠ Device ID mandatory for every ${bulkBrand?.name} item` : "Device ID mandatory for this batch"}
                      </label>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Paste or scan IMEI &amp; Device ID lists (one per line, matched by position)</p>

                      <div className="space-y-1.5">
                        <Label>IMEI Numbers * <span className="text-xs text-muted-foreground font-normal">(one per line or comma-separated)</span></Label>
                        <Textarea
                          value={bulkForm.imeiList}
                          onChange={e => setBulkForm(f => ({ ...f, imeiList: e.target.value }))}
                          rows={6}
                          className="font-mono text-xs"
                          placeholder={"353506123456789\n353506987654321\n353506111222333"}
                        />
                        {parsedImeis.length > 0 && (
                          <p className="text-xs text-green-700 font-medium">{parsedImeis.length} IMEI{parsedImeis.length > 1 ? "s" : ""} detected</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>
                          Device IDs {bulkDeviceIdRequired ? <span className="text-destructive">*</span> : <span className="text-xs text-muted-foreground font-normal">(optional — one per line, must match IMEI order)</span>}
                        </Label>
                        <Textarea
                          value={bulkForm.deviceIdList}
                          onChange={e => setBulkForm(f => ({ ...f, deviceIdList: e.target.value }))}
                          rows={6}
                          className="font-mono text-xs"
                          placeholder={"ABCD1234\nEFGH5678\nIJKL9012"}
                        />
                        {parsedDeviceIds.length > 0 && (
                          <p className="text-xs text-blue-700 font-medium">{parsedDeviceIds.length} Device ID{parsedDeviceIds.length > 1 ? "s" : ""} detected</p>
                        )}
                        {parsedImeis.length > 0 && parsedDeviceIds.length > 0 && parsedDeviceIds.length !== parsedImeis.length && (
                          <p className="text-xs text-orange-600 font-medium">
                            ⚠ Count mismatch: {parsedImeis.length} IMEIs vs {parsedDeviceIds.length} Device IDs — extras will be blank
                          </p>
                        )}
                      </div>

                      {parsedImeis.length > 0 && (
                        <div className="bg-muted rounded-lg p-3 text-xs space-y-1 max-h-36 overflow-y-auto">
                          <p className="font-medium text-muted-foreground mb-1">{parsedImeis.length} items will be added:</p>
                          {parsedImeis.slice(0, 20).map((imei, i) => (
                            <div key={i} className="flex gap-3 font-mono">
                              <span className="text-foreground">{imei}</span>
                              {parsedDeviceIds[i] && <span className="text-blue-600">→ {parsedDeviceIds[i]}</span>}
                            </div>
                          ))}
                          {parsedImeis.length > 20 && <p className="text-muted-foreground italic">…and {parsedImeis.length - 20} more</p>}
                        </div>
                      )}
                    </div>

                    </div>{/* end scroll wrapper */}
                    <DialogFooter className="shrink-0 pt-2">
                      <Button variant="outline" onClick={closeForm}>Cancel</Button>
                      <Button onClick={handleBulkSave} disabled={bulkMutation.isPending || parsedImeis.length === 0}>
                        <Layers className="h-4 w-4 mr-2" />
                        {bulkMutation.isPending ? `Adding ${parsedImeis.length} items...` : `Add ${parsedImeis.length || ""} Items`}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Excel Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Import from Excel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload your Geem inventory Excel directly — your exact column format is supported.
              </p>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-2">
                <p className="font-semibold">All your Excel columns are recognised automatically:</p>
                <div className="space-y-1">
                  <p className="text-blue-500 font-medium uppercase tracking-wide text-[10px]">Device</p>
                  <div className="flex flex-wrap gap-1">
                    {["IMEI","Device ID","Brand","Model","Stock","PTA Status","PSID","Price","Stock Date","Shipment No."].map(h => (
                      <span key={h} className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">{h}</span>
                    ))}
                  </div>
                  <p className="text-blue-500 font-medium uppercase tracking-wide text-[10px] mt-1">Customer &amp; Sale</p>
                  <div className="flex flex-wrap gap-1">
                    {["Customer Name","Mobile No.","City","Address","Sale Date","Received","Balance"].map(h => (
                      <span key={h} className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono">{h}</span>
                    ))}
                  </div>
                </div>
                <p className="text-blue-600">
                  <strong>Stock</strong> = In Stock &nbsp;·&nbsp; <strong>Sold</strong> = creates customer + sale invoice &nbsp;·&nbsp; <strong>Shipment No.</strong> = GRN
                </p>
              </div>
            </div>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{importRows.length > 0 ? `${importRows.length} rows loaded` : "Click to select Excel file"}</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls files</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

            {importRows.length > 0 && !importResult && (() => {
              const SOLD_KW = new Set(["sold","sale","saled","sell","dispatch","dispatched","delivered","invoice","invoiced","billed","customer","sold out","out","gone","done","complete","completed","closed","paid sold","s","sale done","give","given","handover","hand over","handoverd"]);
              const STOCK_KW = new Set(["in stock","instock","in hand","available","stock","free","imei","new","fresh","active","ready","hold","on hold","pending sale",""]);
              const valid = importRows.filter(r => r["IMEI"] && String(r["IMEI"]).trim() && String(r["IMEI"]).trim() !== "0");
              const skippable = importRows.length - valid.length;
              const soldRows = valid.filter(r => SOLD_KW.has(String(r["Status"] ?? "").toLowerCase().trim()));
              const inStockRows = valid.filter(r => STOCK_KW.has(String(r["Status"] ?? "").toLowerCase().trim()));
              const otherCount = valid.length - soldRows.length - inStockRows.length;
              const withMobile = soldRows.filter(r => String(r["Mobile"] ?? "").trim());
              const walkIn = soldRows.length - withMobile.length;
              const withOldImei = valid.filter(r => String(r["Old IMEI"] ?? "").trim() && String(r["Old IMEI"] ?? "").trim() !== "0");
              const withTracker = valid.filter(r => String(r["Tracker Sim No"] ?? "").trim());
              const colDefs = [
                { label: "IMEI", key: "IMEI", req: true },
                { label: "Brand", key: "Brand", req: true },
                { label: "Model", key: "Model", req: true },
                { label: "Stock", key: "Status", req: false },
                { label: "PTA Status", key: "PTA Status", req: false },
                { label: "PSID", key: "PSID", req: false },
                { label: "Sale Date", key: "Sale Date", req: false },
                { label: "Stock Date", key: "Purchase Date", req: false },
                { label: "Sale Price", key: "Sell Price", req: false },
                { label: "Old IMEI", key: "Old IMEI", req: false },
                { label: "Customer Name", key: "Customer Name", req: false },
                { label: "Mobile No", key: "Mobile", req: false },
                { label: "City", key: "City", req: false },
                { label: "Received", key: "Received", req: false },
                { label: "Tracker SIM", key: "Tracker Sim No", req: false },
                { label: "Shipment CN", key: "Tracking No", req: false },
              ];
              const found = (key: string) => importRows.some(r => String(r[key] ?? "").trim() !== "");
              return (
                <div className="space-y-3 text-sm">
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detected Columns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {colDefs.map(c => {
                        const ok = found(c.key);
                        return (
                          <span key={c.key} className={`text-xs px-2 py-0.5 rounded-full font-mono ${ok ? "bg-green-100 text-green-800" : c.req ? "bg-red-100 text-red-700 font-bold" : "bg-muted text-muted-foreground"}`}>
                            {ok ? "✓" : "✗"} {c.label}
                          </span>
                        );
                      })}
                    </div>
                    {statusColMissing && <p className="text-xs text-orange-600 font-medium">⚠ Status column not detected — all items will be saved as <strong>In Stock</strong></p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rows</p>
                      <div className="flex justify-between"><span className="text-muted-foreground">After dedup</span><span className="font-bold">{importRows.length}</span></div>
                      <div className="flex justify-between text-green-700"><span>✓ Will import</span><span className="font-bold">{valid.length}</span></div>
                      {skippable > 0 && <div className="flex justify-between text-destructive"><span>✗ Skip (no IMEI)</span><span className="font-bold">{skippable}</span></div>}
                      {importDedupStats && importDedupStats.dupDeviceId > 0 && <div className="flex justify-between text-amber-700"><span>🗑 Dup Device IDs</span><span className="font-bold">−{importDedupStats.dupDeviceId}</span></div>}
                      {importDedupStats && importDedupStats.dupImei > 0 && <div className="flex justify-between text-amber-700"><span>🗑 Dup IMEIs</span><span className="font-bold">−{importDedupStats.dupImei}</span></div>}
                    </div>
                    <div className="border rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Status</p>
                      <div className="flex justify-between"><span>📦 In Stock</span><span className="font-bold text-blue-700">{inStockRows.length}</span></div>
                      <div className="flex justify-between"><span>🏷 Sold</span><span className="font-bold text-green-700">{soldRows.length}</span></div>
                      {otherCount > 0 && <div className="flex justify-between"><span>⚠ Other</span><span className="font-bold text-amber-700">{otherCount}</span></div>}
                    </div>
                  </div>
                  {(soldRows.length > 0 || withOldImei.length > 0 || withTracker.length > 0) && (
                    <div className="border rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extra Details</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {soldRows.length > 0 && <><div className="flex justify-between"><span>👤 With mobile</span><span className="font-bold text-green-700">{withMobile.length}</span></div>
                        <div className="flex justify-between"><span>🚶 Walk-in (no mobile)</span><span className="font-bold text-amber-700">{walkIn}</span></div></>}
                        {withOldImei.length > 0 && <div className="flex justify-between col-span-2"><span>🔄 Old IMEI → history</span><span className="font-bold text-blue-700">{withOldImei.length}</span></div>}
                        {withTracker.length > 0 && <div className="flex justify-between col-span-2"><span>📡 Tracker SIM</span><span className="font-bold text-purple-700">{withTracker.length}</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {importResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <CheckCircle2 className="h-4 w-4" />Import Complete
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>✅ Imported: <span className="font-bold text-green-700">{importResult.imported}</span></div>
                  <div>⏭️ Skipped: <span className="font-bold text-muted-foreground">{importResult.skipped}</span></div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="text-xs text-destructive space-y-1 max-h-24 overflow-y-auto">
                    {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Close</Button>
            {importRows.length > 0 && !importResult && (
              <Button onClick={handleImport} disabled={importing}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {importing ? `Importing ${importRows.length} rows...` : `Import ${importRows.length} Rows`}
              </Button>
            )}
            {!importRows.length && !importResult && (
              <Button variant="ghost" size="sm" onClick={downloadExampleFile}><Download className="h-4 w-4 mr-2" />Example File</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this inventory item.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual IMEI Update Dialog ── */}
      <Dialog open={manualImeiItem !== null} onOpenChange={v => { if (!v) { setManualImeiItem(null); setManualImeiValue(""); setManualImeiReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-blue-600" />
              Update IMEI Manually
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Current IMEI:</span>{" "}
              <span className="font-mono">{manualImeiItem?.imei}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-imei-input">New IMEI</Label>
              <Input
                id="manual-imei-input"
                className="font-mono"
                placeholder="Enter 15-digit IMEI"
                maxLength={20}
                value={manualImeiValue}
                onChange={e => setManualImeiValue(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => { if (e.key === "Enter") saveManualImei(); }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{manualImeiValue.length} digits entered (IMEI is 15 digits)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-imei-reason">Reason <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="manual-imei-reason"
                placeholder="e.g. PTA replacement, warranty exchange…"
                value={manualImeiReason}
                onChange={e => setManualImeiReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setManualImeiItem(null); setManualImeiValue(""); setManualImeiReason(""); }}>Cancel</Button>
            <Button
              onClick={saveManualImei}
              disabled={manualImeeSaving || manualImeiValue.trim().length === 0}
            >
              {manualImeeSaving ? "Saving…" : "Save IMEI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IMEI History Dialog ── */}
      <ImeiHistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} />

      {/* ── Complaint / Service Ticket Dialog ── */}
      <Dialog open={complaintItem !== null} onOpenChange={v => { if (!v) { setComplaintItem(null); setComplaintDesc(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4 text-orange-500" />
              Create Service Ticket
            </DialogTitle>
          </DialogHeader>
          {complaintItem && (
            <div className="space-y-4 py-1">
              <div className="rounded-md bg-muted px-3 py-2 text-xs space-y-1">
                <div className="font-medium">{complaintItem.brandName} {complaintItem.modelName}</div>
                <div className="font-mono text-muted-foreground">{complaintItem.imei}</div>
                {complaintItem.saleCustomerName && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" />{complaintItem.saleCustomerName}
                    {complaintItem.saleCustomerMobile && <> · {complaintItem.saleCustomerMobile}</>}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Issue / Complaint Description</Label>
                <Textarea
                  placeholder="Describe the customer's complaint or issue…"
                  value={complaintDesc}
                  onChange={e => setComplaintDesc(e.target.value)}
                  rows={4}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setComplaintItem(null); setComplaintDesc(""); }}>Cancel</Button>
            <Button
              disabled={complaintSaving || !complaintDesc.trim()}
              onClick={async () => {
                if (!complaintItem) return;
                setComplaintSaving(true);
                try {
                  await axiosInstance.post("/service-tickets", {
                    customerId: complaintItem.saleCustomerId,
                    inventoryItemId: complaintItem.id,
                    invoiceId: complaintItem.salesInvoiceId,
                    issueDescription: complaintDesc.trim(),
                  });
                  toast({ title: "Service ticket created", description: `Ticket opened for ${complaintItem.brandName} ${complaintItem.modelName}` });
                  setComplaintItem(null);
                  setComplaintDesc("");
                } catch {
                  toast({ title: "Failed to create ticket", variant: "destructive" });
                } finally {
                  setComplaintSaving(false);
                }
              }}
            >
              {complaintSaving ? "Creating…" : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImeiHistoryDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const { data, isLoading } = useQuery<ImeiHistoryEntry[]>({
    queryKey: ["imei-history", item?.id],
    queryFn: async () => {
      const res = await axiosInstance.get<ImeiHistoryEntry[]>(`/inventory/${item!.id}/imei-history`);
      return res.data;
    },
    enabled: item !== null,
  });

  const STATUS_LABEL: Record<string, string> = {
    in_stock: "In Stock", sold: "Sold", damaged: "Damaged",
    missing: "Missing Item", lost: "Missing Item",
  };

  return (
    <Dialog open={item !== null} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            IMEI History — {item?.imei}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto">
          {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (!data || data.length === 0) && (
            <p className="py-6 text-center text-sm text-muted-foreground">No IMEI changes recorded yet.</p>
          )}
          {data && data.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Date & Time</th>
                  <th className="py-2 pr-3 text-left font-medium">Old IMEI</th>
                  <th className="py-2 pr-3 text-left font-medium">New IMEI</th>
                  <th className="py-2 pr-3 text-left font-medium">Status Restored</th>
                  <th className="py-2 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.map(h => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-nowrap">
                      {new Date(h.changedAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="py-2 pr-3 font-mono text-muted-foreground">{h.oldImei}</td>
                    <td className="py-2 pr-3 font-mono font-medium">{h.newImei}</td>
                    <td className="py-2 pr-3">
                      {h.restoredStatus
                        ? <span className="rounded px-1.5 py-0.5 bg-green-100 text-green-700 text-[11px]">{STATUS_LABEL[h.restoredStatus] ?? h.restoredStatus}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2">
                      <span className={h.source === "pool" ? "text-amber-700" : ""}>{h.reason ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Single-item form (reused for both Add/Single and Edit) ─── */
interface SingleItemFormProps {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  brands: Brand[] | undefined;
  allModels: DeviceModel[] | undefined;
  deviceIdRequired: boolean;
  brandRequires: boolean;
  requireDeviceId: boolean;
  onRequireChange: (v: boolean) => void;
  isEdit: boolean;
}

function SingleItemForm({ form, setForm, brands, allModels, deviceIdRequired, brandRequires, requireDeviceId, onRequireChange, isEdit }: SingleItemFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>IMEI *</Label>
          <Input value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} disabled={isEdit} placeholder="353506..." />
        </div>
        <div className="space-y-1.5">
          <Label className={deviceIdRequired ? "font-semibold" : ""}>
            Device ID {deviceIdRequired && <span className="text-destructive">*</span>}
            {!deviceIdRequired && <span className="text-xs font-normal text-muted-foreground"> (optional)</span>}
          </Label>
          <Input
            value={form.deviceId}
            onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}
            placeholder={deviceIdRequired ? "Required" : "Optional"}
            className={deviceIdRequired && !form.deviceId ? "border-destructive" : ""}
          />
          {brandRequires && (
            <p className="text-xs text-amber-600">⚠ Required for this brand</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Brand *</Label>
          <SearchableSelect
            value={form.brandId}
            onValueChange={v => {
              const selected = brands?.find(b => String(b.id) === v);
              setForm(f => ({ ...f, brandId: v, modelId: "" }));
              onRequireChange(selected?.deviceIdMandatory ?? false);
            }}
            options={(brands ?? []).map(b => ({ value: String(b.id), label: b.name }))}
            placeholder="Select brand"
            searchPlaceholder="Search brand…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Model *</Label>
          <SearchableSelect
            value={form.modelId}
            onValueChange={v => setForm(f => ({ ...f, modelId: v }))}
            options={(allModels ?? []).map(m => ({ value: String(m.id), label: m.name }))}
            placeholder="Select model"
            searchPlaceholder="Search model…"
            disabled={!form.brandId}
          />
        </div>

        {/* Require Device ID checkbox */}
        {!isEdit && (
          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              id="single-require-did"
              checked={requireDeviceId || brandRequires}
              disabled={brandRequires}
              onCheckedChange={v => onRequireChange(!!v)}
            />
            <label htmlFor="single-require-did" className={`text-sm select-none ${brandRequires ? "font-medium text-amber-700" : "cursor-pointer text-muted-foreground"}`}>
              {brandRequires ? `⚠ Device ID mandatory for ${brands?.find(b => String(b.id) === form.brandId)?.name ?? "this brand"}` : "Make Device ID mandatory for this item"}
            </label>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>PTA Status</Label>
          <Select value={form.ptaStatus} onValueChange={v => setForm(f => ({ ...f, ptaStatus: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PTA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Landed Cost (Rs)</Label>
          <Input type="number" value={form.landedCost} onChange={e => setForm(f => ({ ...f, landedCost: e.target.value }))} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label>Selling Price (Rs)</Label>
          <Input type="number" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label>Purchase Date *</Label>
          <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>PSID</Label>
          <Input value={form.psid} onChange={e => setForm(f => ({ ...f, psid: e.target.value }))} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label>Tracker SIM No <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <Input value={form.trackerSimNo} onChange={e => setForm(f => ({ ...f, trackerSimNo: e.target.value }))} placeholder="e.g. 03001234567" />
        </div>
        <div className="space-y-1.5">
          <Label>GRN Number</Label>
          <Input value={form.grnNumber} onChange={e => setForm(f => ({ ...f, grnNumber: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Supplier Invoice #</Label>
          <Input value={form.supplierInvoiceNumber} onChange={e => setForm(f => ({ ...f, supplierInvoiceNumber: e.target.value }))} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </div>
    </div>
  );
}
