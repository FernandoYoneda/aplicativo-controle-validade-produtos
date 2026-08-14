"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import type { ApiErrorResponse } from "../../types/auth";
import type {
  CreateStorePayload,
  Store,
  UpdateStorePayload,
} from "../../types/store";

interface StoreFormModalProps {
  store?: Store;
  onClose: () => void;
  onSaved: (store: Store) => void;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível salvar a loja.";
  }

  return errorResponse.message ?? "Não foi possível salvar a loja.";
}

export function StoreFormModal({
  store,
  onClose,
  onSaved,
}: StoreFormModalProps) {
  const router = useRouter();
  const isEditing = store !== undefined;

  const [code, setCode] = useState(store?.code ?? "");
  const [name, setName] = useState(store?.name ?? "");
  const [isActive, setIsActive] = useState(store?.isActive ?? true);
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

    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();

    if (!normalizedCode || !normalizedName) {
      setErrorMessage("Informe o código e o nome da loja.");
      return;
    }

    const payload: CreateStorePayload | UpdateStorePayload = isEditing
      ? {
          code: normalizedCode,
          name: normalizedName,
          isActive,
        }
      : {
          code: normalizedCode,
          name: normalizedName,
        };

    setIsSaving(true);

    try {
      const response = await fetch(
        isEditing ? `/api/stores/${store.id}` : "/api/stores",
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

      const responseBody = (await response.json()) as Store | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      onSaved(responseBody as Store);
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de lojas.");
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
        aria-labelledby="store-form-title"
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--casabella-border)] bg-white shadow-[0_30px_80px_rgba(0,67,77,0.22)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--casabella-border)] px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--casabella-coral)] uppercase">
              Administração
            </p>
            <h2
              className="mt-2 text-2xl font-bold text-[var(--casabella-teal-dark)]"
              id="store-form-title"
            >
              {isEditing ? "Editar loja" : "Cadastrar loja"}
            </h2>
            <p className="mt-1 text-sm text-[var(--casabella-muted)]">
              {isEditing
                ? "Atualize os dados e a situação da unidade."
                : "Informe os dados da nova unidade do grupo."}
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
          <div>
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="store-code"
            >
              Código
            </label>
            <input
              autoComplete="off"
              autoFocus
              className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold uppercase text-[var(--casabella-graphite)] outline-none transition placeholder:font-normal placeholder:normal-case placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving}
              id="store-code"
              maxLength={20}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Exemplo: LJ019"
              required
              type="text"
              value={code}
            />
            <p className="mt-2 text-xs text-[var(--casabella-muted)]">
              O código será armazenado em letras maiúsculas.
            </p>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="store-name"
            >
              Nome da loja
            </label>
            <input
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving}
              id="store-name"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite o nome da loja"
              required
              type="text"
              value={name}
            />
          </div>

          {isEditing ? (
            <div className="rounded-2xl border border-[var(--casabella-border)] bg-[var(--casabella-background)] p-4">
              <label
                className="flex cursor-pointer items-center justify-between gap-4"
                htmlFor="store-active"
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--casabella-graphite)]">
                    Loja ativa
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--casabella-muted)]">
                    Lojas inativas permanecem cadastradas no sistema.
                  </span>
                </span>

                <input
                  checked={isActive}
                  className="size-5 accent-[var(--casabella-teal)]"
                  disabled={isSaving}
                  id="store-active"
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
                  : "Cadastrar loja"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
