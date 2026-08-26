"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type {
  ExpirationPage,
  ExpirationRecord,
  ExpirationStatusFilter,
} from "../../types/expiration";
import type { Store } from "../../types/store";
import { ExpirationFormModal } from "./expiration-form-modal";

interface ExpirationsManagerProps {
  initialPage: ExpirationPage;
  stores: Store[];
  isAdmin: boolean;
}

interface ExpirationStatus {
  key: Exclude<ExpirationStatusFilter, "all">;
  label: string;
  className: string;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return (
      errorResponse.message[0] ??
      "Não foi possível listar os registros de validade."
    );
  }

  return (
    errorResponse.message ?? "Não foi possível listar os registros de validade."
  );
}

function getExpirationTimestamp(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function getTodayTimestamp(): number {
  const today = new Date();

  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

function getDaysUntilExpiration(value: string): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round(
    (getExpirationTimestamp(value) - getTodayTimestamp()) / millisecondsPerDay,
  );
}

function getExpirationStatus(expiration: ExpirationRecord): ExpirationStatus {
  if (!expiration.isActive) {
    return {
      key: "inactive",
      label: "Inativo",
      className: "bg-zinc-100 text-zinc-700",
    };
  }

  const daysUntilExpiration = getDaysUntilExpiration(expiration.expirationDate);

  if (daysUntilExpiration < 0) {
    return {
      key: "expired",
      label: "Vencido",
      className: "bg-red-50 text-red-700",
    };
  }

  if (daysUntilExpiration <= 30) {
    return {
      key: "upcoming",
      label:
        daysUntilExpiration === 0
          ? "Vence hoje"
          : `Vence em ${daysUntilExpiration} dias`,
      className: "bg-amber-50 text-amber-800",
    };
  }

  if (daysUntilExpiration <= 90) {
    return {
      key: "threeMonths",
      label: "De 31 dias a 3 meses",
      className: "bg-yellow-50 text-yellow-800",
    };
  }

  if (daysUntilExpiration <= 180) {
    return {
      key: "sixMonths",
      label: "De 3 a 6 meses",
      className: "bg-lime-50 text-lime-800",
    };
  }

  if (daysUntilExpiration <= 365) {
    return {
      key: "oneYear",
      label: "De 6 meses a 1 ano",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  return {
    key: "beyondOneYear",
    label: "Acima de 1 ano",
    className: "bg-teal-50 text-teal-700",
  };
}

function formatExpirationDate(value: string): string {
  const dateValue = value.slice(0, 10);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${dateValue}T00:00:00.000Z`));
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  return [...pages].sort((firstPage, secondPage) => firstPage - secondPage);
}

export function ExpirationsManager({
  initialPage,
  stores,
  isAdmin,
}: ExpirationsManagerProps) {
  const router = useRouter();
  const activeRequest = useRef<AbortController | null>(null);
  const isFirstFilterRender = useRef(true);

  const [expirationPage, setExpirationPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ExpirationStatusFilter>("all");
  const [storeFilter, setStoreFilter] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExpiration, setSelectedExpiration] =
    useState<ExpirationRecord | null>(null);

  const loadExpirations = useCallback(
    async (
      page: number,
      searchValue: string,
      status: ExpirationStatusFilter,
      storeId: string,
    ) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;

      setErrorMessage("");
      setIsLoading(true);

      const parameters = new URLSearchParams({
        page: String(page),
        pageSize: String(expirationPage.pagination.pageSize),
        status,
      });
      const normalizedSearch = searchValue.trim();

      if (normalizedSearch) {
        parameters.set("search", normalizedSearch);
      }

      if (isAdmin && storeId) {
        parameters.set("storeId", storeId);
      }

      try {
        const response = await fetch(`/api/expirations/page?${parameters}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/login");
          router.refresh();
          return;
        }

        const responseBody = (await response.json()) as
          ExpirationPage | ApiErrorResponse;

        if (!response.ok) {
          setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
          return;
        }

        setExpirationPage(responseBody as ExpirationPage);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setErrorMessage("Não foi possível conectar ao serviço de validades.");
      } finally {
        if (activeRequest.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [expirationPage.pagination.pageSize, isAdmin, router],
  );

  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
      void loadExpirations(1, search, statusFilter, storeFilter);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [loadExpirations, search, statusFilter, storeFilter]);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  const visiblePages = useMemo(
    () =>
      getVisiblePages(
        expirationPage.pagination.page,
        expirationPage.pagination.totalPages,
      ),
    [expirationPage.pagination.page, expirationPage.pagination.totalPages],
  );
  const firstVisibleItem =
    expirationPage.pagination.totalItems === 0
      ? 0
      : (expirationPage.pagination.page - 1) *
          expirationPage.pagination.pageSize +
        1;
  const lastVisibleItem = Math.min(
    expirationPage.pagination.page * expirationPage.pagination.pageSize,
    expirationPage.pagination.totalItems,
  );
  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "all" || storeFilter !== "";

  function openCreateForm() {
    const hasActiveStores = stores.some((store) => store.isActive);

    setErrorMessage("");
    setSuccessMessage("");

    if (isAdmin && !hasActiveStores) {
      setErrorMessage("Nenhuma loja ativa está disponível para o cadastro.");
      return;
    }

    setSelectedExpiration(null);
    setIsFormOpen(true);
  }

  function openEditForm(expiration: ExpirationRecord) {
    setSelectedExpiration(expiration);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setSelectedExpiration(null);
  }

  async function handleExpirationSaved(savedExpiration: ExpirationRecord) {
    const wasEditing = selectedExpiration !== null;

    closeForm();
    await loadExpirations(
      wasEditing ? expirationPage.pagination.page : 1,
      search,
      statusFilter,
      storeFilter,
    );

    const productCode = savedExpiration.storeProduct.product.code;

    setSuccessMessage(
      wasEditing
        ? `A validade do produto ${productCode} foi atualizada com sucesso.`
        : `A validade do produto ${productCode} foi cadastrada com sucesso.`,
    );
  }

  function changePage(page: number) {
    if (
      page === expirationPage.pagination.page ||
      page < 1 ||
      page > expirationPage.pagination.totalPages
    ) {
      return;
    }

    setSuccessMessage("");
    void loadExpirations(page, search, statusFilter, storeFilter);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Total de registros
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-teal-dark)]">
              {isLoading ? "—" : expirationPage.summary.totalRecords}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Produtos vencidos
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {isLoading ? "—" : expirationPage.summary.expiredRecords}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Próximos 30 dias
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {isLoading ? "—" : expirationPage.summary.upcomingRecords}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Registros inativos
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-coral-dark)]">
              {isLoading ? "—" : expirationPage.summary.inactiveRecords}
            </p>
          </article>
        </section>

        {successMessage ? (
          <div
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800"
            role="status"
          >
            {successMessage}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[var(--casabella-border)] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--casabella-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--casabella-teal-dark)]">
                Validades cadastradas
              </h2>
              <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                Consulte e acompanhe os lotes registrados por loja.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                onClick={() =>
                  void loadExpirations(
                    expirationPage.pagination.page,
                    search,
                    statusFilter,
                    storeFilter,
                  )
                }
                type="button"
              >
                {isLoading ? "Atualizando..." : "Atualizar lista"}
              </button>

              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--casabella-teal)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--casabella-teal-dark)]"
                onClick={openCreateForm}
                type="button"
              >
                <span aria-hidden="true">+</span>
                Nova validade
              </button>
            </div>
          </div>

          <div
            className={`grid gap-4 border-b border-[var(--casabella-border)] p-5 ${
              isAdmin
                ? "lg:grid-cols-[minmax(0,1fr)_220px_240px]"
                : "lg:grid-cols-[minmax(0,1fr)_240px]"
            }`}
          >
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="expiration-search"
              >
                Buscar validade
              </label>

              <input
                className="h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
                id="expiration-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite produto, código, loja ou lote"
                type="search"
                value={search}
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="expiration-status-filter"
              >
                Situação
              </label>

              <select
                className="h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3 text-sm text-[var(--casabella-graphite)] outline-none transition focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
                id="expiration-status-filter"
                onChange={(event) =>
                  setStatusFilter(event.target.value as ExpirationStatusFilter)
                }
                value={statusFilter}
              >
                <option value="all">Todas as situações</option>
                <option value="expired">Vencidos</option>
                <option value="upcoming">Próximos 30 dias</option>
                <option value="threeMonths">De 31 dias a 3 meses</option>
                <option value="sixMonths">De 3 a 6 meses</option>
                <option value="oneYear">De 6 meses a 1 ano</option>
                <option value="beyondOneYear">Acima de 1 ano</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>

            {isAdmin ? (
              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                  htmlFor="expiration-store-filter"
                >
                  Loja
                </label>

                <select
                  className="h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3 text-sm text-[var(--casabella-graphite)] outline-none transition focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
                  id="expiration-store-filter"
                  onChange={(event) => setStoreFilter(event.target.value)}
                  value={storeFilter}
                >
                  <option value="">Todas as lojas</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.code} — {store.name}
                      {store.isActive ? "" : " (inativa)"}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <div
              className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center p-8 text-sm text-[var(--casabella-muted)]">
              Carregando validades...
            </div>
          ) : null}

          {!isLoading && !errorMessage && expirationPage.items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-[var(--casabella-graphite)]">
                Nenhuma validade encontrada
              </p>

              <p className="mt-1 max-w-md text-sm leading-6 text-[var(--casabella-muted)]">
                {expirationPage.summary.totalRecords === 0
                  ? "Cadastre o primeiro lote para iniciar o controle de validade."
                  : "Tente alterar a busca ou os filtros selecionados."}
              </p>

              {expirationPage.summary.totalRecords === 0 ? (
                <button
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--casabella-teal)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--casabella-teal-dark)]"
                  onClick={openCreateForm}
                  type="button"
                >
                  <span aria-hidden="true">+</span>
                  Cadastrar validade
                </button>
              ) : null}
            </div>
          ) : null}

          {!isLoading && !errorMessage && expirationPage.items.length > 0 ? (
            <>
              <div className="divide-y divide-[var(--casabella-border)]">
                {expirationPage.items.map((expiration) => {
                  const status = getExpirationStatus(expiration);
                  const product = expiration.storeProduct.product;
                  const store = expiration.storeProduct.store;

                  return (
                    <article
                      className="grid gap-4 p-5 transition hover:bg-[var(--casabella-background)] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_140px_100px_145px_76px] lg:items-center"
                      key={expiration.id}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                          Produto
                        </p>
                        <p className="mt-1 truncate font-semibold text-[var(--casabella-graphite)]">
                          {product.code} — {product.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--casabella-muted)]">
                          {product.category ?? "Sem categoria"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                          Loja
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
                          {store.code} — {store.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--casabella-muted)]">
                          {expiration.batchNumber
                            ? `Lote: ${expiration.batchNumber}`
                            : "Sem lote informado"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                          Validade
                        </p>
                        <p className="mt-1 text-sm font-bold text-[var(--casabella-teal-dark)]">
                          {formatExpirationDate(expiration.expirationDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                          Quantidade
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--casabella-graphite)]">
                          {expiration.quantity}
                        </p>
                      </div>

                      <span
                        className={`w-fit justify-self-start rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>

                      <button
                        aria-label={`Editar a validade do produto ${product.code}`}
                        className="inline-flex h-9 w-[76px] items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-0 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)]"
                        onClick={() => openEditForm(expiration)}
                        type="button"
                      >
                        Editar
                      </button>
                    </article>
                  );
                })}
              </div>

              <nav
                aria-label="Paginação das validades"
                className="flex flex-col gap-4 border-t border-[var(--casabella-border)] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-[var(--casabella-muted)]">
                  Exibindo {firstVisibleItem}–{lastVisibleItem} de{" "}
                  {expirationPage.pagination.totalItems} registros
                  {hasActiveFilters ? " encontrados" : ""}.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-3 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={expirationPage.pagination.page === 1 || isLoading}
                    onClick={() =>
                      changePage(expirationPage.pagination.page - 1)
                    }
                    type="button"
                  >
                    Anterior
                  </button>

                  {visiblePages.map((page, index) => (
                    <div className="contents" key={page}>
                      {index > 0 && page - visiblePages[index - 1] > 1 ? (
                        <span
                          aria-hidden="true"
                          className="px-1 text-[var(--casabella-muted)]"
                        >
                          …
                        </span>
                      ) : null}

                      <button
                        aria-current={
                          page === expirationPage.pagination.page
                            ? "page"
                            : undefined
                        }
                        aria-label={`Ir para a página ${page}`}
                        className={
                          page === expirationPage.pagination.page
                            ? "inline-flex size-9 items-center justify-center rounded-xl bg-[var(--casabella-teal)] text-sm font-bold text-white"
                            : "inline-flex size-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)]"
                        }
                        disabled={isLoading}
                        onClick={() => changePage(page)}
                        type="button"
                      >
                        {page}
                      </button>
                    </div>
                  ))}

                  <button
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-3 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      expirationPage.pagination.page ===
                        expirationPage.pagination.totalPages || isLoading
                    }
                    onClick={() =>
                      changePage(expirationPage.pagination.page + 1)
                    }
                    type="button"
                  >
                    Próxima
                  </button>
                </div>
              </nav>
            </>
          ) : null}
        </section>
      </div>

      {isFormOpen ? (
        <ExpirationFormModal
          expiration={selectedExpiration ?? undefined}
          isAdmin={isAdmin}
          onClose={closeForm}
          onSaved={handleExpirationSaved}
          stores={stores}
        />
      ) : null}
    </>
  );
}
