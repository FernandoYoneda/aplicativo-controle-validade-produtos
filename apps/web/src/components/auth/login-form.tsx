"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

interface LoginErrorResponse {
  message?: string;
}

export function LoginForm() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const responseBody = (await response.json()) as LoginErrorResponse;

      if (!response.ok) {
        setErrorMessage(responseBody.message ?? "Não foi possível entrar.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="flex w-full flex-col gap-5"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <label
          className="text-sm font-semibold text-[var(--casabella-graphite)]"
          htmlFor="identifier"
        >
          Usuário ou e-mail
        </label>

        <input
          className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-base text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
          id="identifier"
          name="identifier"
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Digite seu usuário ou e-mail"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <label
            className="text-sm font-semibold text-[var(--casabella-graphite)]"
            htmlFor="password"
          >
            Senha
          </label>

          <button
            className="text-sm font-semibold text-[var(--casabella-teal)] transition hover:text-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            disabled={isSubmitting}
          >
            {showPassword ? "Ocultar senha" : "Mostrar senha"}
          </button>
        </div>

        <input
          className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-base text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Digite sua senha"
          required
          disabled={isSubmitting}
        />
      </div>

      {errorMessage ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
          role="alert"
          aria-live="polite"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--casabella-teal)] px-5 text-base font-bold text-white shadow-sm transition hover:bg-[var(--casabella-teal-dark)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--casabella-coral)] disabled:cursor-not-allowed disabled:opacity-65"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
