"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  hasApi: boolean;
  onClose: () => void;
  onConnect: (token: string) => Promise<void>;
}

export function ConnectDialog({ open, hasApi, onClose, onConnect }: Props) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConnect(token.trim());
      setToken("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-deep p-6"
      >
        <div className="flex items-start justify-between">
          <h2 id="connect-title" className="text-xl font-semibold text-ink">
            Conectar sua API
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-mist hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        {hasApi ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-mist">
              Cole o ADMIN_TOKEN do backend. Ele fica salvo só neste navegador e libera suas vagas reais.
            </p>
            <label htmlFor="token" className="mt-5 block text-sm font-medium text-ink">
              Token de acesso
            </label>
            <input
              ref={inputRef}
              id="token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-abyss px-3.5 py-2.5 text-sm text-ink focus:border-azraq focus:outline-none"
            />
            {error && (
              <p role="alert" className="mt-3 text-sm text-warn">
                {error}
              </p>
            )}
            <button
              disabled={!token.trim() || busy}
              className="mt-5 w-full rounded-xl bg-insignia px-4 py-2.5 text-sm font-semibold text-white hover:bg-azraq disabled:opacity-50"
            >
              {busy ? "Conectando…" : "Conectar"}
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-mist">
            Este build não tem uma API configurada. Defina <code className="text-ink">NEXT_PUBLIC_API_URL</code> no
            frontend e publique de novo para usar suas vagas reais.
          </p>
        )}
      </form>
    </div>
  );
}
