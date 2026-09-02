export function AppFooter() {
  const appVersion = process.env.APP_VERSION ?? "desenvolvimento";

  return (
    <footer className="mt-10 border-t border-[var(--casabella-border)] py-6 text-center text-xs text-[var(--casabella-muted)]">
      Grupo CasaBella Fragrâncias · Sistema interno de gestão · Versão{" "}
      {appVersion}
    </footer>
  );
}
