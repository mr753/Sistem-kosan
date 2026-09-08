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
}

interface ActionButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  label: string;
  run: () => Promise<ActionResultMsg>;
}

export function ActionButton({ label, run, ...buttonProps }: ActionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{ text: string; isError: boolean } | null>(null);

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await run();
      if (!res.ok) {
        setMsg({ text: res.error ?? "Gagal. Coba lagi.", isError: true });
        return;
      }
      if (res.message) setMsg({ text: res.message, isError: false });
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" disabled={pending || buttonProps.disabled} onClick={handleClick} {...buttonProps}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {msg && (
        <span className={msg.isError ? "text-xs text-red-600" : "text-xs text-emerald-600"}>{msg.text}</span>
      )}
    </span>
  );
}
