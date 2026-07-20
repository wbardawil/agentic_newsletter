interface FooterProps {
  editionNumber: number;
  lang: string;
  publishedAt: string;
  byline?: string;
  bylineRole?: string;
  pillar?: string;
  quarterlyTheme?: string;
}

export function NewsletterFooter({
  editionNumber,
  lang,
  publishedAt,
  byline,
  pillar,
  quarterlyTheme
}: FooterProps) {
  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(
        lang === "es" ? "es-MX" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : "";

  const tileLetter = byline ? byline.trim().charAt(0).toUpperCase() : "W";
  const authorName = byline || "Wadi Bardawil";

  return (
    <footer className="text-center mt-9 pt-1.5 flex flex-col items-center">
      {/* Orange Divider Bar */}
      <div className="w-16 h-[5px] bg-[var(--color-cta)] my-4 mx-auto"></div>

      {/* Signature Lockup with brand tile */}
      <div className="inline-flex items-center gap-2.5 font-display font-extrabold text-xs tracking-[3px] text-[var(--color-fg)] uppercase select-none">
        <span className="inline-flex items-center justify-center w-[26px] h-[26px] bg-[var(--color-cta)] text-white rounded-md font-display font-extrabold text-[14px]">
          {tileLetter}
        </span>
        {authorName}
      </div>

      {/* Issue meta folio */}
      <div className="font-sans font-semibold text-[11.5px] tracking-[1.5px] uppercase text-[var(--color-fg-muted)]/80 mt-2 select-none">
        {lang === "es" ? "Edición" : "Edition"} {editionNumber} · {lang.toUpperCase()} · {formattedDate}
      </div>

      {/* Fine-print details panel */}
      <div className="border-t border-[var(--color-line)] mt-[18px] pt-3 w-full text-center">
        <p className="text-[0.72rem] text-[var(--color-fg-muted)]/70 my-1">
          <strong>{lang === "es" ? "Redactado" : "Drafted"}:</strong> {formattedDate}
        </p>
        {pillar ? (
          <p className="text-[0.72rem] text-[var(--color-fg-muted)]/70 my-1">
            <strong>Pillar OS:</strong> {pillar}
          </p>
        ) : null}
        {quarterlyTheme ? (
          <p className="text-[0.72rem] text-[var(--color-fg-muted)]/70 my-1">
            <strong>{lang === "es" ? "Tema Trimestral" : "Quarterly Theme"}:</strong> {quarterlyTheme}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
