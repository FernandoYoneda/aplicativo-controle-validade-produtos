"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { ApiErrorResponse } from "../../types/auth";
import type { Store } from "../../types/store";
import { StoreFormModal } from "./store-form-modal";

interface StoresManagerProps {
  initialStores: Store[];
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível listar as lojas.";
  }

  return errorResponse.message ?? "Não foi possível listar as lojas.";
}

function sortStores(stores: Store[]): Store[] {
  return [...stores].sort((firstStore, secondStore) =>
    firstStore.code.localeCompare(secondStore.code, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function StoresManager({ initialStores }: StoresManagerProps) {
  const router = useRouter();

  const [stores, setStores] = useState<Store[]>(sortStores(initialStores));
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const loadStores = useCallback(async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/stores", {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const responseBody = (await response.json()) as
        Store[] | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      setStores(sortStores(responseBody as Store[]));
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de lojas.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const filteredStores = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return stores;
    }

    return stores.filter(
      (store) =>
        store.code.toLowerCase().includes(normalizedSearch) ||
        store.name.toLowerCase().includes(normalizedSearch),
    );
  }, [search, stores]);

  const activeStores = useMemo(
    () => stores.filter((store) => store.isActive).length,
    [stores],
  );

  const inactiveStores = stores.length - activeStores;

  function openCreateForm() {
    setSelectedStore(null);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function openEditForm(store: Store) {
    setSelectedStore(store);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setSelectedStore(null);
  }

  function handleStoreSaved(savedStore: Store) {
    const storeAlreadyExists = stores.some(
      (store) => store.id === savedStore.id,
    );

    setStores((currentStores) => {
      const updatedStores = storeAlreadyExists
        ? currentStores.map((store) =>
            store.id === savedStore.id ? savedStore : store,
          )
        : [...currentStores, savedStore];

      return sortStores(updatedStores);
    });

    setSuccessMessage(
      storeAlreadyExists
        ? `A loja ${savedStore.code} foi atualizada com sucesso.`
        : `A loja ${savedStore.code} foi cadastrada com sucesso.`,
    );

    closeForm();
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Total de lojas
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-teal-dark)]">
              {isLoading ? "—" : stores.length}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Lojas ativas
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {isLoading ? "—" : activeStores}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Lojas inativas
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-coral-dark)]">
              {isLoading ? "—" : inactiveStores}
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
                Lojas cadastradas
              </h2>
              <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                Consulte e mantenha as unidades registradas no sistema.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                onClick={() => void loadStores()}
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
                Nova loja
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--casabella-border)] p-5">
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="store-search"
            >
              Buscar loja
            </label>
            <input
              className="h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
              id="store-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Digite o código ou o nome da loja"
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
              Carregando lojas...
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredStores.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-[var(--casabella-graphite)]">
                Nenhuma loja encontrada
              </p>
              <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                Tente buscar por outro código ou nome.
              </p>
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredStores.length > 0 ? (
            <div className="divide-y divide-[var(--casabella-border)]">
              {filteredStores.map((store) => (
                <article
                  className="grid gap-4 p-5 transition hover:bg-[var(--casabella-background)] sm:grid-cols-[100px_1fr_auto_auto] sm:items-center"
                  key={store.id}
                >
                  <div>
                    <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                      Código
                    </p>
                    <p className="mt-1 font-bold text-[var(--casabella-teal-dark)]">
                      {store.code}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                      Loja
                    </p>
                    <p className="mt-1 font-semibold text-[var(--casabella-graphite)]">
                      {store.name}
                    </p>
                  </div>

                  <span
                    className={
                      store.isActive
                        ? "w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                        : "w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                    }
                  >
                    {store.isActive ? "Ativa" : "Inativa"}
                  </span>

                  <button
                    aria-label={`Editar a loja ${store.code}`}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)]"
                    onClick={() => openEditForm(store)}
                    type="button"
                  >
                    Editar
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {isFormOpen ? (
        <StoreFormModal
          onClose={closeForm}
          onSaved={handleStoreSaved}
          store={selectedStore ?? undefined}
        />
      ) : null}
    </>
  );
}
