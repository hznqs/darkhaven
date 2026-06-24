"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

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
        password: String(form.get("password") ?? ""),
        remember
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
      {/* Background layers */}
      <div className="absolute inset-0 bg-[url('/references/login-background.jfif')] bg-cover bg-center" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_28rem),linear-gradient(180deg,rgba(0,0,0,0.38),rgba(0,0,0,0.86))]" aria-hidden />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.018)_0_1px,transparent_1px_5px)] opacity-60" aria-hidden />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember/8 blur-[120px]" aria-hidden />

      <section className="relative w-full max-w-[420px] rounded-crm border border-white/12 bg-black/58 p-6 shadow-glass backdrop-blur-2xl md:p-8">
        <form className="space-y-6" aria-label="Login DarkHaven" onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <Image src="/brand/logo-darkhaven.png" alt="DarkHaven" width={270} height={180} priority className="h-auto w-52 object-contain" />
            <p className="mt-5 text-sm font-medium uppercase tracking-[0.24em] text-ember">Acesse sua conta</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Entrar para continuar</h1>
          </div>

          {/* E-mail */}
          <label className="block space-y-2 text-sm text-zinc-300">
            <span className="font-medium">E-mail</span>
            <span className="flex items-center gap-3 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-zinc-400 transition focus-within:border-ember/60 focus-within:shadow-[0_0_0_3px_rgba(216,177,93,0.08)]">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <input
                className="w-full bg-transparent text-white placeholder:text-zinc-600 outline-none"
                name="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </span>
          </label>

          {/* Senha */}
          <label className="block space-y-2 text-sm text-zinc-300">
            <span className="font-medium">Senha</span>
            <span className="flex items-center gap-3 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-zinc-400 transition focus-within:border-ember/60 focus-within:shadow-[0_0_0_3px_rgba(216,177,93,0.08)]">
              <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden />
              <input
                className="w-full bg-transparent text-white placeholder:text-zinc-600 outline-none"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="shrink-0 text-zinc-500 transition hover:text-white"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {/* Lembrar + Esqueci */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
            <label className="inline-flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/[0.04] accent-ember"
              />
              <span>Lembrar de mim</span>
            </label>
            <button type="button" className="text-zinc-500 transition hover:text-ember">
              Esqueci minha senha
            </button>
          </div>

          {/* Erro */}
          {error ? (
            <p className="rounded-crm border border-red-500/35 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-crm bg-bone px-4 py-3.5 text-sm font-bold text-black transition hover:bg-white hover:shadow-[0_0_24px_rgba(216,177,93,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">© 2026 DarkHaven. Ambiente interno.</p>
      </section>
    </main>
  );
}
