"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-graphite)] transition hover:border-[var(--casabella-coral)] hover:text-[var(--casabella-coral-dark)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--casabella-coral)] disabled:cursor-not-allowed disabled:opacity-60"
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
    >
      {isSubmitting ? "Saindo..." : "Sair"}
    </button>
  );
}
