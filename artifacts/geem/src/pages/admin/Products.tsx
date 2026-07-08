import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ImageUpload";
import { Plus, Package, Trash2, Pencil, Sparkles, X, GripVertical, Images } from "lucide-react";

interface Product {
  id: number; title: string; slug: string; brandId: number | null; categoryId: number | null;
  brandName: string | null; categoryName: string | null; price: number; salePrice: number | null;
  shortDescription: string | null; longDescription: string | null; featuredImage: string | null;
  galleryImages: string | null; tags: string | null; stockQty: number | null;
  published: boolean; featured: boolean; hidePrice: boolean; stockCount: number; createdAt: string;
  metaTitle: string | null; metaDescription: string | null; metaKeywords: string | null;
}
interface Brand { id: number; name: string; }
interface Category { id: number; name: string; }

const emptyForm = {
  title: "", slug: "", brandId: "", categoryId: "", price: "", salePrice: "",
  shortDescription: "", longDescription: "", featuredImage: "",
  galleryImages: [] as string[],
  tags: "", stockQty: "", published: false, featured: false, hidePrice: false,
  metaTitle: "", metaDescription: "", metaKeywords: "",
};

export default function Products() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [galleryTab, setGalleryTab] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["products", search],
    queryFn: () => axiosInstance.get<{ products: Product[]; total: number }>(`/products?search=${search}`).then(r => r.data),
  });

  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => axiosInstance.get<Brand[]>("/brands").then(r => r.data) });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => axiosInstance.get<Category[]>("/categories").then(r => r.data) });

  const saveMutation = useMutation({
    mutationFn: (payload: object) =>
      editProduct
        ? axiosInstance.patch(`/products/${editProduct.id}`, payload).then(r => r.data)
        : axiosInstance.post("/products", payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setShowForm(false); setEditProduct(null); setForm(emptyForm);
      toast({ title: editProduct ? "Product updated" : "Product created" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) => axiosInstance.patch(`/products/${id}`, { published }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const toggleHidePrice = useMutation({
    mutationFn: ({ id, hidePrice }: { id: number; hidePrice: boolean }) => axiosInstance.patch(`/products/${id}`, { hidePrice }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast({ title: "Product deleted" }); setDeleteConfirm(null); },
  });

  function openNew() { setEditProduct(null); setForm(emptyForm); setGalleryTab(false); setShowForm(true); }

  function openEdit(p: Product) {
    setEditProduct(p);
    let gallery: string[] = [];
    try { gallery = p.galleryImages ? JSON.parse(p.galleryImages) : []; } catch { gallery = []; }
    setForm({
      title: p.title, slug: p.slug, brandId: p.brandId ? String(p.brandId) : "",
      categoryId: p.categoryId ? String(p.categoryId) : "", price: String(p.price),
      salePrice: p.salePrice ? String(p.salePrice) : "", shortDescription: p.shortDescription ?? "",
      longDescription: p.longDescription ?? "", featuredImage: p.featuredImage ?? "",
      galleryImages: gallery,
      tags: p.tags ?? "", stockQty: p.stockQty ? String(p.stockQty) : "",
      published: p.published, featured: p.featured, hidePrice: p.hidePrice,
      metaTitle: p.metaTitle ?? "", metaDescription: p.metaDescription ?? "", metaKeywords: p.metaKeywords ?? "",
    });
    setGalleryTab(false);
    setShowForm(true);
  }

  async function handleAiFill() {
    if (!form.title) { toast({ title: "Enter a product title first", variant: "destructive" }); return; }
    setAiLoading(true);
    try {
      const data = await axiosInstance.post<{
        title: string; slug: string; shortDescription: string; longDescription: string;
        tags: string; metaTitle: string; metaDescription: string;
      }>("/products/ai-fill", {
        title: form.title,
        brandId: form.brandId ? parseInt(form.brandId) : undefined,
        categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
        price: form.price || undefined,
      }).then(r => r.data);
      setForm(f => ({
        ...f,
        title: data.title || f.title,
        slug: data.slug || f.slug,
        shortDescription: data.shortDescription || f.shortDescription,
        longDescription: data.longDescription || f.longDescription,
        tags: data.tags || f.tags,
      }));
      toast({ title: "AI filled product details ✨" });
    } catch {
      toast({ title: "AI fill failed", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function handleSubmit() {
    if (!form.title || !form.price) { toast({ title: "Title and price required", variant: "destructive" }); return; }
    saveMutation.mutate({
      title: form.title,
      slug: form.slug || form.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      brandId: form.brandId ? parseInt(form.brandId) : undefined,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      price: parseFloat(form.price),
      salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
      shortDescription: form.shortDescription || undefined,
      longDescription: form.longDescription || undefined,
      featuredImage: form.featuredImage || undefined,
      galleryImages: form.galleryImages.length ? JSON.stringify(form.galleryImages) : undefined,
      tags: form.tags || undefined,
      stockQty: form.stockQty ? parseInt(form.stockQty) : undefined,
      published: form.published,
      featured: form.featured,
      hidePrice: form.hidePrice,
      metaTitle: form.metaTitle || undefined,
      metaDescription: form.metaDescription || undefined,
      metaKeywords: form.metaKeywords || undefined,
    });
  }

  function addGalleryImage(url: string) {
    setForm(f => ({ ...f, galleryImages: [...f.galleryImages, url] }));
  }

  function removeGalleryImage(idx: number) {
    setForm(f => ({ ...f, galleryImages: f.galleryImages.filter((_, i) => i !== idx) }));
  }

  const galleryImages = form.galleryImages;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">E-Commerce Catalog</h1>
          <p className="text-muted-foreground">{data?.total ?? 0} products</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm mb-4" />
          {isLoading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand / Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.featuredImage
                          ? <img src={p.featuredImage} alt="" className="h-10 w-10 object-cover rounded border" />
                          : <div className="h-10 w-10 bg-muted rounded flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{p.slug}</p>
                          {(() => { try { const g = JSON.parse(p.galleryImages ?? "[]"); return g.length > 0 ? <p className="text-xs text-blue-500">+{g.length} photos</p> : null; } catch { return null; } })()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {p.brandName && <p>{p.brandName}</p>}
                        {p.categoryName && <p className="text-muted-foreground text-xs">{p.categoryName}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.hidePrice ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Get Price</span>
                      ) : (
                        <>
                          <div className="font-bold">Rs {p.price.toLocaleString()}</div>
                          {p.salePrice && <div className="text-xs text-green-600">Sale: Rs {p.salePrice.toLocaleString()}</div>}
                        </>
                      )}
                    </TableCell>
                    <TableCell>{p.stockQty ?? p.stockCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Switch checked={p.published} onCheckedChange={(checked) => togglePublish.mutate({ id: p.id, published: checked })} />
                          <span className="text-xs text-muted-foreground">Live</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch checked={p.hidePrice} onCheckedChange={(checked) => toggleHidePrice.mutate({ id: p.id, hidePrice: checked })} />
                          <span className="text-xs text-muted-foreground">Hide Price</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                        {deleteConfirm === p.id ? (
                          <div className="flex gap-1">
                            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending}>Confirm</Button>
                            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(p.id)}><Trash2 className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.products.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditProduct(null); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{editProduct ? "Edit Product" : "New Product"}</DialogTitle>
              <Button variant="outline" size="sm" onClick={handleAiFill} disabled={aiLoading} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                {aiLoading ? "Generating..." : "AI Auto-Fill"}
              </Button>
            </div>
          </DialogHeader>

          {/* Tab switcher: Main Image vs Gallery */}
          <div className="flex border rounded-lg overflow-hidden mb-1">
            <button
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${!galleryTab ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setGalleryTab(false)}
            >
              <Package className="h-4 w-4" /> Main Image
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${galleryTab ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setGalleryTab(true)}
            >
              <Images className="h-4 w-4" /> Gallery ({galleryImages.length})
            </button>
          </div>

          {!galleryTab ? (
            <div>
              <Label className="mb-2 block">Main / Featured Image</Label>
              <ImageUpload
                value={form.featuredImage}
                onChange={(url) => setForm(f => ({ ...f, featuredImage: url }))}
                onClear={() => setForm(f => ({ ...f, featuredImage: "" }))}
                label="Upload Main Product Photo"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Gallery / Additional Images</Label>
                <span className="text-xs text-muted-foreground">{galleryImages.length} photos</span>
              </div>
              {/* Existing gallery images */}
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {galleryImages.map((url, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" variant="destructive" onClick={() => removeGalleryImage(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1 rounded">{idx + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Upload new gallery image */}
              <ImageUpload
                value={null}
                onChange={addGalleryImage}
                label="Add Gallery Photo"
              />
              <p className="text-xs text-muted-foreground mt-1">Upload multiple photos — first is shown in grid, all shown in product detail slider</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Samsung Galaxy S24 Ultra 12GB/256GB" />
              </div>
              <div>
                <Label>URL Slug</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto-from-title" />
              </div>
              <div>
                <Label>Price (PKR) *</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>Sale Price (PKR)</Label>
                <Input type="number" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} placeholder="Optional discount price" />
              </div>
              <div>
                <Label>Stock Quantity</Label>
                <Input type="number" value={form.stockQty} onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))} placeholder="Auto-tracked from inventory" />
              </div>
              <div>
                <Label>Brand</Label>
                <SearchableSelect
                  value={form.brandId}
                  onValueChange={v => setForm(f => ({ ...f, brandId: v }))}
                  options={brands?.map(b => ({ value: String(b.id), label: b.name })) ?? []}
                  placeholder="Select brand"
                  searchPlaceholder="Search brand…"
                />
              </div>
              <div>
                <Label>Category</Label>
                <SearchableSelect
                  value={form.categoryId}
                  onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}
                  options={categories?.map(c => ({ value: String(c.id), label: c.name })) ?? []}
                  placeholder="Select category"
                  searchPlaceholder="Search category…"
                />
              </div>
              <div className="col-span-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="pta approved, 5g, flagship" />
              </div>
              <div className="col-span-2">
                <Label>Short Description</Label>
                <Input value={form.shortDescription} onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))} placeholder="Brief one-liner for shop listings" />
              </div>
              <div className="col-span-2">
                <Label>Long Description</Label>
                <Textarea value={form.longDescription} onChange={e => setForm(f => ({ ...f, longDescription: e.target.value }))} rows={5} placeholder="Full product description..." />
              </div>

              {/* ── SEO Section ────────────────────────────────────── */}
              <div className="col-span-2">
                <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    🔍 SEO &amp; Google Search
                    <span className="text-xs font-normal text-muted-foreground ml-1">Helps your product rank on Google</span>
                  </p>
                  <div>
                    <Label className="text-xs">Meta Title <span className="text-muted-foreground">(shown in Google results, max 60 chars)</span></Label>
                    <Input
                      value={form.metaTitle}
                      onChange={e => setForm(f => ({ ...f, metaTitle: e.target.value }))}
                      placeholder={`${form.title || "Product name"} Price in Pakistan — Geem.pk`}
                      maxLength={90}
                    />
                    {form.metaTitle && <p className="text-xs text-muted-foreground mt-0.5">{form.metaTitle.length}/60 chars</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Meta Description <span className="text-muted-foreground">(shown under title in Google, max 160 chars)</span></Label>
                    <Textarea
                      value={form.metaDescription}
                      onChange={e => setForm(f => ({ ...f, metaDescription: e.target.value }))}
                      rows={2}
                      placeholder="Buy [product] in Pakistan. PTA approved, best price. Nationwide delivery. Geem.pk"
                      maxLength={200}
                    />
                    {form.metaDescription && <p className="text-xs text-muted-foreground mt-0.5">{form.metaDescription.length}/160 chars</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Keywords <span className="text-muted-foreground">(comma-separated, e.g. buy iphone pakistan, pta approved)</span></Label>
                    <Input
                      value={form.metaKeywords}
                      onChange={e => setForm(f => ({ ...f, metaKeywords: e.target.value }))}
                      placeholder="samsung s24, pta approved, buy samsung pakistan"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.published} onCheckedChange={v => setForm(f => ({ ...f, published: v }))} />
                <Label>Published on shop</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.featured} onCheckedChange={v => setForm(f => ({ ...f, featured: v }))} />
                <Label>Featured product</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.hidePrice} onCheckedChange={v => setForm(f => ({ ...f, hidePrice: v }))} />
                <Label>Hide price — show "Get Price" button on shop</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Product"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
