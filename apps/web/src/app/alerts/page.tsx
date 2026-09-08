import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ExpirationAlertsManager } from "../../components/alerts/expiration-alerts-manager";
import { AppFooter } from "../../components/layout/app-footer";
import { AppHeader } from "../../components/layout/app-header";
import { getAuthenticatedUser } from "../../lib/auth";
import { getExpirationAlerts } from "../../lib/expirations";
import { getStores } from "../../lib/stores";
import type { AuthenticatedUser } from "../../types/auth";
import type { ExpirationAlertPage } from "../../types/expiration";
import type {
  ExpirationAlertReviewFilter,
  ExpirationAlertStatusFilter,
} from "../../types/expiration";
import type { Store } from "../../types/store";

export const metadata: Metadata = {
  title: "Central de alertas",
};

interface AlertsPageProps {
  searchParams: Promise<{
    page?: string | string[];
    review?: string | string[];
    search?: string | string[];
    status?: string | string[];
    storeId?: string | string[];
  }>;
}

const alertStatuses = new Set<ExpirationAlertStatusFilter>([
  "all",
  "expired",
  "upcoming",
]);
const reviewStatuses = new Set<ExpirationAlertReviewFilter>([
  "all",
  "pending",
  "reviewed",
]);

function getSingleValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  let user: AuthenticatedUser | null = null;

  try {
    user = await getAuthenticatedUser();
  } catch {
    user = null;
  }

  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";
  const requestedFilters = await searchParams;
  const requestedStatus = getSingleValue(requestedFilters.status);
  const requestedReview = getSingleValue(requestedFilters.review);
  const requestedPage = Number.parseInt(
    getSingleValue(requestedFilters.page),
    10,
  );
  const initialFilters = {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    search: getSingleValue(requestedFilters.search).trim(),
    status: alertStatuses.has(requestedStatus as ExpirationAlertStatusFilter)
      ? (requestedStatus as ExpirationAlertStatusFilter)
      : ("all" as const),
    review: reviewStatuses.has(requestedReview as ExpirationAlertReviewFilter)
      ? (requestedReview as ExpirationAlertReviewFilter)
      : ("all" as const),
    storeId: isAdmin ? getSingleValue(requestedFilters.storeId) : "",
  };
  let alerts: ExpirationAlertPage | null = null;
  let stores: Store[] | null = [];
  let loadError = false;

  try {
    [alerts, stores] = await Promise.all([
      getExpirationAlerts(initialFilters),
      isAdmin ? getStores() : Promise.resolve([]),
    ]);
  } catch {
    loadError = true;
  }

  if (!loadError && (!alerts || (isAdmin && !stores))) redirect("/login");

  return (
    <main className="min-h-screen bg-[var(--casabella-background)]">
      <AppHeader section="Central de alertas" user={user} />

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <Link
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] shadow-sm transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--casabella-coral)]"
          href="/"
        >
          <span aria-hidden="true">←</span>
          Voltar ao painel
        </Link>

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
              Acompanhamento
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Central de alertas
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Produtos vencidos e com vencimento nos próximos 30 dias,
              organizados para acompanhamento da equipe.
            </p>
          </div>
        </section>

        <section className="mt-7">
          {loadError ? (
            <div
              className="rounded-2xl border border-red-200 bg-red-50 p-6"
              role="alert"
            >
              <h2 className="font-bold text-red-800">
                Não foi possível carregar os alertas
              </h2>
              <p className="mt-2 text-sm leading-6 text-red-700">
                Verifique se a API está disponível e tente novamente.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white"
                href="/alerts"
              >
                Tentar novamente
              </Link>
            </div>
          ) : (
            <ExpirationAlertsManager
              initialFilters={initialFilters}
              initialPage={alerts!}
              isAdmin={isAdmin}
              stores={stores ?? []}
            />
          )}
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
