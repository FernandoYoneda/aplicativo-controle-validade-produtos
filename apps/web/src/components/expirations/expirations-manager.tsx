"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type { ExpirationRecord } from "../../types/expiration";
import type { Product } from "../../types/product";
import type { Store } from "../../types/store";
import { ExpirationFormModal } from "./expiration-form-modal";

interface ExpirationsManagerProps {
  initialExpirations: ExpirationRecord[];
  products: Product[];
  stores: Store[];
  isAdmin: boolean;
}

interface ExpirationStatus {
  key: "inactive" | "expired" | "upcoming" | "valid";
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

  return {
    key: "valid",
    label: "Dentro da validade",
    className: "bg-emerald-50 text-emerald-700",
  };
}

function formatExpirationDate(value: string): string {
  const dateValue = value.slice(0, 10);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${dateValue}T00:00:00.000Z`));
}

function sortExpirations(expirations: ExpirationRecord[]): ExpirationRecord[] {
  return [...expirations].sort((firstExpiration, secondExpiration) => {
    const dateComparison =
      getExpirationTimestamp(firstExpiration.expirationDate) -
      getExpirationTimestamp(secondExpiration.expirationDate);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return firstExpiration.storeProduct.product.code.localeCompare(
      secondExpiration.storeProduct.product.code,
      "pt-BR",
      {
        numeric: true,
        sensitivity: "base",
      },
    );
  });
}

export function ExpirationsManager({
  initialExpirations,
  products,
  stores,
  isAdmin,
}: ExpirationsManagerProps) {
  const router = useRouter();

  const [expirations, setExpirations] = useState<ExpirationRecord[]>(
    sortExpirations(initialExpirations),
  );
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExpiration, setSelectedExpiration] =
    useState<ExpirationRecord | null>(null);

  const loadExpirations = useCallback(async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/expirations", {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const responseBody = (await response.json()) as
        ExpirationRecord[] | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      setExpirations(sortExpirations(responseBody as ExpirationRecord[]));
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de validades.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const filteredExpirations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return expirations;
    }

    return expirations.filter((expiration) => {
      const status = getExpirationStatus(expiration);

      return [
        expiration.storeProduct.product.code,
        expiration.storeProduct.product.barcode ?? "",
        expiration.storeProduct.product.name,
        expiration.storeProduct.product.brand ?? "",
        expiration.storeProduct.product.category ?? "",
        expiration.storeProduct.store.code,
        expiration.storeProduct.store.name,
        expiration.batchNumber ?? "",
        expiration.notes ?? "",
        formatExpirationDate(expiration.expirationDate),
        status.label,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [expirations, search]);

  const expiredExpirations = useMemo(
    () =>
      expirations.filter(
        (expiration) => getExpirationStatus(expiration).key === "expired",
      ).length,
    [expirations],
  );

  const upcomingExpirations = useMemo(
    () =>
      expirations.filter(
        (expiration) => getExpirationStatus(expiration).key === "upcoming",
      ).length,
    [expirations],
  );

  const inactiveExpirations = useMemo(
    () => expirations.filter((expiration) => !expiration.isActive).length,
    [expirations],
  );

  function openCreateForm() {
    const hasActiveProducts = products.some((product) => product.isActive);
    const hasActiveStores = stores.some((store) => store.isActive);

    setErrorMessage("");
    setSuccessMessage("");

    if (!hasActiveProducts) {
      setErrorMessage("Nenhum produto ativo está disponível para o cadastro.");
      return;
    }

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

  function handleExpirationSaved(savedExpiration: ExpirationRecord) {
    const expirationAlreadyExists = expirations.some(
      (expiration) => expiration.id === savedExpiration.id,
    );

    setExpirations((currentExpirations) => {
      const updatedExpirations = expirationAlreadyExists
        ? currentExpirations.map((expiration) =>
            expiration.id === savedExpiration.id ? savedExpiration : expiration,
          )
        : [...currentExpirations, savedExpiration];

      return sortExpirations(updatedExpirations);
    });

    const productCode = savedExpiration.storeProduct.product.code;

    setSuccessMessage(
      expirationAlreadyExists
        ? `A validade do produto ${productCode} foi atualizada com sucesso.`
        : `A validade do produto ${productCode} foi cadastrada com sucesso.`,
    );

    closeForm();
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
              {isLoading ? "—" : expirations.length}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Produtos vencidos
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {isLoading ? "—" : expiredExpirations}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Próximos 30 dias
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {isLoading ? "—" : upcomingExpirations}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Registros inativos
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-coral-dark)]">
              {isLoading ? "—" : inactiveExpirations}
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
                onClick={() => void loadExpirations()}
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

          <div className="border-b border-[var(--casabella-border)] p-5">
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
              placeholder="Digite produto, loja, lote, data ou situação"
              type="search"
              value={search}
            />
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

          {!isLoading && !errorMessage && filteredExpirations.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-[var(--casabella-graphite)]">
                Nenhuma validade encontrada
              </p>

              <p className="mt-1 max-w-md text-sm leading-6 text-[var(--casabella-muted)]">
                {expirations.length === 0
                  ? "Cadastre o primeiro lote para iniciar o controle de validade."
                  : "Tente buscar por outro produto, loja, lote, data ou situação."}
              </p>

              {expirations.length === 0 ? (
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

          {!isLoading && !errorMessage && filteredExpirations.length > 0 ? (
            <div className="divide-y divide-[var(--casabella-border)]">
              {filteredExpirations.map((expiration) => {
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
          ) : null}
        </section>
      </div>

      {isFormOpen ? (
        <ExpirationFormModal
          expiration={selectedExpiration ?? undefined}
          isAdmin={isAdmin}
          onClose={closeForm}
          onSaved={handleExpirationSaved}
          products={products}
          stores={stores}
        />
      ) : null}
    </>
  );
}
