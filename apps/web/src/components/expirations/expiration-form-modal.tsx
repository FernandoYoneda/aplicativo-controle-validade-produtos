"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type {
  CreateExpirationPayload,
  ExpirationRecord,
  UpdateExpirationPayload,
} from "../../types/expiration";
import type { Product } from "../../types/product";
import type { Store } from "../../types/store";

interface ExpirationFormModalProps {
  expiration?: ExpirationRecord;
  products: Product[];
  stores: Store[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (expiration: ExpirationRecord) => void;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return (
      errorResponse.message[0] ??
      "Não foi possível salvar o registro de validade."
    );
  }

  return (
    errorResponse.message ?? "Não foi possível salvar o registro de validade."
  );
}

function getDateInputValue(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function ExpirationFormModal({
  expiration,
  products,
  stores,
  isAdmin,
  onClose,
  onSaved,
}: ExpirationFormModalProps) {
  const router = useRouter();
  const isEditing = expiration !== undefined;
  const activeProducts = products.filter((product) => product.isActive);
  const activeStores = stores.filter((store) => store.isActive);

  const [productId, setProductId] = useState(
    expiration?.storeProduct.product.id ?? activeProducts[0]?.id ?? "",
  );
  const [storeId, setStoreId] = useState(
    expiration?.storeProduct.store.id ?? activeStores[0]?.id ?? "",
  );
  const [batchNumber, setBatchNumber] = useState(expiration?.batchNumber ?? "");
  const [expirationDate, setExpirationDate] = useState(
    getDateInputValue(expiration?.expirationDate),
  );
  const [quantity, setQuantity] = useState(String(expiration?.quantity ?? 1));
  const [notes, setNotes] = useState(expiration?.notes ?? "");
  const [isActive, setIsActive] = useState(expiration?.isActive ?? true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleClose() {
    if (!isSaving) {
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedBatchNumber = batchNumber.trim();
    const normalizedExpirationDate = expirationDate.trim();
    const normalizedQuantity = Number(quantity);
    const normalizedNotes = notes.trim();

    if (!isEditing && !productId) {
      setErrorMessage("Selecione o produto.");
      return;
    }

    if (!isEditing && isAdmin && !storeId) {
      setErrorMessage("Selecione a loja.");
      return;
    }

    if (!normalizedExpirationDate) {
      setErrorMessage("Informe a data de validade.");
      return;
    }

    if (!isValidDate(normalizedExpirationDate)) {
      setErrorMessage("Informe uma data de validade válida.");
      return;
    }

    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
      setErrorMessage(
        "A quantidade deve ser um número inteiro maior que zero.",
      );
      return;
    }

    if (normalizedBatchNumber.length > 80) {
      setErrorMessage("O lote deve possuir no máximo 80 caracteres.");
      return;
    }

    if (normalizedNotes.length > 500) {
      setErrorMessage("As observações devem possuir no máximo 500 caracteres.");
      return;
    }

    const payload: CreateExpirationPayload | UpdateExpirationPayload = isEditing
      ? {
          batchNumber: normalizedBatchNumber || null,
          expirationDate: normalizedExpirationDate,
          quantity: normalizedQuantity,
          notes: normalizedNotes || null,
          isActive,
        }
      : {
          productId,
          storeId: isAdmin ? storeId : undefined,
          batchNumber: normalizedBatchNumber || null,
          expirationDate: normalizedExpirationDate,
          quantity: normalizedQuantity,
          notes: normalizedNotes || null,
        };

    setIsSaving(true);

    try {
      const response = await fetch(
        isEditing ? `/api/expirations/${expiration.id}` : "/api/expirations",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const responseBody = (await response.json()) as
        ExpirationRecord | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      onSaved(responseBody as ExpirationRecord);
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de validades.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        aria-labelledby="expiration-form-title"
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--casabella-border)] bg-white shadow-[0_30px_80px_rgba(0,67,77,0.22)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--casabella-border)] px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--casabella-coral)] uppercase">
              Controle de validade
            </p>

            <h2
              className="mt-2 text-2xl font-bold text-[var(--casabella-teal-dark)]"
              id="expiration-form-title"
            >
              {isEditing ? "Editar validade" : "Cadastrar validade"}
            </h2>

            <p className="mt-1 text-sm text-[var(--casabella-muted)]">
              {isEditing
                ? "Atualize os dados e a situação do registro."
                : "Informe o produto, a loja e os dados de validade."}
            </p>
          </div>

          <button
            aria-label="Fechar formulário"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--casabella-border)] text-xl text-[var(--casabella-muted)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] hover:text-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </header>

        <form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
          {isEditing ? (
            <div className="grid gap-4 rounded-2xl border border-[var(--casabella-border)] bg-[var(--casabella-background)] p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                  Produto
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--casabella-graphite)]">
                  {expiration.storeProduct.product.code} —{" "}
                  {expiration.storeProduct.product.name}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                  Loja
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--casabella-graphite)]">
                  {expiration.storeProduct.store.code} —{" "}
                  {expiration.storeProduct.store.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                  htmlFor="expiration-product"
                >
                  Produto
                </label>

                <select
                  autoFocus
                  className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                  disabled={isSaving}
                  id="expiration-product"
                  onChange={(event) => setProductId(event.target.value)}
                  required
                  value={productId}
                >
                  <option value="">Selecione o produto</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} — {product.name}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin ? (
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                    htmlFor="expiration-store"
                  >
                    Loja
                  </label>

                  <select
                    className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                    disabled={isSaving}
                    id="expiration-store"
                    onChange={(event) => setStoreId(event.target.value)}
                    required
                    value={storeId}
                  >
                    <option value="">Selecione a loja</option>
                    {activeStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.code} — {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--casabella-border)] bg-[var(--casabella-background)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--casabella-graphite)]">
                    Loja vinculada
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--casabella-muted)]">
                    O registro será associado automaticamente à sua unidade.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="expiration-batch"
              >
                Lote
                <span className="ml-1 font-normal text-[var(--casabella-muted)]">
                  (opcional)
                </span>
              </label>

              <input
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="expiration-batch"
                maxLength={80}
                onChange={(event) => setBatchNumber(event.target.value)}
                placeholder="Exemplo: LOTE-2026-01"
                type="text"
                value={batchNumber}
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="expiration-date"
              >
                Data de validade
              </label>

              <input
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="expiration-date"
                onChange={(event) => setExpirationDate(event.target.value)}
                required
                type="date"
                value={expirationDate}
              />
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="expiration-quantity"
            >
              Quantidade
            </label>

            <input
              className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving}
              id="expiration-quantity"
              inputMode="numeric"
              min={1}
              onChange={(event) => setQuantity(event.target.value)}
              required
              step={1}
              type="number"
              value={quantity}
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="expiration-notes"
            >
              Observações
              <span className="ml-1 font-normal text-[var(--casabella-muted)]">
                (opcional)
              </span>
            </label>

            <textarea
              className="min-h-24 w-full resize-y rounded-xl border border-[var(--casabella-border)] bg-white px-4 py-3 text-sm leading-6 text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving}
              id="expiration-notes"
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Inclua informações adicionais sobre o lote"
              value={notes}
            />
          </div>

          {isEditing ? (
            <div className="rounded-2xl border border-[var(--casabella-border)] bg-[var(--casabella-background)] p-4">
              <label
                className="flex cursor-pointer items-center justify-between gap-4"
                htmlFor="expiration-active"
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--casabella-graphite)]">
                    Registro ativo
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-[var(--casabella-muted)]">
                    Registros inativos permanecem disponíveis para consulta.
                  </span>
                </span>

                <input
                  checked={isActive}
                  className="size-5 accent-[var(--casabella-teal)]"
                  disabled={isSaving}
                  id="expiration-active"
                  onChange={(event) => setIsActive(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
          ) : null}

          {errorMessage ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--casabella-border)] pt-5 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-5 text-sm font-semibold text-[var(--casabella-graphite)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={handleClose}
              type="button"
            >
              Cancelar
            </button>

            <button
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--casabella-teal)] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Salvando..."
                : isEditing
                  ? "Salvar alterações"
                  : "Cadastrar validade"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
