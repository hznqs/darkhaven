"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, LockKeyhole, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? "")
      })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível entrar.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-4 py-8">
      <div className="absolute inset-0 bg-[url('/references/login-background.jfif')] bg-cover bg-center" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_28rem),linear-gradient(180deg,rgba(0,0,0,0.38),rgba(0,0,0,0.86))]" aria-hidden />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.018)_0_1px,transparent_1px_5px)] opacity-60" aria-hidden />

      <section className="relative w-full max-w-[420px] rounded-crm border border-white/12 bg-black/58 p-6 shadow-glass backdrop-blur-2xl md:p-8">
        <form className="space-y-5" aria-label="Login DarkHaven" onSubmit={handleSubmit}>
          <div className="flex flex-col items-center text-center">
            <Image src="/brand/logo-darkhaven.png" alt="DarkHaven" width={270} height={180} priority className="h-auto w-52 object-contain" />
            <p className="mt-5 text-sm font-medium uppercase tracking-[0.24em] text-ember">Acesse sua conta</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Entrar para continuar</h1>
          </div>

          <label className="block space-y-2 text-sm text-zinc-300">
            <span>E-mail</span>
            <span className="flex items-center gap-3 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-zinc-400 focus-within:border-ember/60">
              <Mail className="h-4 w-4" aria-hidden />
              <input className="w-full bg-transparent text-white outline-none" name="email" type="email" autoComplete="email" required />
            </span>
          </label>

          <label className="block space-y-2 text-sm text-zinc-300">
            <span>Senha</span>
            <span className="flex items-center gap-3 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-zinc-400 focus-within:border-ember/60">
              <LockKeyhole className="h-4 w-4" aria-hidden />
              <input className="w-full bg-transparent text-white outline-none" name="password" type="password" autoComplete="current-password" required />
              <Eye className="h-4 w-4" aria-hidden />
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-ember" />
              Lembrar de mim
            </label>
            <span>Esqueci minha senha</span>
          </div>

          {error ? <p className="rounded-crm border border-red-500/35 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

          <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-crm bg-bone px-4 py-3 text-sm font-bold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">© 2026 DarkHaven. Ambiente interno.</p>
      </section>
    </main>
  );
}
