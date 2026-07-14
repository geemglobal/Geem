import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useOtpTimer } from "@/hooks/useOtpTimer";
import { Building2, FileText, Users, Plus, Mail, MessageSquare, Send, Loader2, CheckCircle2, Zap, Globe, Upload, X, Palette, KeyRound, Eye, EyeOff, Pencil, Trash2, ShieldCheck, User, Phone, AtSign, UserCog, Smartphone, MessageCircle, Clock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpload } from "@workspace/object-storage-web";
import { applyPrimaryColor, applyBorderRadius } from "@/lib/theme";

interface CompanySettings { companyName: string; logo: string | null; favicon: string | null; banner: string | null; address: string | null; phone: string | null; email: string | null; currency: string; taxNumber: string | null; whatsappNumber: string | null; primaryColor: string; borderRadius: string; }

const PRESET_COLORS = [
  { name: "Ocean Blue",    hex: "#2563eb" },
  { name: "Forest Green",  hex: "#16a34a" },
  { name: "Royal Violet",  hex: "#7c3aed" },
  { name: "Crimson",       hex: "#e11d48" },
  { name: "Amber",         hex: "#d97706" },
  { name: "Teal",          hex: "#0d9488" },
  { name: "Slate",         hex: "#475569" },
  { name: "Midnight",      hex: "#1e293b" },
];

const RADIUS_OPTIONS = [
  { value: "sharp", label: "Sharp",   preview: "0px"   },
  { value: "sm",    label: "Subtle",  preview: "4px"   },
  { value: "md",    label: "Default", preview: "8px"   },
  { value: "lg",    label: "Rounded", preview: "12px"  },
  { value: "xl",    label: "Pill",    preview: "20px"  },
];
interface InvoiceSettings { logo: string | null; invoicePrefix: string; nextInvoiceNumber: number; defaultPaymentTerms: string; defaultTaxRate: number; defaultNotes: string | null; defaultFooter: string | null; pdfTemplate: string; }
type PermActions = { view: boolean; add: boolean; edit: boolean; delete: boolean };
type Permissions = Record<string, PermActions>;

interface UserRecord {
  id: number; name: string; username: string | null; email: string; mobile: string | null;
  role: string; active: boolean; permissions: Permissions | null;
  lastLogin: string | null; createdAt: string;
}

const PERM_MODULES = [
  { key: "inventory",      label: "Inventory"       },
  { key: "pos",            label: "POS"             },
  { key: "invoices",       label: "Invoices"        },
  { key: "quotations",     label: "Quotations"      },
  { key: "preorders",      label: "Pre-Orders"      },
  { key: "customers",      label: "Customers"       },
  { key: "products",       label: "Products"        },
  { key: "webOrders",      label: "Web Orders"      },
  { key: "procurement",    label: "Procurement"     },
  { key: "shipments",      label: "Shipments"       },
  { key: "serviceTickets", label: "Service Tickets" },
  { key: "vault",          label: "Vault"           },
  { key: "reports",        label: "Reports"         },
  { key: "masterData",     label: "Master Data"     },
  { key: "settings",       label: "Settings"        },
];

function defaultPermissions(): Permissions {
  return Object.fromEntries(PERM_MODULES.map(m => [m.key, { view: false, add: false, edit: false, delete: false }]));
}

interface IntegrationData<T = Record<string, string | number | boolean>> {
  enabled: boolean;
  config: T;
}

const TABS = [
  { id: "company",      label: "Company",      icon: Building2 },
  { id: "invoice",      label: "Invoice",       icon: FileText },
  { id: "integrations", label: "Integrations",  icon: Zap },
  { id: "seo",          label: "SEO & Google",  icon: Globe },
  { id: "users",        label: "Users",         icon: Users },
  { id: "security",     label: "Security",      icon: KeyRound },
];

const emptyUser = { name: "", email: "", password: "", role: "staff", mobile: "" };

// ── field helper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

// ── image upload field ────────────────────────────────────────────────────────
function ImageUploadField({
  label, hint, value, onChange, previewClass, aspectClass,
}: {
  label: string; hint: string;
  value: string | null;
  onChange: (url: string) => void;
  previewClass?: string;
  aspectClass?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (res) => onChange(`/api/storage${res.objectPath}`),
    onError: (err) => alert(`Upload failed: ${err.message}`),
  });
  const isBanner = !!aspectClass;
  const actions = (
    <div className={isBanner ? "flex gap-2" : "flex-1 space-y-2"}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
      <Button type="button" variant="outline" size="sm" className={isBanner ? "gap-1.5" : "w-full gap-1.5"}
        onClick={() => fileRef.current?.click()} disabled={isUploading}>
        {isUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</> : <><Upload className="h-3.5 w-3.5" />Upload</>}
      </Button>
      {!isBanner && (
        <div className="flex gap-1.5 items-center">
          <Input className="text-xs h-7" value={value ?? ""} placeholder="or paste URL…"
            onChange={e => onChange(e.target.value)} />
          {value && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => onChange("")}><X className="h-3 w-3" /></Button>
          )}
        </div>
      )}
      {isBanner && value && (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
          onClick={() => onChange("")}><X className="h-3.5 w-3.5" />Remove</Button>
      )}
    </div>
  );
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {isBanner ? (
        <>
          <div className={`w-full border rounded-lg bg-muted flex items-center justify-center overflow-hidden ${aspectClass}`}>
            {value ? (
              <img src={value} alt="preview" className={`object-cover w-full h-full ${previewClass ?? ""}`}
                onError={e => { (e.target as HTMLImageElement).src = ""; }} />
            ) : (
              <span className="text-xs text-muted-foreground">No banner image</span>
            )}
          </div>
          <div className="flex gap-1.5 items-center">
            <Input className="text-xs h-7 flex-1" value={value ?? ""} placeholder="or paste URL…"
              onChange={e => onChange(e.target.value)} />
          </div>
          {actions}
        </>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-24 h-16 border rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {value ? (
              <img src={value} alt="preview" className={`object-contain w-full h-full ${previewClass ?? ""}`}
                onError={e => { (e.target as HTMLImageElement).src = ""; }} />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-1">No image</span>
            )}
          </div>
          {actions}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("company");
  const [companyForm, setCompanyForm] = useState<Partial<CompanySettings>>({});
  const [invoiceForm, setInvoiceForm] = useState<Partial<InvoiceSettings>>({});
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState(emptyUser);
  const [userFormStep, setUserFormStep] = useState<"form" | "channel" | "otp">("form");
  const [userFormOtp, setUserFormOtp] = useState("");
  const [userLastChannel, setUserLastChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const { secondsLeft: userSecondsLeft, canResend: userCanResend, startTimer: startUserTimer } = useOtpTimer(60);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [changePwdForm, setChangePwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // ── company read-only lock ────────────────────────────────────────────────
  const [editingCompany, setEditingCompany] = useState(false);

  // ── edit user dialog ──────────────────────────────────────────────────────
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ name: "", username: "", email: "", mobile: "", role: "staff" });

  // ── delete confirm ────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  // ── permissions dialog ────────────────────────────────────────────────────
  const [showPermDialog, setShowPermDialog] = useState(false);
  const [permTarget, setPermTarget] = useState<UserRecord | null>(null);
  const [permForm, setPermForm] = useState<Permissions>(defaultPermissions());

  // ── my profile editing ────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", username: "", email: "", mobile: "" });

  // ── integrations local state ──────────────────────────────────────────────
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailCfg, setEmailCfg] = useState<Record<string, string | number | boolean>>({
    host: "164.68.120.130", port: 587, secure: false, user: "noreply@geem.pk", password: "", fromName: "Geem", fromEmail: "noreply@geem.pk", adminEmail: "zahidgul@geem.pk",
  });
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsCfg, setSmsCfg] = useState<Record<string, string | number | boolean>>({
    provider: "twilio", accountSid: "", authToken: "", fromNumber: "",
    instanceId: "", token: "", apiUrl: "", apiKey: "", senderId: "",
  });
  const [testSmsTo, setTestSmsTo] = useState("");
  const [testSmsLoading, setTestSmsLoading] = useState(false);

  const [waEnabled, setWaEnabled] = useState(false);
  const [waCfg, setWaCfg] = useState<Record<string, string | number | boolean>>({
    provider: "ultramsg", instanceId: "", token: "",
    phoneNumberId: "", accessToken: "", apiUrl: "", apiKey: "",
  });
  const [testWaTo, setTestWaTo] = useState("");
  const [testWaLoading, setTestWaLoading] = useState(false);

  const [gaEnabled, setGaEnabled] = useState(false);
  const [gaMeasurementId, setGaMeasurementId] = useState("");
  const [scEnabled, setScEnabled] = useState(false);
  const [scVerificationTag, setScVerificationTag] = useState("");
  const [rcEnabled, setRcEnabled] = useState(false);
  const [rcSiteKey, setRcSiteKey] = useState("");
  const [rcSecretKey, setRcSecretKey] = useState("");

  // Which integration card is open for editing (null = all locked / collapsed when configured).
  const [editingInt, setEditingInt] = useState<string | null>(null);
  // Reset editing state when tab changes so integrations re-lock on tab switch.
  useEffect(() => { setEditingInt(null); }, [tab]);

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: company } = useQuery({ queryKey: ["settings-company"], queryFn: () => axiosInstance.get<CompanySettings>("/settings/company").then(r => r.data) });
  const { data: invoice } = useQuery({ queryKey: ["settings-invoice"], queryFn: () => axiosInstance.get<InvoiceSettings>("/settings/invoice").then(r => r.data) });
  const { data: users }   = useQuery({ queryKey: ["users"], queryFn: () => axiosInstance.get<UserRecord[]>("/users").then(r => r.data), enabled: tab === "users" });
  const { data: me }      = useQuery({ queryKey: ["auth-me"], queryFn: () => axiosInstance.get<UserRecord>("/auth/me").then(r => r.data), enabled: tab === "users" });

  const { data: emailInt } = useQuery<IntegrationData>({ queryKey: ["int-email"], queryFn: () => axiosInstance.get("/settings/integrations/email").then(r => r.data), enabled: tab === "integrations" });
  const { data: smsInt }   = useQuery<IntegrationData>({ queryKey: ["int-sms"],   queryFn: () => axiosInstance.get("/settings/integrations/sms").then(r => r.data),   enabled: tab === "integrations" });
  const { data: waInt }    = useQuery<IntegrationData>({ queryKey: ["int-whatsapp"], queryFn: () => axiosInstance.get("/settings/integrations/whatsapp").then(r => r.data), enabled: tab === "integrations" });
  const { data: gaInt }    = useQuery<IntegrationData>({ queryKey: ["int-google-analytics"], queryFn: () => axiosInstance.get("/settings/integrations/google_analytics").then(r => r.data), enabled: tab === "seo" });
  const { data: scInt }    = useQuery<IntegrationData>({ queryKey: ["int-google-sc"],        queryFn: () => axiosInstance.get("/settings/integrations/google_search_console").then(r => r.data), enabled: tab === "seo" });
  const { data: rcInt }    = useQuery<IntegrationData>({ queryKey: ["int-recaptcha"],         queryFn: () => axiosInstance.get("/settings/integrations/recaptcha").then(r => r.data),              enabled: tab === "seo" });

  useEffect(() => {
    if (company) {
      setCompanyForm(company);
      // Auto-lock to read-only when real data is saved (logo, favicon, or phone present)
      if (company.logo || company.favicon || company.phone || company.email) {
        setEditingCompany(false);
      }
    }
  }, [company]);
  useEffect(() => { if (invoice) setInvoiceForm(invoice); }, [invoice]);

  useEffect(() => { if (emailInt) { setEmailEnabled(emailInt.enabled); setEmailCfg(v => ({ ...v, ...emailInt.config })); } }, [emailInt]);
  useEffect(() => { if (smsInt)   { setSmsEnabled(smsInt.enabled);     setSmsCfg(v => ({ ...v, ...smsInt.config }));     } }, [smsInt]);
  useEffect(() => { if (waInt)    { setWaEnabled(waInt.enabled);       setWaCfg(v => ({ ...v, ...waInt.config }));       } }, [waInt]);
  useEffect(() => { if (gaInt) { setGaEnabled(gaInt.enabled); setGaMeasurementId(String((gaInt.config as Record<string, string>).measurementId ?? "")); } }, [gaInt]);
  useEffect(() => { if (scInt) { setScEnabled(scInt.enabled); setScVerificationTag(String((scInt.config as Record<string, string>).verificationTag ?? "")); } }, [scInt]);
  useEffect(() => { if (rcInt) { const cfg = rcInt.config as Record<string, string>; setRcEnabled(rcInt.enabled); setRcSiteKey(cfg.siteKey ?? ""); setRcSecretKey(cfg.secretKey ?? ""); } }, [rcInt]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const saveCompany  = useMutation({
    mutationFn: (d: Partial<CompanySettings>) => axiosInstance.patch("/settings/company", d).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-company"] });
      qc.invalidateQueries({ queryKey: ["company-settings-logo"] });
      toast({ title: "Company settings saved" });
      if (companyForm.primaryColor) applyPrimaryColor(companyForm.primaryColor);
      if (companyForm.borderRadius) applyBorderRadius(companyForm.borderRadius);
      setEditingCompany(false);
    },
  });
  const saveInvoice  = useMutation({ mutationFn: (d: Partial<InvoiceSettings>) => axiosInstance.patch("/settings/invoice", d).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings-invoice"] }); toast({ title: "Invoice settings saved" }); } });
  const initiateUser = useMutation({
    mutationFn: (d: typeof emptyUser & { channel: string }) => axiosInstance.post("/users/initiate", d).then(r => r.data),
    onSuccess: (data: { sentVia?: string; ok?: boolean; error?: string }) => {
      if (data.ok === false) {
        toast({ title: data.error ?? "Failed to send OTP", variant: "destructive" });
        return;
      }
      toast({ title: `OTP sent via ${data.sentVia ?? "selected channel"}`, description: "Enter the code to verify and create the account." });
      setUserFormStep("otp");
      startUserTimer();
    },
    onError: (e: unknown) => toast({ title: String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed to send OTP"), variant: "destructive" }),
  });
  const verifyUser   = useMutation({
    mutationFn: (d: { email: string; code: string }) => axiosInstance.post("/users/verify", d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowUserForm(false); setUserForm(emptyUser); setUserFormStep("form"); setUserFormOtp(""); toast({ title: "User created & verified" }); },
    onError: (e: unknown) => toast({ title: String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Verification failed"), variant: "destructive" }),
  });
  const createUser   = useMutation({ mutationFn: (d: typeof emptyUser) => axiosInstance.post("/users", d).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowUserForm(false); setUserForm(emptyUser); toast({ title: "User created" }); } });
  const toggleUser   = useMutation({ mutationFn: ({ id, active }: { id: number; active: boolean }) => axiosInstance.patch(`/users/${id}`, { active }).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });
  const updateUser   = useMutation({
    mutationFn: ({ id, ...d }: { id: number; name: string; username: string; email: string; mobile: string; role: string }) => axiosInstance.patch(`/users/${id}`, d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowEditDialog(false); toast({ title: "User updated" }); },
    onError: (e: unknown) => toast({ title: String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Update failed"), variant: "destructive" }),
  });
  const deleteUser   = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/users/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowDeleteDialog(false); toast({ title: "User deleted" }); },
  });
  const updateMe     = useMutation({
    mutationFn: (d: { name: string; username: string; email: string; mobile: string }) => axiosInstance.patch("/auth/me", d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["auth-me"] }); setEditingProfile(false); toast({ title: "Profile updated" }); },
    onError: (e: unknown) => toast({ title: String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Update failed"), variant: "destructive" }),
  });
  const updatePerms  = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: Permissions }) => axiosInstance.patch(`/users/${id}`, { permissions }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowPermDialog(false); toast({ title: "Permissions saved" }); },
  });
  const resetPwdMut  = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) => axiosInstance.post(`/users/${id}/reset-password`, { newPassword }).then(r => r.data),
    onSuccess: () => { setShowResetDialog(false); setResetPwd(""); toast({ title: "Password reset successfully" }); },
    onError: (e: unknown) => toast({ title: String((e as {message?:string}).message ?? e), variant: "destructive" }),
  });
  const changePwdMut = useMutation({
    mutationFn: (d: { currentPassword: string; newPassword: string }) => axiosInstance.post("/auth/change-password", d).then(r => r.data),
    onSuccess: () => { setChangePwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); toast({ title: "Password changed successfully" }); },
    onError: (e: unknown) => toast({ title: String((e as {response?: {data?: {error?:string}}}).response?.data?.error ?? (e as {message?:string}).message ?? e), variant: "destructive" }),
  });

  const saveIntegration = (type: string, enabled: boolean, config: Record<string, string | number | boolean>, queryKey: string) =>
    axiosInstance.patch(`/settings/integrations/${type}`, { enabled, config }).then(() => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} settings saved` });
    }).catch(err => toast({ title: String(err), variant: "destructive" }));

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    try {
      await axiosInstance.post("/settings/integrations/email/test", { to: testEmailTo || undefined });
      toast({ title: "Test email sent successfully ✅" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: `Test failed: ${msg}`, variant: "destructive" });
    } finally { setTestEmailLoading(false); }
  };

  const handleTestSms = async () => {
    setTestSmsLoading(true);
    try {
      await axiosInstance.post("/settings/integrations/sms/test", { to: testSmsTo });
      toast({ title: "Test SMS sent successfully ✅" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: `Test failed: ${msg}`, variant: "destructive" });
    } finally { setTestSmsLoading(false); }
  };

  const handleTestWa = async () => {
    setTestWaLoading(true);
    try {
      await axiosInstance.post("/settings/integrations/whatsapp/test", { to: testWaTo });
      toast({ title: "Test WhatsApp message sent ✅" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: `Test failed: ${msg}`, variant: "destructive" });
    } finally { setTestWaLoading(false); }
  };

  const ec = (k: string) => String(emailCfg[k] ?? "");
  const sc = (k: string) => String(smsCfg[k] ?? "");
  const wc = (k: string) => String(waCfg[k] ?? "");

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-muted-foreground">Configure your system preferences</p></div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <Button key={t.id} variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)}>
            <t.icon className="h-4 w-4 mr-2" />{t.label}
          </Button>
        ))}
      </div>

      {/* ── COMPANY ─────────────────────────────────────────────────────── */}
      {tab === "company" && (
        <>
          {/* ── Read-only summary — shown when company is saved and not editing ── */}
          {!editingCompany && company && (company.logo || company.favicon || company.phone || company.email) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Company Information</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setEditingCompany(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Settings
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 max-w-xl">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Company settings saved — click <strong>Edit Settings</strong> to make changes.</span>
                </div>

                {/* Logo + Favicon previews */}
                <div className="flex gap-4 items-start flex-wrap">
                  {company.logo && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Logo</p>
                      <div className="w-36 h-16 border rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        <img src={company.logo} alt="Logo" className="object-contain w-full h-full p-2" />
                      </div>
                    </div>
                  )}
                  {company.favicon && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Favicon</p>
                      <div className="w-16 h-16 border rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        <img src={company.favicon} alt="Favicon" className="object-contain w-full h-full p-1" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Banner preview */}
                {company.banner && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Banner / Cover Image</p>
                    <div className="w-full aspect-[3/1] border rounded-lg bg-muted overflow-hidden">
                      <img src={company.banner} alt="Banner" className="object-cover w-full h-full" />
                    </div>
                  </div>
                )}

                {/* Company detail rows */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><p className="text-xs text-muted-foreground mb-0.5">Company Name</p><p className="font-medium">{company.companyName}</p></div>
                  {company.phone && <div><p className="text-xs text-muted-foreground mb-0.5">Phone</p><p className="font-medium">{company.phone}</p></div>}
                  {company.email && <div><p className="text-xs text-muted-foreground mb-0.5">Email</p><p className="font-medium">{company.email}</p></div>}
                  {company.whatsappNumber && <div><p className="text-xs text-muted-foreground mb-0.5">WhatsApp</p><p className="font-medium">{company.whatsappNumber}</p></div>}
                  {company.taxNumber && <div><p className="text-xs text-muted-foreground mb-0.5">Tax Number (NTN/STRN)</p><p className="font-medium">{company.taxNumber}</p></div>}
                  <div><p className="text-xs text-muted-foreground mb-0.5">Currency</p><p className="font-medium">{company.currency}</p></div>
                  {company.address && <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Address</p><p className="font-medium">{company.address}</p></div>}
                </div>

                {/* Theme color swatch */}
                <div className="flex items-center gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">Theme Color</p>
                  <div className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: company.primaryColor }} />
                  <span className="text-xs font-mono text-muted-foreground">{company.primaryColor}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Edit form — shown when editing or no saved data yet ── */}
          {(editingCompany || !company || (!company.logo && !company.favicon && !company.phone && !company.email)) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Company Information</CardTitle>
                  {editingCompany && (
                    <Button size="sm" variant="ghost" onClick={() => setEditingCompany(false)}>Cancel</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 max-w-xl">
                <Field label="Company Name"><Input value={companyForm.companyName ?? ""} onChange={e => setCompanyForm(f => ({ ...f, companyName: e.target.value }))} /></Field>

                <ImageUploadField
                  label="Company Logo"
                  hint="Used in the shop header, footer, and all auth pages. PNG or SVG recommended."
                  value={companyForm.logo ?? null}
                  onChange={url => setCompanyForm(f => ({ ...f, logo: url || null }))}
                />

                <ImageUploadField
                  label="Favicon"
                  hint="Browser tab icon. Use a square image (32×32 or 64×64 px) in PNG or ICO format."
                  value={companyForm.favicon ?? null}
                  onChange={url => setCompanyForm(f => ({ ...f, favicon: url || null }))}
                  previewClass="!object-contain p-1"
                />

                <ImageUploadField
                  label="Banner / Cover Image"
                  hint="Wide banner shown on the shop homepage hero section. Recommended: 1200×400 px JPG or PNG."
                  value={companyForm.banner ?? null}
                  onChange={url => setCompanyForm(f => ({ ...f, banner: url || null }))}
                  previewClass="!object-cover"
                  aspectClass="aspect-[3/1]"
                />

                <Field label="Phone"><Input value={companyForm.phone ?? ""} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))} placeholder="+92 21 1234567" /></Field>
                <Field label="Email"><Input value={companyForm.email ?? ""} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))} placeholder="info@geem.pk" /></Field>
                <Field label="WhatsApp Number"><Input value={companyForm.whatsappNumber ?? ""} onChange={e => setCompanyForm(f => ({ ...f, whatsappNumber: e.target.value }))} placeholder="+92300-1234567" /></Field>

                {/* ── Appearance ─────────────────────────────────────────── */}
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Palette className="h-4 w-4 text-primary" />
                    Appearance
                  </div>

                  {/* Primary Color */}
                  <div className="space-y-2">
                    <Label>Brand / Theme Color</Label>
                    <p className="text-xs text-muted-foreground">Applied to buttons, links, badges, and accents across the entire app.</p>
                    <div className="flex flex-wrap gap-2 pb-1">
                      {PRESET_COLORS.map(({ name, hex }) => (
                        <button
                          key={hex}
                          title={name}
                          type="button"
                          onClick={() => {
                            setCompanyForm(f => ({ ...f, primaryColor: hex }));
                            applyPrimaryColor(hex);
                          }}
                          className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 focus:outline-none ${
                            (companyForm.primaryColor ?? "#2563eb") === hex
                              ? "border-foreground ring-2 ring-offset-1 ring-foreground/30 scale-110"
                              : "border-white/80 shadow"
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="h-9 w-14 rounded border cursor-pointer p-0.5"
                        value={companyForm.primaryColor ?? "#2563eb"}
                        onChange={e => {
                          setCompanyForm(f => ({ ...f, primaryColor: e.target.value }));
                          applyPrimaryColor(e.target.value);
                        }}
                      />
                      <Input
                        className="w-32 font-mono"
                        value={companyForm.primaryColor ?? "#2563eb"}
                        onChange={e => {
                          setCompanyForm(f => ({ ...f, primaryColor: e.target.value }));
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) applyPrimaryColor(e.target.value);
                        }}
                        placeholder="#2563eb"
                      />
                      <div
                        className="h-9 flex-1 max-w-[120px] rounded-md text-xs flex items-center justify-center text-white font-medium shadow-sm"
                        style={{ backgroundColor: companyForm.primaryColor ?? "#2563eb" }}
                      >
                        Preview
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Border Radius */}
                  <div className="space-y-2">
                    <Label>Corner Style</Label>
                    <p className="text-xs text-muted-foreground">Controls roundness of buttons, cards, and input fields.</p>
                    <div className="flex gap-2 flex-wrap">
                      {RADIUS_OPTIONS.map(({ value, label, preview }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setCompanyForm(f => ({ ...f, borderRadius: value }));
                            applyBorderRadius(value);
                          }}
                          className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all ${
                            (companyForm.borderRadius ?? "md") === value
                              ? "border-primary bg-primary/10 text-primary font-semibold"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div
                            className="w-8 h-8 bg-primary/20 border-2 border-primary/40"
                            style={{ borderRadius: preview }}
                          />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Field label="Address"><Input value={companyForm.address ?? ""} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} /></Field>
                <Field label="Tax Number (NTN/STRN)"><Input value={companyForm.taxNumber ?? ""} onChange={e => setCompanyForm(f => ({ ...f, taxNumber: e.target.value }))} /></Field>
                <Field label="Currency">
                  <Select value={companyForm.currency ?? "PKR"} onValueChange={v => setCompanyForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="PKR">PKR — Pakistani Rupee</SelectItem><SelectItem value="USD">USD — US Dollar</SelectItem></SelectContent>
                  </Select>
                </Field>
                <div className="flex gap-2">
                  <Button onClick={() => saveCompany.mutate(companyForm)} disabled={saveCompany.isPending}>{saveCompany.isPending ? "Saving…" : "Save Company Settings"}</Button>
                  {editingCompany && <Button variant="outline" onClick={() => setEditingCompany(false)}>Cancel</Button>}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── INVOICE ─────────────────────────────────────────────────────── */}
      {tab === "invoice" && (
        <Card>
          <CardHeader><CardTitle>Invoice Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <ImageUploadField
              label="Invoice Logo"
              hint="Logo printed on invoices and quotations. If not set, the Company Logo is used. PNG or SVG recommended."
              value={invoiceForm.logo ?? null}
              onChange={url => setInvoiceForm(f => ({ ...f, logo: url || null }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice Prefix"><Input value={invoiceForm.invoicePrefix ?? ""} onChange={e => setInvoiceForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="INV" /></Field>
              <Field label="Next Invoice #"><Input type="number" value={invoiceForm.nextInvoiceNumber ?? 1001} onChange={e => setInvoiceForm(f => ({ ...f, nextInvoiceNumber: parseInt(e.target.value) || 1001 }))} /></Field>
            </div>
            <Field label="Default Payment Terms"><Input value={invoiceForm.defaultPaymentTerms ?? ""} onChange={e => setInvoiceForm(f => ({ ...f, defaultPaymentTerms: e.target.value }))} placeholder="Due on Receipt" /></Field>
            <Field label="Default Tax Rate (%)"><Input type="number" step="0.1" value={invoiceForm.defaultTaxRate ?? 0} onChange={e => setInvoiceForm(f => ({ ...f, defaultTaxRate: parseFloat(e.target.value) || 0 }))} /></Field>
            <Field label="Default Notes"><Input value={invoiceForm.defaultNotes ?? ""} onChange={e => setInvoiceForm(f => ({ ...f, defaultNotes: e.target.value }))} placeholder="Thank you for your business!" /></Field>
            <Field label="Invoice Footer"><Input value={invoiceForm.defaultFooter ?? ""} onChange={e => setInvoiceForm(f => ({ ...f, defaultFooter: e.target.value }))} placeholder="Footer text on invoices" /></Field>
            <Button onClick={() => saveInvoice.mutate(invoiceForm)} disabled={saveInvoice.isPending}>{saveInvoice.isPending ? "Saving…" : "Save Invoice Settings"}</Button>
          </CardContent>
        </Card>
      )}

      {/* ── INTEGRATIONS ────────────────────────────────────────────────── */}
      {tab === "integrations" && (
        <div className="space-y-6 max-w-2xl">

          {/* EMAIL ─────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600" />Email (SMTP)</CardTitle>
                <div className="flex items-center gap-2">
                  {emailEnabled && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Enabled</Badge>}
                  <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Send invoices, receipts, and notifications by email.</p>
            </CardHeader>
            {emailEnabled && emailInt && editingInt !== "email" && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Email active — settings are read-only. Click <strong>Edit</strong> to make changes.</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><p className="text-xs text-muted-foreground mb-0.5">SMTP Host</p><p className="font-medium font-mono">{ec("host") || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">Port</p><p className="font-medium">{emailCfg.port ?? 587} — {emailCfg.port === 465 ? "SSL/TLS" : "STARTTLS"}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">Username / Email</p><p className="font-medium">{ec("user") || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">Password</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">From Name</p><p className="font-medium">{ec("fromName") || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">From Email</p><p className="font-medium">{ec("fromEmail") || "—"}</p></div>
                  {ec("adminEmail") && <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Admin Alert Email</p><p className="font-medium">{ec("adminEmail")}</p></div>}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingInt("email")}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Settings
                  </Button>
                </div>
              </CardContent>
            )}
            {emailEnabled && (!emailInt || editingInt === "email") && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="SMTP Host"><Input value={ec("host")} onChange={e => setEmailCfg(f => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" /></Field>
                  <Field label="Port">
                    <Select value={String(emailCfg.port ?? 587)} onValueChange={v => setEmailCfg(f => ({ ...f, port: parseInt(v), secure: v === "465" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="587">587 — STARTTLS (recommended)</SelectItem>
                        <SelectItem value="465">465 — SSL/TLS</SelectItem>
                        <SelectItem value="25">25 — Plain (not recommended)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Username / Email"><Input value={ec("user")} onChange={e => setEmailCfg(f => ({ ...f, user: e.target.value }))} placeholder="you@gmail.com" /></Field>
                  <Field label="Password / App Password"><Input type="password" value={ec("password")} onChange={e => setEmailCfg(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="From Name"><Input value={ec("fromName")} onChange={e => setEmailCfg(f => ({ ...f, fromName: e.target.value }))} placeholder="Geem" /></Field>
                  <Field label="From Email"><Input value={ec("fromEmail")} onChange={e => setEmailCfg(f => ({ ...f, fromEmail: e.target.value }))} placeholder="noreply@geem.pk" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Admin Alert Email" ><Input value={ec("adminEmail")} onChange={e => setEmailCfg(f => ({ ...f, adminEmail: e.target.value }))} placeholder="zahidgul@geem.pk" /></Field>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-green-800 space-y-1">
                  <p className="font-semibold">✅ Geem VPS Mail Server (Postfix + SASL)</p>
                  <p>Host: <strong>164.68.120.130:587</strong> · STARTTLS · Login: noreply@geem.pk</p>
                  <p>Mailboxes: zahidgul@geem.pk · info@ · support@ · notifications@ · orders@ · noreply@geem.pk</p>
                </div>
                <Separator />
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Field label="Send test email to"><Input value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} placeholder="test@example.com" /></Field>
                  </div>
                  <Button variant="outline" onClick={handleTestEmail} disabled={testEmailLoading}>
                    {testEmailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="ml-2">Test</span>
                  </Button>
                  <Button onClick={() => { saveIntegration("email", emailEnabled, emailCfg, "int-email"); setEditingInt(null); }}>Save</Button>
                </div>
              </CardContent>
            )}
            {!emailEnabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Toggle the switch above to configure email settings.</p>
              </CardContent>
            )}
          </Card>

          {/* SMS ────────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-green-600" />SMS</CardTitle>
                <div className="flex items-center gap-2">
                  {smsEnabled && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Enabled</Badge>}
                  <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Send order confirmations and alerts by SMS.</p>
            </CardHeader>
            {smsEnabled && smsInt && editingInt !== "sms" && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>SMS active — settings are read-only. Click <strong>Edit</strong> to make changes.</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Provider</p><p className="font-medium capitalize">{sc("provider") || "—"}</p></div>
                  {sc("provider") === "twilio" && <>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Account SID</p><p className="font-medium font-mono">{sc("accountSid") ? sc("accountSid").slice(0, 8) + "••••••••" : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Auth Token</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">From Number</p><p className="font-medium">{sc("fromNumber") || "—"}</p></div>
                  </>}
                  {sc("provider") === "ultramsg" && <>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Instance ID</p><p className="font-medium font-mono">{sc("instanceId") || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Token</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                  </>}
                  {sc("provider") === "generic" && <>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">API URL</p><p className="font-medium font-mono">{sc("apiUrl") || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">API Key</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Sender ID</p><p className="font-medium">{sc("senderId") || "—"}</p></div>
                  </>}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingInt("sms")}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Settings
                  </Button>
                </div>
              </CardContent>
            )}
            {smsEnabled && (!smsInt || editingInt === "sms") && (
              <CardContent className="space-y-4">
                <Field label="SMS Provider">
                  <Select value={sc("provider")} onValueChange={v => setSmsCfg(f => ({ ...f, provider: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="ultramsg">UltraMsg</SelectItem>
                      <SelectItem value="generic">Generic HTTP Gateway</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {sc("provider") === "twilio" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Account SID"><Input value={sc("accountSid")} onChange={e => setSmsCfg(f => ({ ...f, accountSid: e.target.value }))} placeholder="ACxxxxxxxxxx" /></Field>
                      <Field label="Auth Token"><Input type="password" value={sc("authToken")} onChange={e => setSmsCfg(f => ({ ...f, authToken: e.target.value }))} placeholder="••••••••" /></Field>
                    </div>
                    <Field label="From Number"><Input value={sc("fromNumber")} onChange={e => setSmsCfg(f => ({ ...f, fromNumber: e.target.value }))} placeholder="+14155552671" /></Field>
                  </>
                )}
                {sc("provider") === "ultramsg" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Instance ID"><Input value={sc("instanceId")} onChange={e => setSmsCfg(f => ({ ...f, instanceId: e.target.value }))} placeholder="instance123" /></Field>
                    <Field label="Token"><Input type="password" value={sc("token")} onChange={e => setSmsCfg(f => ({ ...f, token: e.target.value }))} placeholder="••••••••" /></Field>
                  </div>
                )}
                {sc("provider") === "generic" && (
                  <>
                    <Field label="API URL"><Input value={sc("apiUrl")} onChange={e => setSmsCfg(f => ({ ...f, apiUrl: e.target.value }))} placeholder="https://sms-gateway.example.com/send" /></Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="API Key"><Input type="password" value={sc("apiKey")} onChange={e => setSmsCfg(f => ({ ...f, apiKey: e.target.value }))} placeholder="••••••••" /></Field>
                      <Field label="Sender ID"><Input value={sc("senderId")} onChange={e => setSmsCfg(f => ({ ...f, senderId: e.target.value }))} placeholder="GEEM" /></Field>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Field label="Send test SMS to"><Input value={testSmsTo} onChange={e => setTestSmsTo(e.target.value)} placeholder="+923001234567" /></Field>
                  </div>
                  <Button variant="outline" onClick={handleTestSms} disabled={testSmsLoading || !testSmsTo}>
                    {testSmsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="ml-2">Test</span>
                  </Button>
                  <Button onClick={() => { saveIntegration("sms", smsEnabled, smsCfg, "int-sms"); setEditingInt(null); }}>Save</Button>
                </div>
              </CardContent>
            )}
            {!smsEnabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Toggle the switch above to configure SMS settings.</p>
              </CardContent>
            )}
          </Card>

          {/* WHATSAPP ───────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </CardTitle>
                <div className="flex items-center gap-2">
                  {waEnabled && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Enabled</Badge>}
                  <Switch checked={waEnabled} onCheckedChange={setWaEnabled} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Send order updates and invoices via WhatsApp.</p>
            </CardHeader>
            {waEnabled && waInt && editingInt !== "wa" && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>WhatsApp active — settings are read-only. Click <strong>Edit</strong> to make changes.</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Provider</p><p className="font-medium">{wc("provider") === "ultramsg" ? "UltraMsg" : wc("provider") === "whatsapp_business" ? "WhatsApp Business Cloud API (Meta)" : wc("provider") === "generic" ? "Generic HTTP Gateway" : "—"}</p></div>
                  {wc("provider") === "ultramsg" && <>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Instance ID</p><p className="font-medium font-mono">{wc("instanceId") || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Token</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                  </>}
                  {wc("provider") === "whatsapp_business" && <>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Phone Number ID</p><p className="font-medium font-mono">{wc("phoneNumberId") || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Access Token</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                  </>}
                  {wc("provider") === "generic" && <>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">API URL</p><p className="font-medium font-mono">{wc("apiUrl") || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">API Key</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                  </>}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingInt("wa")}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Settings
                  </Button>
                </div>
              </CardContent>
            )}
            {waEnabled && (!waInt || editingInt === "wa") && (
              <CardContent className="space-y-4">
                <Field label="WhatsApp Provider">
                  <Select value={wc("provider")} onValueChange={v => setWaCfg(f => ({ ...f, provider: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ultramsg">UltraMsg (Recommended for Pakistan)</SelectItem>
                      <SelectItem value="whatsapp_business">WhatsApp Business Cloud API (Meta)</SelectItem>
                      <SelectItem value="generic">Generic HTTP Gateway</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {wc("provider") === "ultramsg" && (
                  <>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                      Sign up at <strong>ultramsg.com</strong> → create an instance → scan the QR code with your WhatsApp → copy Instance ID and Token here.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Instance ID"><Input value={wc("instanceId")} onChange={e => setWaCfg(f => ({ ...f, instanceId: e.target.value }))} placeholder="instance12345" /></Field>
                      <Field label="Token"><Input type="password" value={wc("token")} onChange={e => setWaCfg(f => ({ ...f, token: e.target.value }))} placeholder="••••••••" /></Field>
                    </div>
                  </>
                )}
                {wc("provider") === "whatsapp_business" && (
                  <>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                      Go to <strong>Meta for Developers</strong> → WhatsApp → API Setup → copy the Phone Number ID and temporary access token (or generate a permanent one).
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Phone Number ID"><Input value={wc("phoneNumberId")} onChange={e => setWaCfg(f => ({ ...f, phoneNumberId: e.target.value }))} placeholder="1234567890" /></Field>
                      <Field label="Access Token"><Input type="password" value={wc("accessToken")} onChange={e => setWaCfg(f => ({ ...f, accessToken: e.target.value }))} placeholder="••••••••" /></Field>
                    </div>
                  </>
                )}
                {wc("provider") === "generic" && (
                  <>
                    <Field label="API URL"><Input value={wc("apiUrl")} onChange={e => setWaCfg(f => ({ ...f, apiUrl: e.target.value }))} placeholder="https://wa-gateway.example.com/send" /></Field>
                    <Field label="API Key"><Input type="password" value={wc("apiKey")} onChange={e => setWaCfg(f => ({ ...f, apiKey: e.target.value }))} placeholder="••••••••" /></Field>
                  </>
                )}
                <Separator />
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Field label="Send test message to"><Input value={testWaTo} onChange={e => setTestWaTo(e.target.value)} placeholder="+923001234567" /></Field>
                  </div>
                  <Button variant="outline" onClick={handleTestWa} disabled={testWaLoading || !testWaTo}>
                    {testWaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="ml-2">Test</span>
                  </Button>
                  <Button onClick={() => { saveIntegration("whatsapp", waEnabled, waCfg, "int-whatsapp"); setEditingInt(null); }}>Save</Button>
                </div>
              </CardContent>
            )}
            {!waEnabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Toggle the switch above to configure WhatsApp settings.</p>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* ── SEO & GOOGLE ─────────────────────────────────────────────────── */}
      {tab === "seo" && (
        <div className="space-y-6 max-w-2xl">

          {/* Google Analytics */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" fill="#F9AB00"/><path d="M12 6v12M8 10l4-4 4 4" stroke="#E37400" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Google Analytics 4
                </CardTitle>
                <div className="flex items-center gap-2">
                  {gaEnabled && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>}
                  <Switch checked={gaEnabled} onCheckedChange={setGaEnabled} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Track visitors, page views, and shop performance in Google Analytics.</p>
            </CardHeader>
            {gaEnabled && gaInt && editingInt !== "ga" && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Google Analytics active — settings are read-only. Click <strong>Edit</strong> to make changes.</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><p className="text-xs text-muted-foreground mb-0.5">Measurement ID</p><p className="font-medium font-mono">{gaMeasurementId || "—"}</p></div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingInt("ga")}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Settings
                  </Button>
                </div>
              </CardContent>
            )}
            {gaEnabled && (!gaInt || editingInt === "ga") && (
              <CardContent className="space-y-4">
                <Field label="Measurement ID">
                  <Input
                    value={gaMeasurementId}
                    onChange={e => setGaMeasurementId(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                </Field>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">How to get your Measurement ID:</p>
                  <p>Go to <strong>analytics.google.com</strong> → Admin → Data Streams → your stream → copy the Measurement ID (starts with G-).</p>
                </div>
                <Button onClick={() => { saveIntegration("google_analytics", gaEnabled, { measurementId: gaMeasurementId }, "int-google-analytics"); setEditingInt(null); }}>
                  Save Analytics Settings
                </Button>
              </CardContent>
            )}
            {!gaEnabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Toggle the switch above to configure Google Analytics.</p>
              </CardContent>
            )}
          </Card>

          {/* Google Search Console */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#4285F4" strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Google Search Console
                </CardTitle>
                <div className="flex items-center gap-2">
                  {scEnabled && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>}
                  <Switch checked={scEnabled} onCheckedChange={setScEnabled} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Verify site ownership so Google shows your pages in Search Console.</p>
            </CardHeader>
            {scEnabled && scInt && editingInt !== "sc" && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Search Console active — settings are read-only. Click <strong>Edit</strong> to make changes.</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Verification Token</p><p className="font-medium font-mono break-all">{scVerificationTag || "—"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Sitemap URL</p><p className="font-medium font-mono text-xs">https://geem.pk/api/sitemap.xml</p></div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingInt("sc")}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Settings
                  </Button>
                </div>
              </CardContent>
            )}
            {scEnabled && (!scInt || editingInt === "sc") && (
              <CardContent className="space-y-4">
                <Field label="Verification Token">
                  <Input
                    value={scVerificationTag}
                    onChange={e => setScVerificationTag(e.target.value)}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </Field>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">How to verify ownership:</p>
                  <p>Go to <strong>search.google.com/search-console</strong> → Add property → enter <strong>geem.pk</strong> → choose "HTML tag" method → copy only the <strong>content</strong> value from the meta tag (not the full tag).</p>
                </div>
                <div className="bg-slate-50 border rounded p-3 text-xs text-slate-600">
                  <p className="font-medium mb-1">Sitemap URL (submit to Search Console):</p>
                  <code className="font-mono select-all">https://geem.pk/api/sitemap.xml</code>
                </div>
                <Button onClick={() => { saveIntegration("google_search_console", scEnabled, { verificationTag: scVerificationTag }, "int-google-sc"); setEditingInt(null); }}>
                  Save Search Console Settings
                </Button>
              </CardContent>
            )}
            {!scEnabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Toggle the switch above to configure Google Search Console.</p>
              </CardContent>
            )}
          </Card>

          {/* Google reCAPTCHA */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#4285F4"/></svg>
                  Google reCAPTCHA v3
                </CardTitle>
                <div className="flex items-center gap-2">
                  {rcEnabled && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>}
                  <Switch checked={rcEnabled} onCheckedChange={setRcEnabled} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Protects sign-up, login, and checkout from bots. Invisible to real customers.</p>
            </CardHeader>
            {rcEnabled && rcInt && editingInt !== "rc" && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>reCAPTCHA active — settings are read-only. Click <strong>Edit</strong> to make changes.</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><p className="text-xs text-muted-foreground mb-0.5">Site Key (public)</p><p className="font-medium font-mono">{rcSiteKey || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-0.5">Secret Key (private)</p><p className="font-medium tracking-widest text-muted-foreground">••••••••</p></div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingInt("rc")}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Settings
                  </Button>
                </div>
              </CardContent>
            )}
            {rcEnabled && (!rcInt || editingInt === "rc") && (
              <CardContent className="space-y-4">
                <Field label="Site Key (public — goes in the frontend)">
                  <Input value={rcSiteKey} onChange={e => setRcSiteKey(e.target.value)} placeholder="6Lc..." />
                </Field>
                <Field label="Secret Key (private — stays on the server)">
                  <Input value={rcSecretKey} onChange={e => setRcSecretKey(e.target.value)} placeholder="6Lc..." type="password" />
                </Field>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">How to get your keys:</p>
                  <p>Go to <strong>google.com/recaptcha/admin</strong> → Create → choose <strong>reCAPTCHA v3</strong> → add domains <code>geem.pk</code> and <code>erp.geem.pk</code> → copy both keys here.</p>
                  <p className="mt-1 text-amber-700">⚠️ After saving, you must <strong>rebuild and redeploy</strong> the shop and admin frontends for the Site Key change to take effect.</p>
                </div>
                <Button onClick={() => { saveIntegration("recaptcha", rcEnabled, { siteKey: rcSiteKey, secretKey: rcSecretKey }, "int-recaptcha"); setEditingInt(null); }}>
                  Save reCAPTCHA Settings
                </Button>
              </CardContent>
            )}
            {!rcEnabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Toggle the switch above to configure Google reCAPTCHA.</p>
              </CardContent>
            )}
          </Card>

          {/* SEO Tips */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-slate-500" />SEO Best Practices</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✅ Each product has a unique <strong>Meta Title</strong> and <strong>Meta Description</strong> (edit in E-Commerce Catalog)</li>
                <li>✅ Sitemap auto-generated at <code className="text-xs bg-slate-100 px-1 rounded">/api/sitemap.xml</code> — submit this URL to Google Search Console</li>
                <li>✅ robots.txt configured to allow shop pages and block admin routes</li>
                <li>✅ JSON-LD structured data (Product schema) on every product page</li>
                <li>✅ Open Graph tags for social sharing on all shop pages</li>
                <li>⭐ Use <strong>Product names</strong> like "Samsung Galaxy S24 Ultra 12/256 — Geem.pk" for best ranking</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── USERS ────────────────────────────────────────────────────────── */}
      {tab === "users" && (
        <div className="space-y-6">

          {/* My Profile ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">My Profile</CardTitle>
                  <p className="text-xs text-muted-foreground">Your login account details</p>
                </div>
              </div>
              {!editingProfile && (
                <Button size="sm" variant="outline" onClick={() => {
                  setProfileForm({ name: me?.name ?? "", username: me?.username ?? "", email: me?.email ?? "", mobile: me?.mobile ?? "" });
                  setEditingProfile(true);
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingProfile ? (
                <div className="space-y-3 max-w-md">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Full Name"><Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} /></Field>
                    <Field label="Username"><Input value={profileForm.username} onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} placeholder="Optional" /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email"><Input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} /></Field>
                    <Field label="Mobile"><Input value={profileForm.mobile} onChange={e => setProfileForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+92 3xx-xxxxxxx" /></Field>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => updateMe.mutate(profileForm)} disabled={updateMe.isPending || !profileForm.name || !profileForm.email}>
                      {updateMe.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Profile
                    </Button>
                    <Button variant="outline" onClick={() => setEditingProfile(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon: User,      label: "Full Name", value: me?.name },
                    { icon: AtSign,    label: "Username",  value: me?.username ?? "—" },
                    { icon: Mail,      label: "Email",     value: me?.email },
                    { icon: Phone,     label: "Mobile",    value: me?.mobile ?? "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Role</p>
                      <Badge variant={me?.role === "admin" ? "default" : "secondary"} className="mt-0.5">{me?.role ?? "—"}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Users ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>System Users</CardTitle>
              </div>
              <Button size="sm" onClick={() => { setUserForm(emptyUser); setShowUserForm(true); }}>
                <Plus className="h-4 w-4 mr-2" />Add User
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {users?.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-6 py-4 hover:bg-muted/30 transition-colors">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-0.5">
                      <div>
                        <p className="font-semibold text-sm truncate">{u.name}</p>
                        {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p className="truncate flex items-center gap-1"><Mail className="h-3 w-3 flex-shrink-0" />{u.email}</p>
                        {u.mobile && <p className="flex items-center gap-1"><Phone className="h-3 w-3 flex-shrink-0" />{u.mobile}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">{u.role}</Badge>
                        {u.role !== "admin" && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 border-dashed text-muted-foreground">
                            {u.permissions ? "Custom perms" : "No perms"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {u.lastLogin ? `Last login: ${new Date(u.lastLogin).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}` : "Never logged in"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch checked={u.active} onCheckedChange={v => toggleUser.mutate({ id: u.id, active: v })} />
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit user"
                        onClick={() => {
                          setEditTarget(u);
                          setEditForm({ name: u.name, username: u.username ?? "", email: u.email, mobile: u.mobile ?? "", role: u.role });
                          setShowEditDialog(true);
                        }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {u.role !== "admin" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Set permissions"
                          onClick={() => {
                            setPermTarget(u);
                            setPermForm({ ...defaultPermissions(), ...(u.permissions ?? {}) });
                            setShowPermDialog(true);
                          }}>
                          <UserCog className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Reset password"
                        onClick={() => { setResetTarget({ id: u.id, name: u.name }); setResetPwd(""); setShowResetDialog(true); }}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      {me?.id !== u.id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete user"
                          onClick={() => { setDeleteTarget(u); setShowDeleteDialog(true); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECURITY ─────────────────────────────────────────────────────── */}
      {tab === "security" && (
        <div className="space-y-6 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Change Your Password</CardTitle>
              <p className="text-sm text-muted-foreground">Update your admin account password. Minimum 8 characters.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={changePwdForm.currentPassword}
                    onChange={e => setChangePwdForm(f => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowCurrent(v => !v)}>
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={changePwdForm.newPassword}
                    onChange={e => setChangePwdForm(f => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowNew(v => !v)}>
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={changePwdForm.confirmPassword}
                  onChange={e => setChangePwdForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Re-enter new password"
                />
                {changePwdForm.confirmPassword && changePwdForm.newPassword !== changePwdForm.confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
              <Button
                onClick={() => changePwdMut.mutate({ currentPassword: changePwdForm.currentPassword, newPassword: changePwdForm.newPassword })}
                disabled={
                  changePwdMut.isPending ||
                  !changePwdForm.currentPassword ||
                  !changePwdForm.newPassword ||
                  changePwdForm.newPassword !== changePwdForm.confirmPassword ||
                  changePwdForm.newPassword.length < 8
                }
              >
                {changePwdMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Change Password"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">Security Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>🔒 All admin sessions use 30-day tokens stored in your browser</li>
                <li>🔒 Passwords are hashed with scrypt — never stored in plain text</li>
                <li>🔒 Rate limiting: max 20 login attempts per 15 minutes per IP</li>
                <li>🔒 All API routes (except public shop) require authentication</li>
                <li>⚠️ To reset a forgotten admin password, go to <strong>Users</strong> tab and use the Reset button</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── RESET PASSWORD DIALOG ─────────────────────────────────────────── */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Set a new password for this user. They will need to use this password to log in.</p>
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input
                type="password"
                value={resetPwd}
                onChange={e => setResetPwd(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
            <Button
              onClick={() => resetTarget && resetPwdMut.mutate({ id: resetTarget.id, newPassword: resetPwd })}
              disabled={resetPwdMut.isPending || resetPwd.length < 8}
            >
              {resetPwdMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserForm} onOpenChange={(open) => { if (!open) { setShowUserForm(false); setUserFormStep("form"); setUserFormOtp(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User {userFormStep !== "form" ? " - " + (userFormStep === "channel" ? "Select Channel" : "Verify OTP") : ""}</DialogTitle></DialogHeader>

          {/* Step 1: Form */}
          {userFormStep === "form" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name"><Input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} /></Field>
                <Field label="Username (optional)"><Input value={(userForm as Record<string,string>).username ?? ""} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} placeholder="@username" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} /></Field>
                <Field label="Mobile (optional)"><Input value={(userForm as Record<string,string>).mobile ?? ""} onChange={e => setUserForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+92 3xx-xxxxxxx" /></Field>
              </div>
              <Field label="Password"><Input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} /></Field>
              <Field label="Role">
                <Select value={userForm.role} onValueChange={v => setUserForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — Full access</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUserForm(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim()) { toast({ title: "Name, email, and password are required", variant: "destructive" }); return; }
                  setUserFormStep("channel");
                }}>Continue</Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Channel Selection */}
          {userFormStep === "channel" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Send verification code to <strong>{userForm.email}</strong> via:</p>
              <div className="grid gap-3">
                <Button variant="outline" onClick={() => { setUserLastChannel("email"); initiateUser.mutate({ ...userForm, channel: "email" }); }} disabled={initiateUser.isPending} className="justify-start gap-3 h-auto py-3">
                  <Mail className="h-5 w-5 text-blue-600" /> Email
                </Button>
                <Button variant="outline" onClick={() => { setUserLastChannel("sms"); initiateUser.mutate({ ...userForm, channel: "sms" }); }} disabled={initiateUser.isPending || !userForm.mobile} className="justify-start gap-3 h-auto py-3">
                  <Smartphone className="h-5 w-5 text-green-600" /> SMS {(!userForm.mobile) && <span className="text-xs text-muted-foreground ml-auto">(requires mobile)</span>}
                </Button>
                <Button variant="outline" onClick={() => { setUserLastChannel("whatsapp"); initiateUser.mutate({ ...userForm, channel: "whatsapp" }); }} disabled={initiateUser.isPending || !userForm.mobile} className="justify-start gap-3 h-auto py-3">
                  <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp {(!userForm.mobile) && <span className="text-xs text-muted-foreground ml-auto">(requires mobile)</span>}
                </Button>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setUserFormStep("form")}>Back</Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: OTP */}
          {userFormStep === "otp" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the 6-digit verification code sent to <strong>{userForm.email}</strong>:</p>
              <Input type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={userFormOtp}
                onChange={e => setUserFormOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.5em] font-mono" />
              <div className="flex items-center justify-between text-sm">
                {userSecondsLeft > 0 ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Resend in {userSecondsLeft}s
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Code expired. Resend to get a new one.</span>
                )}
              </div>
              <Button variant="outline" className="w-full" disabled={initiateUser.isPending || !userCanResend}
                onClick={() => initiateUser.mutate({ ...userForm, channel: userLastChannel })}>
                {userCanResend ? `Resend Code via ${userLastChannel.charAt(0).toUpperCase() + userLastChannel.slice(1)}` : `Wait ${userSecondsLeft}s`}
              </Button>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setUserFormStep("channel")}>Back</Button>
                <Button onClick={() => verifyUser.mutate({ email: userForm.email, code: userFormOtp })} disabled={verifyUser.isPending || userFormOtp.length !== 6}>
                  {verifyUser.isPending ? "Verifying…" : "Verify & Create"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT USER ─────────────────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User — {editTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name"><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Username"><Input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} placeholder="@username (optional)" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></Field>
              <Field label="Mobile"><Input value={editForm.mobile} onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+92 3xx-xxxxxxx" /></Field>
            </div>
            <Field label="Role">
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              onClick={() => editTarget && updateUser.mutate({ id: editTarget.id, ...editForm })}
              disabled={updateUser.isPending || !editForm.name || !editForm.email}
            >
              {updateUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE USER ───────────────────────────────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive"
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PERMISSIONS ───────────────────────────────────────────────────── */}
      <Dialog open={showPermDialog} onOpenChange={setShowPermDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />Permissions — {permTarget?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Check what this user can do in each module. Admin users always have full access.
            </p>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_repeat(4,_52px)] gap-2 px-3 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module</span>
              {(["view", "add", "edit", "delete"] as const).map(a => (
                <span key={a} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">{a}</span>
              ))}
            </div>

            {/* Quick-set all buttons */}
            <div className="flex items-center gap-2 px-3 pb-2">
              <span className="text-xs text-muted-foreground mr-1">Quick set:</span>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 py-0"
                onClick={() => setPermForm(Object.fromEntries(PERM_MODULES.map(m => [m.key, { view: true, add: true, edit: true, delete: true }])))}>
                All On
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 py-0"
                onClick={() => setPermForm(defaultPermissions())}>
                All Off
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 py-0"
                onClick={() => setPermForm(Object.fromEntries(PERM_MODULES.map(m => [m.key, { view: true, add: false, edit: false, delete: false }])))}>
                View Only
              </Button>
            </div>

            <Separator />

            {/* Module rows */}
            {PERM_MODULES.map(mod => {
              const p = permForm[mod.key] ?? { view: false, add: false, edit: false, delete: false };
              return (
                <div key={mod.key} className="grid grid-cols-[1fr_repeat(4,_52px)] gap-2 items-center px-3 py-1.5 rounded-lg hover:bg-muted/40">
                  <span className="text-sm font-medium">{mod.label}</span>
                  {(["view", "add", "edit", "delete"] as const).map(action => (
                    <div key={action} className="flex justify-center">
                      <Checkbox
                        checked={p[action]}
                        onCheckedChange={v => setPermForm(f => ({
                          ...f,
                          [mod.key]: { ...f[mod.key], [action]: !!v },
                        }))}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermDialog(false)}>Cancel</Button>
            <Button
              onClick={() => permTarget && updatePerms.mutate({ id: permTarget.id, permissions: permForm })}
              disabled={updatePerms.isPending}
            >
              {updatePerms.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
