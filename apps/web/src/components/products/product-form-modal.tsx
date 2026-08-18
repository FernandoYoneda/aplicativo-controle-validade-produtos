"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type {
  CreateProductPayload,
  Product,
  UpdateProductPayload,
} from "../../types/product";

interface ProductFormModalProps {
  product?: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível salvar o produto.";
  }

  return errorResponse.message ?? "Não foi possível salvar o produto.";
}

export function ProductFormModal({
  product,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const router = useRouter();
  const isEditing = product !== undefined;

  const [code, setCode] = useState(product?.code ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
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
    const normalizedBarcode = barcode.trim();
    const normalizedName = name.trim();
    const normalizedBrand = brand.trim();
    const normalizedCategory = category.trim();

    if (!normalizedCode || !normalizedName) {
      setErrorMessage("Informe o código e o nome do produto.");
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      setErrorMessage(
        "O código deve conter apenas letras, números, hífen ou sublinhado.",
      );
      return;
    }

    if (normalizedCode.length < 2) {
      setErrorMessage("O código deve possuir pelo menos 2 caracteres.");
      return;
    }

    if (normalizedName.length < 2) {
      setErrorMessage("O nome deve possuir pelo menos 2 caracteres.");
      return;
    }

    if (
      normalizedBarcode &&
      (!/^\d+$/.test(normalizedBarcode) ||
        normalizedBarcode.length < 8 ||
        normalizedBarcode.length > 32)
    ) {
      setErrorMessage("O código de barras deve possuir entre 8 e 32 números.");
      return;
    }

    if (normalizedBrand && normalizedBrand.length < 2) {
      setErrorMessage("A marca deve possuir pelo menos 2 caracteres.");
      return;
    }

    if (normalizedCategory && normalizedCategory.length < 2) {
      setErrorMessage("A categoria deve possuir pelo menos 2 caracteres.");
      return;
    }

    const payload: CreateProductPayload | UpdateProductPayload = isEditing
      ? {
          code: normalizedCode,
          barcode: normalizedBarcode || null,
          name: normalizedName,
          brand: normalizedBrand || null,
          category: normalizedCategory || null,
          isActive,
        }
      : {
          code: normalizedCode,
          barcode: normalizedBarcode || null,
          name: normalizedName,
          brand: normalizedBrand || null,
          category: normalizedCategory || null,
        };

    setIsSaving(true);

    try {
      const response = await fetch(
        isEditing ? `/api/products/${product.id}` : "/api/products",
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
        Product | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      onSaved(responseBody as Product);
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de produtos.");
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
        aria-labelledby="product-form-title"
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--casabella-border)] bg-white shadow-[0_30px_80px_rgba(0,67,77,0.22)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--casabella-border)] px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--casabella-coral)] uppercase">
              Catálogo
            </p>

            <h2
              className="mt-2 text-2xl font-bold text-[var(--casabella-teal-dark)]"
              id="product-form-title"
            >
              {isEditing ? "Editar produto" : "Cadastrar produto"}
            </h2>

            <p className="mt-1 text-sm text-[var(--casabella-muted)]">
              {isEditing
                ? "Atualize os dados e a situação do item."
                : "Informe os dados do novo item do catálogo."}
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
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="product-code"
              >
                Código
              </label>

              <input
                autoComplete="off"
                autoFocus
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold uppercase text-[var(--casabella-graphite)] outline-none transition placeholder:font-normal placeholder:normal-case placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="product-code"
                maxLength={40}
                minLength={2}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                pattern="[A-Z0-9_-]+"
                placeholder="Exemplo: PERFUME001"
                required
                type="text"
                value={code}
              />

              <p className="mt-2 text-xs leading-5 text-[var(--casabella-muted)]">
                Use letras, números, hífen ou sublinhado.
              </p>
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="product-barcode"
              >
                Código de barras
                <span className="ml-1 font-normal text-[var(--casabella-muted)]">
                  (opcional)
                </span>
              </label>

              <input
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="product-barcode"
                inputMode="numeric"
                maxLength={32}
                onChange={(event) =>
                  setBarcode(event.target.value.replace(/\D/g, ""))
                }
                placeholder="Digite somente números"
                type="text"
                value={barcode}
              />

              <p className="mt-2 text-xs leading-5 text-[var(--casabella-muted)]">
                Quando informado, deve possuir entre 8 e 32 números.
              </p>
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="product-name"
            >
              Nome do produto
            </label>

            <input
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving}
              id="product-name"
              maxLength={160}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite o nome do produto"
              required
              type="text"
              value={name}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="product-brand"
              >
                Marca
                <span className="ml-1 font-normal text-[var(--casabella-muted)]">
                  (opcional)
                </span>
              </label>

              <input
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="product-brand"
                maxLength={120}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Digite a marca"
                type="text"
                value={brand}
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="product-category"
              >
                Categoria
                <span className="ml-1 font-normal text-[var(--casabella-muted)]">
                  (opcional)
                </span>
              </label>

              <input
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="product-category"
                maxLength={120}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Digite a categoria"
                type="text"
                value={category}
              />
            </div>
          </div>

          {isEditing ? (
            <div className="rounded-2xl border border-[var(--casabella-border)] bg-[var(--casabella-background)] p-4">
              <label
                className="flex cursor-pointer items-center justify-between gap-4"
                htmlFor="product-active"
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--casabella-graphite)]">
                    Produto ativo
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-[var(--casabella-muted)]">
                    Produtos inativos permanecem cadastrados no catálogo.
                  </span>
                </span>

                <input
                  checked={isActive}
                  className="size-5 accent-[var(--casabella-teal)]"
                  disabled={isSaving}
                  id="product-active"
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
                  : "Cadastrar produto"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
