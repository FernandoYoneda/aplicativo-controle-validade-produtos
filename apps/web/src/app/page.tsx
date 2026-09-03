import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ExpirationOverview } from "../components/dashboard/expiration-overview";
import { AppFooter } from "../components/layout/app-footer";
import { AppHeader } from "../components/layout/app-header";
import { getAuthenticatedUser } from "../lib/auth";
import { getExpirationOverview } from "../lib/expirations";
import type { AuthenticatedUser } from "../types/auth";
import type { ExpirationOverview as ExpirationOverviewData } from "../types/expiration";

export const metadata: Metadata = {
  title: "Painel do sistema",
};

const quickActions = [
  {
    eyebrow: "Cadastro",
    title: "Nova validade",
    description: "Registre rapidamente um novo lote e sua data de validade.",
    href: "/expirations?action=create",
    accentClassName: "bg-emerald-50 text-emerald-700",
  },
  {
    eyebrow: "Operação rápida",
    title: "Dar baixa",
    description: "Use o leitor de código de barras e atualize o estoque do lote.",
    href: "/expirations?action=write-off",
    accentClassName: "bg-amber-50 text-amber-800",
  },
  {
    eyebrow: "Acompanhamento",
    title: "Alertas",
    description: "Veja produtos vencidos ou próximos do vencimento.",
    href: "/alerts",
    accentClassName: "bg-red-50 text-red-700",
  },
];

export default async function Home() {
  let user: AuthenticatedUser | null = null;

  try {
    user = await getAuthenticatedUser();
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login");
  }

  let expirationOverview: ExpirationOverviewData | null = null;
  let expirationLoadError = false;

  try {
    expirationOverview = await getExpirationOverview();
  } catch {
    expirationLoadError = true;
  }

  if (!expirationLoadError && !expirationOverview) {
    redirect("/login");
  }

  const isAdmin = user.role === "ADMIN";
  return (
    <main className="min-h-screen bg-[var(--casabella-background)]">
      <AppHeader
        section={isAdmin ? "Área administrativa" : "Operação da loja"}
        user={user}
      />

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <section className="relative overflow-hidden rounded-3xl bg-[var(--casabella-teal)] px-6 py-8 text-white shadow-[0_20px_60px_rgba(0,67,77,0.13)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-20 size-64 rounded-full border-[45px] border-white/6"
          />

          <div
            aria-hidden="true"
            className="absolute -right-10 bottom-8 h-1.5 w-52 rotate-[-11deg] rounded-full bg-[var(--casabella-coral)]"
          />

          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-bold tracking-[0.18em] text-[var(--casabella-coral)] uppercase">
              Visão geral
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Olá, {user.name.split(" ")[0]}!
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Acompanhe os alertas de validade e acesse as áreas disponíveis
              para sua operação.
            </p>
          </div>
        </section>

        <ExpirationOverview
          isAdmin={isAdmin}
          loadError={expirationLoadError}
          overview={expirationOverview}
        />

        <section className="mt-8" aria-labelledby="quick-actions-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold tracking-[0.15em] text-[var(--casabella-coral)] uppercase">
                Operação
              </p>

              <h2
                className="mt-1 text-2xl font-bold text-[var(--casabella-teal-dark)]"
                id="quick-actions-title"
              >
                Ações rápidas
              </h2>
            </div>

            <p className="text-sm text-[var(--casabella-muted)]">
              As demais áreas estão disponíveis no menu.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                className="group flex min-h-40 flex-col rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--casabella-teal)] hover:shadow-[0_14px_35px_rgba(0,67,77,0.08)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--casabella-coral)] sm:p-6"
                href={action.href}
                key={action.title}
              >
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${action.accentClassName}`}
                >
                  {action.eyebrow}
                </span>

                <h3 className="mt-4 text-lg font-bold text-[var(--casabella-teal-dark)] sm:text-xl">
                  {action.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-5 text-[var(--casabella-muted)] sm:leading-6">
                  {action.description}
                </p>

                <span className="mt-4 text-sm font-semibold text-[var(--casabella-teal)] transition group-hover:text-[var(--casabella-teal-dark)]">
                  Acessar <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
