"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportReportsToCsv } from "@/app/(dashboard)/reports/actions";
import { Download } from "lucide-react";

interface ExportButtonProps {
  mode: "month" | "year";
  month: string;
  year: string;
  propertyId: string;
}

export function ExportButton({ mode, month, year, propertyId }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const result = await exportReportsToCsv(mode, month, year, propertyId);

      const blob = new Blob([result.content], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal export: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      <Download className="mr-2 size-4" />
      {loading ? "Menyiapkan..." : "Export CSV"}
    </Button>
  );
}
