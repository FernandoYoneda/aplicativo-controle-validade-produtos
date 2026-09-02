"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type {
  ExpirationAlertItem,
  ExpirationAlertPage,
  ExpirationAlertReviewFilter,
  ExpirationAlertStatusFilter,
} from "../../types/expiration";
import type { Store } from "../../types/store";

interface ExpirationAlertsManagerProps {
  initialPage: ExpirationAlertPage;
  stores: Store[];
  isAdmin: boolean;
}

function getErrorMessage(response: ApiErrorResponse, fallback: string): string {
  if (Array.isArray(response.message)) {
    return response.message[0] ?? fallback;
  }

  return response.message ?? fallback;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDaysUntilExpiration(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return Math.round((Date.UTC(year, month - 1, day) - todayUtc) / 86_400_000);
}

function getAlertLabel(alert: ExpirationAlertItem): string {
  const days = getDaysUntilExpiration(alert.expirationDate);

  if (alert.alertType === "EXPIRED") {
    const elapsed = Math.abs(days);
    return elapsed === 1 ? "Vencido há 1 dia" : `Vencido há ${elapsed} dias`;
  }

  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page);
  }

  return [...pages].sort((first, second) => first - second);
}

export function ExpirationAlertsManager({
  initialPage,
  stores,
  isAdmin,
}: ExpirationAlertsManagerProps) {
  const router = useRouter();
  const activeRequest = useRef<AbortController | null>(null);
  const firstRender = useRef(true);
  const [alertPage, setAlertPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ExpirationAlertStatusFilter>("all");
  const [review, setReview] = useState<ExpirationAlertReviewFilter>("all");
  const [storeId, setStoreId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadAlerts = useCallback(
    async (page: number) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      const parameters = new URLSearchParams({
        page: String(page),
        pageSize: String(alertPage.pagination.pageSize),
        status,
        review,
      });

      if (search.trim()) parameters.set("search", search.trim());
      if (isAdmin && storeId) parameters.set("storeId", storeId);

      setErrorMessage("");
      setIsLoading(true);

      try {
        const response = await fetch(`/api/expiration-alerts?${parameters}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as
          ExpirationAlertPage | ApiErrorResponse;

        if (response.status === 401) {
          router.replace("/login");
          router.refresh();
          return;
        }

        if (!response.ok) {
          setErrorMessage(
            getErrorMessage(
              body as ApiErrorResponse,
              "Não foi possível listar os alertas.",
            ),
          );
          return;
        }

        setAlertPage(body as ExpirationAlertPage);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setErrorMessage("Não foi possível conectar ao serviço de alertas.");
      } finally {
        if (activeRequest.current === controller) setIsLoading(false);
      }
    },
    [
      alertPage.pagination.pageSize,
      isAdmin,
      review,
      router,
      search,
      status,
      storeId,
    ],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
      void loadAlerts(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [loadAlerts]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function acknowledge(alert: ExpirationAlertItem): Promise<void> {
    setAcknowledgingId(alert.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/expiration-alerts/${encodeURIComponent(alert.id)}/acknowledge`,
        { method: "POST" },
      );
      const body = (await response.json()) as ApiErrorResponse;

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setErrorMessage(
          getErrorMessage(body, "Não foi possível registrar a verificação."),
        );
        return;
      }

      setSuccessMessage("Alerta marcado como verificado.");
      await loadAlerts(alertPage.pagination.page);
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de alertas.");
    } finally {
      setAcknowledgingId(null);
    }
  }

  const visiblePages = useMemo(
    () =>
      getVisiblePages(
        alertPage.pagination.page,
        alertPage.pagination.totalPages,
      ),
    [alertPage.pagination.page, alertPage.pagination.totalPages],
  );

  const summaryCards = [
    {
      label: "Alertas",
      value: alertPage.summary.total,
      className: "text-[var(--casabella-teal-dark)]",
    },
    {
      label: "Vencidos",
      value: alertPage.summary.expired,
      className: "text-red-700",
    },
    {
      label: "Próximos 30 dias",
      value: alertPage.summary.upcoming,
      className: "text-amber-700",
    },
    {
      label: "Pendentes",
      value: alertPage.summary.pending,
      className: "text-[var(--casabella-coral)]",
    },
    {
      label: "Verificados",
      value: alertPage.summary.reviewed,
      className: "text-emerald-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <article
            className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm"
            key={card.label}
          >
            <p className="text-sm text-[var(--casabella-muted)]">
              {card.label}
            </p>
            <p className={`mt-2 text-3xl font-bold ${card.className}`}>
              {card.value}
            </p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--casabella-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--casabella-border)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--casabella-teal-dark)]">
                Alertas de validade
              </h2>
              <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                Verifique os lotes e registre o acompanhamento realizado.
              </p>
            </div>
            <button
              className="h-10 rounded-xl border border-[var(--casabella-border)] px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] disabled:opacity-50"
              disabled={isLoading}
              onClick={() => void loadAlerts(alertPage.pagination.page)}
              type="button"
            >
              Atualizar lista
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
            <label className="text-sm font-semibold text-[var(--casabella-graphite)]">
              Buscar alerta
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] px-4 font-normal outline-none transition focus:border-[var(--casabella-teal)] focus:ring-2 focus:ring-[var(--casabella-teal-soft)]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Produto, código, loja ou lote"
                value={search}
              />
            </label>

            <label className="text-sm font-semibold text-[var(--casabella-graphite)]">
              Situação
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3 font-normal"
                onChange={(event) =>
                  setStatus(event.target.value as ExpirationAlertStatusFilter)
                }
                value={status}
              >
                <option value="all">Todos</option>
                <option value="expired">Vencidos</option>
                <option value="upcoming">Próximos 30 dias</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-[var(--casabella-graphite)]">
              Verificação
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3 font-normal"
                onChange={(event) =>
                  setReview(event.target.value as ExpirationAlertReviewFilter)
                }
                value={review}
              >
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="reviewed">Verificados</option>
              </select>
            </label>

            {isAdmin ? (
              <label className="text-sm font-semibold text-[var(--casabella-graphite)]">
                Loja
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3 font-normal"
                  onChange={(event) => setStoreId(event.target.value)}
                  value={storeId}
                >
                  <option value="">Todas as lojas</option>
                  {stores
                    .filter((store) => store.isActive)
                    .map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.code} — {store.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <p
            className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p
            className="m-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
            role="status"
          >
            {successMessage}
          </p>
        ) : null}

        <div className={isLoading ? "opacity-55" : ""} aria-busy={isLoading}>
          {alertPage.items.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="font-bold text-[var(--casabella-teal-dark)]">
                Nenhum alerta encontrado
              </p>
              <p className="mt-2 text-sm text-[var(--casabella-muted)]">
                Altere os filtros ou aguarde novos produtos entrarem no período
                de atenção.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--casabella-border)]">
              {alertPage.items.map((alert) => {
                const product = alert.storeProduct.product;
                const store = alert.storeProduct.store;
                return (
                  <article
                    className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,2fr)_1fr_0.7fr_1.35fr] xl:items-center"
                    key={alert.id}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                        Produto
                      </p>
                      <p
                        className="mt-1 truncate font-bold text-[var(--casabella-graphite)]"
                        title={`${product.code} — ${product.name}`}
                      >
                        {product.code} — {product.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                        {store.code} — {store.name}
                        {alert.batchNumber
                          ? ` · Lote ${alert.batchNumber}`
                          : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                        Validade
                      </p>
                      <p className="mt-1 font-bold text-[var(--casabella-teal-dark)]">
                        {formatDate(alert.expirationDate)}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${alert.alertType === "EXPIRED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                      >
                        {getAlertLabel(alert)}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                        Quantidade
                      </p>
                      <p className="mt-1 text-lg font-bold text-[var(--casabella-graphite)]">
                        {alert.quantity}
                      </p>
                    </div>

                    <div className="xl:text-right">
                      {alert.acknowledgement ? (
                        <div className="inline-block rounded-xl bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-800">
                          <p className="font-bold">Verificado</p>
                          <p className="mt-1">
                            {alert.acknowledgement.user.name} ·{" "}
                            {formatDateTime(
                              alert.acknowledgement.acknowledgedAt,
                            )}
                          </p>
                        </div>
                      ) : (
                        <button
                          className="h-11 rounded-xl bg-[var(--casabella-teal)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--casabella-teal-dark)] disabled:cursor-wait disabled:opacity-60"
                          disabled={acknowledgingId === alert.id}
                          onClick={() => void acknowledge(alert)}
                          type="button"
                        >
                          {acknowledgingId === alert.id
                            ? "Registrando..."
                            : "Marcar como verificado"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--casabella-border)] px-5 py-4 text-sm text-[var(--casabella-muted)] sm:px-6">
            <p>
              {alertPage.pagination.totalItems === 0
                ? "Nenhum registro"
                : `Exibindo página ${alertPage.pagination.page} de ${alertPage.pagination.totalPages} · ${alertPage.pagination.totalItems} ${alertPage.pagination.totalItems === 1 ? "alerta" : "alertas"}`}
            </p>
            {alertPage.pagination.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  className="h-9 rounded-lg border border-[var(--casabella-border)] px-3 disabled:opacity-40"
                  disabled={isLoading || alertPage.pagination.page === 1}
                  onClick={() => void loadAlerts(alertPage.pagination.page - 1)}
                  type="button"
                >
                  Anterior
                </button>
                {visiblePages.map((page, index) => (
                  <span className="contents" key={page}>
                    {index > 0 && page - visiblePages[index - 1] > 1 ? (
                      <span>…</span>
                    ) : null}
                    <button
                      className={`size-9 rounded-lg font-semibold ${page === alertPage.pagination.page ? "bg-[var(--casabella-teal)] text-white" : "border border-[var(--casabella-border)]"}`}
                      disabled={isLoading}
                      onClick={() => void loadAlerts(page)}
                      type="button"
                    >
                      {page}
                    </button>
                  </span>
                ))}
                <button
                  className="h-9 rounded-lg border border-[var(--casabella-border)] px-3 disabled:opacity-40"
                  disabled={
                    isLoading ||
                    alertPage.pagination.page ===
                      alertPage.pagination.totalPages
                  }
                  onClick={() => void loadAlerts(alertPage.pagination.page + 1)}
                  type="button"
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
