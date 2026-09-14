"use client";

import * as React from "react";
import { Image as ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadPropertyImage } from "@/lib/property-upload";
import type { Property, PropertyWithStats } from "@/lib/types";
import type { PropertyInput } from "@/lib/actions/properties";

interface PropertyFormProps {
  initialData?: Property | PropertyWithStats | null;
  onSubmit: (data: PropertyInput) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

export function PropertyForm({ initialData, onSubmit, onCancel }: PropertyFormProps) {
  const [name, setName] = React.useState(initialData?.name || "");
  const [address, setAddress] = React.useState(initialData?.address || "");
  const [city, setCity] = React.useState(initialData?.city || "");
  const [description, setDescription] = React.useState(initialData?.description || "");
  const [imageUrl, setImageUrl] = React.useState<string | null>(initialData?.image_url || null);
  const [isActive, setIsActive] = React.useState(initialData?.is_active ?? true);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(initialData?.image_url || null);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, atau WebP).");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError("Ukuran foto maksimal 3 MB.");
      return;
    }

    setError(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }

  function handleRemoveImage() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Nama properti wajib diisi (minimal 2 karakter).");
      return;
    }

    setSubmitting(true);

    let finalImageUrl = imageUrl;

    // Jika ada file gambar baru yang dipilih, unggah terlebih dahulu
    if (selectedFile) {
      setUploadingImage(true);
      const uploadRes = await uploadPropertyImage(selectedFile);
      setUploadingImage(false);

      if (!uploadRes.url) {
        setError(uploadRes.error || "Gagal mengunggah foto properti.");
        setSubmitting(false);
        return;
      }
      finalImageUrl = uploadRes.url;
    }

    const payload: PropertyInput = {
      name: trimmedName,
      address: address.trim() || null,
      city: city.trim() || null,
      description: description.trim() || null,
      image_url: finalImageUrl,
      is_active: isActive
    };

    const res = await onSubmit(payload);
    setSubmitting(false);

    if (!res.ok && res.error) {
      setError(res.error);
    }
  }

  const isBusy = submitting || uploadingImage;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* Foto Properti */}
      <div className="space-y-2">
        <Label>Foto Gedung / Properti</Label>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview properti"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="size-8 stroke-1" />
                <span className="text-[10px] mt-1">Tanpa Foto</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2 w-full">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id="property-image-input"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
              >
                <UploadCloud className="mr-1.5 size-4" />
                {previewUrl ? "Ganti Foto" : "Unggah Foto"}
              </Button>
              {previewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveImage}
                  disabled={isBusy}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-1.5 size-4" />
                  Hapus Foto
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Format JPG, PNG, atau WebP. Ukuran maks 3 MB. Disimpan di bucket <code>property-images</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Nama Properti */}
      <div className="space-y-1.5">
        <Label htmlFor="prop-name">
          Nama Properti <span className="text-red-500">*</span>
        </Label>
        <Input
          id="prop-name"
          placeholder="contoh: Kos Melati Indah, Kost Putri Harmoni"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isBusy}
          required
        />
      </div>

      {/* Kota & Alamat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prop-city">Kota / Wilayah</Label>
          <Input
            id="prop-city"
            placeholder="contoh: Jakarta Selatan, Bandung"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isBusy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-address">Alamat Lengkap</Label>
          <Input
            id="prop-address"
            placeholder="contoh: Jl. Raya No. 45 RT 02/03"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isBusy}
          />
        </div>
      </div>

      {/* Deskripsi */}
      <div className="space-y-1.5">
        <Label htmlFor="prop-desc">Deskripsi & Catatan</Label>
        <Textarea
          id="prop-desc"
          placeholder="Tuliskan keterangan fasilitas umum, lokasi strategis, atau aturan properti..."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isBusy}
        />
      </div>

      {/* Status Aktif */}
      <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/20">
        <input
          type="checkbox"
          id="prop-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isBusy}
          className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <Label htmlFor="prop-active" className="cursor-pointer text-sm font-normal">
          <span className="font-medium">Status Aktif</span> — Properti tampil di dashboard dan dapat menerima kamar/penyewa.
        </Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy}>
          Batal
        </Button>
        <Button type="submit" disabled={isBusy}>
          {isBusy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {uploadingImage ? "Mengunggah Foto..." : "Menyimpan..."}
            </>
          ) : initialData ? (
            "Simpan Perubahan"
          ) : (
            "Tambah Properti"
          )}
        </Button>
      </div>
    </form>
  );
}
