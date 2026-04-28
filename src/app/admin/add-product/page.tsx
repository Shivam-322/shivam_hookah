"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getIdToken } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ImagePlus, X } from "lucide-react";

interface Variant {
  color: string;
  files: File[];
  previews: string[];
}

export default function AddProductPage() {
  useAuth(); // ensures admin layout guard is active
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [variants, setVariants] = useState<Variant[]>([
    { color: "", files: [], previews: [] }
  ]);
  const [loading, setLoading] = useState(false);

  const addVariant = () => {
    setVariants([...variants, { color: "", files: [], previews: [] }]);
  };

  const removeVariant = (index: number) => {
    const newVariants = variants.filter((_, i) => i !== index);
    setVariants(newVariants);
  };

  const updateVariantColor = (index: number, color: string) => {
    const newVariants = [...variants];
    newVariants[index].color = color;
    setVariants(newVariants);
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newVariants = [...variants];
    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    
    newVariants[index].files = [...newVariants[index].files, ...selectedFiles];
    newVariants[index].previews = [...newVariants[index].previews, ...newPreviews];
    setVariants(newVariants);
  };

  const removeFile = (variantIndex: number, fileIndex: number) => {
    const newVariants = [...variants];
    URL.revokeObjectURL(newVariants[variantIndex].previews[fileIndex]);
    newVariants[variantIndex].files.splice(fileIndex, 1);
    newVariants[variantIndex].previews.splice(fileIndex, 1);
    setVariants(newVariants);
  };

  const uploadSingleImage = async (file: File) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Not authenticated");
    const idToken = await getIdToken(currentUser);

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json();
      throw new Error(errorData.error || "Upload failed");
    }

    const data = await uploadRes.json();
    return { url: data.imageUrl as string, fileId: data.fileId as string };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (variants.some(v => v.files.length === 0)) {
      toast.error("Please upload at least one image for each color variant.");
      return;
    }
    setLoading(true);

    try {
      const uploadedVariants = [];

      for (const variant of variants) {
        const imageUrls = [];
        for (const file of variant.files) {
          const res = await uploadSingleImage(file);
          imageUrls.push(res);
        }
        uploadedVariants.push({
          color: variant.color,
          images: imageUrls
        });
      }

      await addDoc(collection(db, "products"), {
        name,
        description,
        price: parseFloat(price),
        category: category.toLowerCase(),
        stock: parseInt(stock, 10),
        imageUrl: uploadedVariants[0].images[0].url, // Set first image as main
        imageFileId: uploadedVariants[0].images[0].fileId,
        color: uploadedVariants[0].color,
        variants: uploadedVariants,
        createdAt: serverTimestamp(),
      });

      toast.success("Product added successfully!");
      
      setName(""); 
      setDescription(""); 
      setPrice(""); 
      setCategory(""); 
      setStock(""); 
      setVariants([{ color: "", files: [], previews: [] }]);

    } catch (error: any) {
      toast.error(error.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-8 tracking-widest text-primary font-serif">ADD NEW PRODUCT</h1>
      <form onSubmit={handleSubmit} className="space-y-10 max-w-4xl">
        <div className="bg-background/50 p-8 rounded-xl border border-border/50 shadow-sm space-y-8">
          <h2 className="text-xl font-bold tracking-wider text-foreground border-b border-border pb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Product Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="bg-background h-14 text-lg border-border/50 focus:border-primary/50 transition-colors" placeholder="e.g. Sultan Premium Hookah" />
            </div>
            <div className="space-y-3">
              <Label htmlFor="category" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Category</Label>
              <Input id="category" required value={category} onChange={(e) => setCategory(e.target.value)} className="bg-background h-14 text-lg border-border/50 focus:border-primary/50 transition-colors" placeholder="e.g. Classic Series" />
            </div>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Description</Label>
            <Textarea id="description" required value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background min-h-[150px] text-lg border-border/50 focus:border-primary/50 transition-colors resize-none" placeholder="Describe the craftsmanship and features..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="price" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Price (₹)</Label>
              <Input id="price" type="number" required min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-background h-14 text-lg border-border/50 focus:border-primary/50 transition-colors" />
            </div>
            <div className="space-y-3">
              <Label htmlFor="stock" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Stock Quantity</Label>
              <Input id="stock" type="number" required min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className="bg-background h-14 text-lg border-border/50 focus:border-primary/50 transition-colors" />
            </div>
          </div>
        </div>

        <div className="bg-background/50 p-8 rounded-xl border border-border/50 shadow-sm space-y-8">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <h2 className="text-xl font-bold tracking-wider text-foreground">Color Variants & Photos</h2>
            <Button type="button" variant="outline" size="sm" onClick={addVariant} className="gap-2 font-bold uppercase tracking-widest text-[10px]">
              <Plus className="h-4 w-4" /> Add Color
            </Button>
          </div>

          <div className="space-y-10">
            {variants.map((variant, vIdx) => (
              <div key={vIdx} className="relative p-6 bg-muted/30 rounded-xl border border-border/40 space-y-6">
                {variants.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => removeVariant(vIdx)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Variant Color</Label>
                    <Input
                      required
                      value={variant.color}
                      onChange={(e) => updateVariantColor(vIdx, e.target.value)}
                      placeholder="e.g. Ruby Red"
                      className="bg-background h-12"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upload Photos (Multiple)</Label>
                    <div className="flex flex-wrap gap-4">
                      {variant.previews.map((url, pIdx) => (
                        <div key={pIdx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border shadow-sm group">
                          <img src={url} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFile(vIdx, pIdx)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/40 transition-all">
                        <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Add</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(vIdx, e)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full h-16 text-xl font-bold tracking-[0.2em] uppercase shadow-[0_10px_40px_rgba(201,168,76,0.3)] hover:-translate-y-1 transition-all">
          {loading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>SAVING MASTERPIECE...</span>
            </div>
          ) : "PUBLISH PRODUCT"}
        </Button>
      </form>
    </div>
  );
}