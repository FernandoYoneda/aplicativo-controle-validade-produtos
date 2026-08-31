"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import type {
  ExpirationRecord,
  ExpirationWriteOffReason,
  ExpirationWriteOffRecord,
  ExpirationWriteOffResult,
} from "../../types/expiration";
import type { Store } from "../../types/store";

interface ExpirationWriteOffModalProps {
  isAdmin: boolean;
  stores: Store[];
  onClose: () => void;
  onSaved: (result: ExpirationWriteOffResult) => void;
}

const reasonLabels: Record<ExpirationWriteOffReason, string> = {
  SOLD: "Vendido",
  EXPIRED: "Vencido",
  DISCARDED: "Descartado",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(value),
  );
}

function getResponseMessage(data: unknown, fallback: string): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }
  return fallback;
}

export function ExpirationWriteOffModal({
  isAdmin,
  stores,
  onClose,
  onSaved,
}: ExpirationWriteOffModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"write-off" | "history">("write-off");
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [candidates, setCandidates] = useState<ExpirationRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<ExpirationWriteOffReason>("SOLD");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<ExpirationWriteOffRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selected = candidates.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function findCandidates() {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
      setError("Leia o código de barras ou informe um produto.");
      return;
    }
    setIsSearching(true);
    setError("");
    setSuccess("");
    try {
      const params = new URLSearchParams({ query: normalizedSearch });
      if (storeId) params.set("storeId", storeId);
      const response = await fetch(
        `/api/expirations/write-off/search?${params}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as unknown;
      if (!response.ok)
        throw new Error(getResponseMessage(data, "Falha na busca."));
      const records = data as ExpirationRecord[];
      setCandidates(records);
      setSelectedId(records[0]?.id ?? "");
      setQuantity(1);
      if (records.length === 0) setError("Nenhum lote ativo foi encontrado.");
    } catch (requestError) {
      setCandidates([]);
      setSelectedId("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha na busca.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function loadHistory() {
    setIsLoadingHistory(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (storeId) params.set("storeId", storeId);
      const response = await fetch(`/api/expirations/write-offs?${params}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as unknown;
      if (!response.ok)
        throw new Error(getResponseMessage(data, "Falha no histórico."));
      setHistory(data as ExpirationWriteOffRecord[]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha no histórico.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function submitWriteOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError("Selecione um lote para dar baixa.");
      return;
    }
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `/api/expirations/${selected.id}/write-off`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity,
            reason,
            notes: notes.trim() || undefined,
          }),
        },
      );
      const data = (await response.json()) as unknown;
      if (!response.ok)
        throw new Error(getResponseMessage(data, "Falha ao registrar baixa."));
      const result = data as ExpirationWriteOffResult;
      onSaved(result);
      setSuccess(
        result.expiration.quantity === 0
          ? "Baixa concluída. O lote foi encerrado e saiu dos alertas."
          : `Baixa concluída. Restam ${result.expiration.quantity} unidades no lote.`,
      );
      setSearch("");
      setCandidates([]);
      setSelectedId("");
      setQuantity(1);
      setNotes("");
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao registrar baixa.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="presentation"
    >
      <section
        aria-labelledby="write-off-title"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--casabella-border)] p-6 sm:p-8">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[var(--casabella-coral)] uppercase">
              Operação rápida
            </p>
            <h2
              className="mt-2 text-2xl font-bold text-[var(--casabella-teal-dark)]"
              id="write-off-title"
            >
              Baixa de produto
            </h2>
            <p className="mt-1 text-sm text-[var(--casabella-muted)]">
              Use o leitor USB no campo de busca. O sistema escolhe primeiro o
              lote que vence antes.
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="size-10 rounded-full border border-[var(--casabella-border)] text-xl text-[var(--casabella-muted)]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="p-6 sm:p-8">
          <div className="mb-6 flex gap-2 rounded-xl bg-[var(--casabella-background)] p-1">
            <button
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold ${tab === "write-off" ? "bg-white text-[var(--casabella-teal)] shadow-sm" : "text-[var(--casabella-muted)]"}`}
              onClick={() => setTab("write-off")}
              type="button"
            >
              Dar baixa
            </button>
            <button
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold ${tab === "history" ? "bg-white text-[var(--casabella-teal)] shadow-sm" : "text-[var(--casabella-muted)]"}`}
              onClick={() => {
                setTab("history");
                void loadHistory();
              }}
              type="button"
            >
              Histórico
            </button>
          </div>

          {isAdmin ? (
            <label className="mb-5 block text-sm font-semibold text-[var(--casabella-graphite)]">
              Loja
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3"
                onChange={(event) => setStoreId(event.target.value)}
                value={storeId}
              >
                <option value="">Todas as lojas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} — {store.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {error ? (
            <div
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
              role="status"
            >
              {success}
            </div>
          ) : null}

          {tab === "write-off" ? (
            <form onSubmit={submitWriteOff}>
              <label
                className="block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="write-off-search"
              >
                Código de barras, código ou nome do produto
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  autoComplete="off"
                  className="h-12 flex-1 rounded-xl border border-[var(--casabella-border)] px-4 text-base outline-none focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
                  id="write-off-search"
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void findCandidates();
                    }
                  }}
                  placeholder="Aponte o leitor e escaneie"
                  ref={searchInputRef}
                  value={search}
                />
                <button
                  className="h-12 rounded-xl bg-[var(--casabella-teal)] px-6 font-bold text-white disabled:opacity-60"
                  disabled={isSearching}
                  onClick={() => void findCandidates()}
                  type="button"
                >
                  {isSearching ? "Buscando..." : "Buscar"}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--casabella-muted)]">
                Leitores USB comuns funcionam como teclado e enviam Enter
                automaticamente.
              </p>

              {candidates.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {candidates.map((candidate, index) => {
                    const product = candidate.storeProduct.product;
                    const store = candidate.storeProduct.store;
                    return (
                      <label
                        className={`block cursor-pointer rounded-2xl border p-4 ${candidate.id === selectedId ? "border-[var(--casabella-teal)] bg-[var(--casabella-teal-soft)]" : "border-[var(--casabella-border)]"}`}
                        key={candidate.id}
                      >
                        <input
                          checked={candidate.id === selectedId}
                          className="sr-only"
                          name="candidate"
                          onChange={() => {
                            setSelectedId(candidate.id);
                            setQuantity(1);
                          }}
                          type="radio"
                        />
                        <div className="flex flex-col justify-between gap-2 sm:flex-row">
                          <div>
                            <p className="font-bold text-[var(--casabella-graphite)]">
                              {product.code} — {product.name}
                            </p>
                            <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                              {store.code} — {store.name} · Lote{" "}
                              {candidate.batchNumber ?? "não informado"}
                            </p>
                          </div>
                          <div className="text-sm sm:text-right">
                            <p className="font-bold text-[var(--casabella-teal-dark)]">
                              Validade {formatDate(candidate.expirationDate)}
                            </p>
                            <p>{candidate.quantity} disponíveis</p>
                          </div>
                        </div>
                        {index === 0 ? (
                          <span className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            Lote que vence primeiro
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {selected ? (
                <div className="mt-6 grid gap-4 rounded-2xl border border-[var(--casabella-border)] p-5 md:grid-cols-3">
                  <label className="text-sm font-semibold">
                    Quantidade
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] px-3"
                      max={selected.quantity}
                      min={1}
                      onChange={(event) =>
                        setQuantity(Number(event.target.value))
                      }
                      type="number"
                      value={quantity}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Motivo
                    <select
                      className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] px-3"
                      onChange={(event) =>
                        setReason(
                          event.target.value as ExpirationWriteOffReason,
                        )
                      }
                      value={reason}
                    >
                      <option value="SOLD">Vendido</option>
                      <option value="EXPIRED">Vencido</option>
                      <option value="DISCARDED">Descartado</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Observação (opcional)
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] px-3"
                      maxLength={500}
                      onChange={(event) => setNotes(event.target.value)}
                      value={notes}
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-7 flex justify-end gap-3 border-t border-[var(--casabella-border)] pt-5">
                <button
                  className="h-11 rounded-xl border border-[var(--casabella-border)] px-5 font-semibold"
                  onClick={onClose}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="h-11 rounded-xl bg-[var(--casabella-teal)] px-6 font-bold text-white disabled:opacity-50"
                  disabled={
                    !selected ||
                    isSaving ||
                    quantity < 1 ||
                    quantity > (selected?.quantity ?? 0)
                  }
                  type="submit"
                >
                  {isSaving ? "Registrando..." : "Confirmar baixa"}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  className="rounded-xl border border-[var(--casabella-border)] px-4 py-2 text-sm font-semibold"
                  disabled={isLoadingHistory}
                  onClick={() => void loadHistory()}
                  type="button"
                >
                  Atualizar histórico
                </button>
              </div>
              {isLoadingHistory ? (
                <p className="py-12 text-center text-sm text-[var(--casabella-muted)]">
                  Carregando histórico...
                </p>
              ) : null}
              {!isLoadingHistory && history.length === 0 ? (
                <p className="py-12 text-center text-sm text-[var(--casabella-muted)]">
                  Nenhuma baixa registrada.
                </p>
              ) : null}
              <div className="space-y-3">
                {history.map((item) => (
                  <article
                    className="rounded-2xl border border-[var(--casabella-border)] p-4"
                    key={item.id}
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row">
                      <div>
                        <p className="font-bold">
                          {item.productLot.storeProduct.product.code} —{" "}
                          {item.productLot.storeProduct.product.name}
                        </p>
                        <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                          {item.productLot.storeProduct.store.code} —{" "}
                          {item.productLot.storeProduct.store.name}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-bold text-[var(--casabella-teal)]">
                          {reasonLabels[item.reason]} · {item.quantity} un.
                        </p>
                        <p className="text-xs text-[var(--casabella-muted)]">
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(item.createdAt))}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm">
                      Realizado por <strong>{item.performedBy.name}</strong> ·
                      saldo {item.previousQuantity} → {item.remainingQuantity}
                    </p>
                    {item.notes ? (
                      <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                        {item.notes}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
