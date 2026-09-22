"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Tombol yang menjalankan Server Action lalu me-refresh halaman.
 * Dipakai di halaman Tagihan & Komplain (dashboard) karena <form action>
 * hanya menerima server action bertipe Promise<void>, sedangkan action kita
 * mengembalikan ActionResult ({ ok, message?, error? }).
 */
export interface ActionResultMsg {
  ok: boolean;
  message?: string;
  error?: string;
  url?: string;
}

interface ActionButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  label: string;
  run: () => Promise<ActionResultMsg>;
  /** Pesan konfirmasi opsional utk aksi destruktif (mis. Batalkan Lunas). */
  confirm?: string;
}

export function ActionButton({ label, run, confirm, ...buttonProps }: ActionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{ text: string; isError: boolean; url?: string } | null>(null);

  function handleClick() {
    if (confirm && !window.confirm(confirm)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await run();
      if (!res.ok) {
        setMsg({ text: res.error ?? "Gagal. Coba lagi.", isError: true });
        return;
      }
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
      if (res.message) setMsg({ text: res.message, isError: false, url: res.url });
      if (!res.url) {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" disabled={pending || buttonProps.disabled} onClick={handleClick} {...buttonProps}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {msg && (
        <span className={msg.isError ? "text-xs text-red-600" : "text-xs text-emerald-600"}>
          {msg.url ? (
            <a
              href={msg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-emerald-700"
            >
              {msg.text}
            </a>
          ) : (
            msg.text
          )}
        </span>
      )}
    </span>
  );
}
