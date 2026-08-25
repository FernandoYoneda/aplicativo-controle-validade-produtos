"use client";

import { useRef, useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type {
  ProductImportPreview,
  ProductImportResult,
} from "../../types/product";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xls", ".xlsx"];

interface ProductImportModalProps {
  onClose: () => void;
  onImported: (result: ProductImportResult) => Promise<void> | void;
}

function getErrorMessage(response: ApiErrorResponse): string {
  if (Array.isArray(response.message)) {
    return response.message[0] ?? "Não foi possível analisar a planilha.";
  }

  return response.message ?? "Não foi possível analisar a planilha.";
}

function isSupportedFile(file: File): boolean {
  const normalizedName = file.name.toLowerCase();

  return SUPPORTED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension),
  );
}

export function ProductImportModal({
  onClose,
  onImported,
}: ProductImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  function resetPreview(selectedFile: File | null) {
    setFile(selectedFile);
    setPreview(null);
    setErrorMessage("");
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) {
      resetPreview(null);
      return;
    }

    if (!isSupportedFile(selectedFile)) {
      resetPreview(null);
      setErrorMessage("Selecione um arquivo XLSX, XLS ou CSV.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      resetPreview(null);
      setErrorMessage("O arquivo deve ter no máximo 15 MB.");
      event.target.value = "";
      return;
    }

    resetPreview(selectedFile);
  }

  async function sendFile(
    mode: "preview" | "confirm",
  ): Promise<ProductImportPreview | ProductImportResult | null> {
    if (!file) {
      setErrorMessage("Selecione uma planilha para continuar.");
      return null;
    }

    const formData = new FormData();
    formData.append("file", file, file.name);
    setErrorMessage("");
    setIsProcessing(true);

    try {
      const response = await fetch(`/api/products/import?mode=${mode}`, {
        method: "POST",
        body: formData,
      });
      const responseBody = (await response.json()) as
        ProductImportPreview | ProductImportResult | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return null;
      }

      return responseBody as ProductImportPreview | ProductImportResult;
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de importação.");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePreview() {
    const result = await sendFile("preview");

    if (result) {
      setPreview(result);
    }
  }

  async function handleImport() {
    const result = await sendFile("confirm");

    if (result && "importedProducts" in result) {
      await onImported(result);
    }
  }

  return (
    <div
      aria-labelledby="product-import-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-[var(--casabella-border)] bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-[var(--casabella-border)] bg-white px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--casabella-coral)] uppercase">
              Cadastro em lote
            </p>
            <h2
              className="mt-1 text-2xl font-bold text-[var(--casabella-teal-dark)]"
              id="product-import-title"
            >
              Importar produtos por planilha
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--casabella-muted)]">
              O sistema utilizará somente a coluna <strong>Quebra 1</strong> e
              mostrará uma prévia antes do cadastro.
            </p>
          </div>

          <button
            aria-label="Fechar importação"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--casabella-border)] text-xl text-[var(--casabella-muted)] transition hover:bg-zinc-50"
            disabled={isProcessing}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <section className="rounded-2xl border border-[var(--casabella-border)] bg-[var(--casabella-background)] p-5">
            <label
              className="block text-sm font-bold text-[var(--casabella-graphite)]"
              htmlFor="product-import-file"
            >
              Planilha de produtos
            </label>
            <p className="mt-1 text-xs leading-5 text-[var(--casabella-muted)]">
              Formatos aceitos: XLSX, XLS e CSV. Tamanho máximo: 15 MB.
            </p>

            <input
              accept=".xlsx,.xls,.csv"
              className="mt-4 block w-full rounded-xl border border-[var(--casabella-border)] bg-white text-sm text-[var(--casabella-graphite)] file:mr-4 file:border-0 file:bg-[var(--casabella-teal)] file:px-4 file:py-3 file:font-semibold file:text-white hover:file:bg-[var(--casabella-teal-dark)]"
              disabled={isProcessing}
              id="product-import-file"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 truncate text-sm font-medium text-[var(--casabella-graphite)]">
                {file ? file.name : "Nenhum arquivo selecionado"}
              </p>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--casabella-teal)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!file || isProcessing}
                onClick={() => void handlePreview()}
                type="button"
              >
                {isProcessing && !preview
                  ? "Analisando..."
                  : preview
                    ? "Analisar novamente"
                    : "Analisar planilha"}
              </button>
            </div>
          </section>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            Amostras, demonstradores, sacolas, caixas, papéis de seda, etiquetas
            e demais materiais operacionais serão excluídos. Produtos repetidos
            serão identificados pelo código e cadastrados somente uma vez.
          </div>

          {errorMessage ? (
            <div
              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          {preview ? (
            <>
              <section>
                <h3 className="text-lg font-bold text-[var(--casabella-teal-dark)]">
                  Resultado da análise
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Linhas lidas", preview.summary.totalRows],
                    ["Produtos únicos", preview.summary.uniqueProducts],
                    ["Duplicidades ignoradas", preview.summary.duplicateRows],
                    ["Itens excluídos", preview.summary.excludedProducts],
                    ["Já cadastrados", preview.summary.existingProducts],
                    ["Linhas inválidas", preview.summary.invalidRows],
                    [
                      "Códigos conflitantes",
                      preview.summary.conflictingProducts,
                    ],
                    [
                      "Prontos para cadastrar",
                      preview.summary.importableProducts,
                    ],
                  ].map(([label, value]) => (
                    <article
                      className="rounded-2xl border border-[var(--casabella-border)] bg-white p-4 shadow-sm"
                      key={label}
                    >
                      <p className="text-xs font-semibold text-[var(--casabella-muted)]">
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-[var(--casabella-teal-dark)]">
                        {value}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              {preview.products.length > 0 ? (
                <section className="overflow-hidden rounded-2xl border border-[var(--casabella-border)]">
                  <div className="border-b border-[var(--casabella-border)] bg-[var(--casabella-teal-soft)] px-5 py-4">
                    <h3 className="font-bold text-[var(--casabella-teal-dark)]">
                      Produtos que serão cadastrados
                    </h3>
                    <p className="mt-1 text-xs text-[var(--casabella-muted)]">
                      Amostra dos primeiros {preview.products.length} produtos.
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-[var(--casabella-border)]">
                    {preview.products.map((product) => (
                      <div
                        className="grid gap-1 px-5 py-3 sm:grid-cols-[110px_1fr]"
                        key={product.code}
                      >
                        <span className="font-bold text-[var(--casabella-teal)]">
                          {product.code}
                        </span>
                        <span className="text-sm text-[var(--casabella-graphite)]">
                          {product.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {preview.excluded.length > 0 ? (
                <details className="rounded-2xl border border-[var(--casabella-border)] bg-white">
                  <summary className="cursor-pointer px-5 py-4 font-bold text-[var(--casabella-graphite)]">
                    Ver amostra dos itens excluídos ({preview.excluded.length})
                  </summary>
                  <div className="max-h-64 overflow-y-auto border-t border-[var(--casabella-border)] divide-y divide-[var(--casabella-border)]">
                    {preview.excluded.map((product) => (
                      <div className="px-5 py-3" key={product.code}>
                        <p className="text-sm font-semibold text-[var(--casabella-graphite)]">
                          {product.code} — {product.name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--casabella-muted)]">
                          {product.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              {preview.issues.length > 0 ? (
                <details className="rounded-2xl border border-red-200 bg-red-50">
                  <summary className="cursor-pointer px-5 py-4 font-bold text-red-800">
                    Ver linhas que exigem atenção ({preview.issues.length})
                  </summary>
                  <div className="max-h-64 overflow-y-auto border-t border-red-200 divide-y divide-red-200">
                    {preview.issues.map((issue, index) => (
                      <div className="px-5 py-3" key={`${issue.row}-${index}`}>
                        <p className="text-sm font-semibold text-red-800">
                          Linha {issue.row}: {issue.message}
                        </p>
                        <p className="mt-1 break-all text-xs text-red-700">
                          {issue.value || "Célula vazia"}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              {preview.samplesTruncated ? (
                <p className="text-xs leading-5 text-[var(--casabella-muted)]">
                  As listas acima são amostras. Os totais consideram toda a
                  planilha.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-[var(--casabella-border)] bg-white px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-5 text-sm font-semibold text-[var(--casabella-graphite)] transition hover:bg-zinc-50 disabled:opacity-50"
            disabled={isProcessing}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--casabella-teal)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              !preview ||
              preview.summary.importableProducts === 0 ||
              isProcessing
            }
            onClick={() => void handleImport()}
            type="button"
          >
            {isProcessing && preview
              ? "Cadastrando..."
              : `Cadastrar ${preview?.summary.importableProducts ?? 0} produtos`}
          </button>
        </footer>
      </div>
    </div>
  );
}
