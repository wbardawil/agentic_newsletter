interface MastheadProps {
  editionNumber: number;
  lang: string;
  publishedAt: string;
  subject: string;
  byline?: string;
  bylineRole?: string;
}

export function NewsletterMasthead({
  editionNumber,
  lang,
  publishedAt,
  subject,
  byline,
}: MastheadProps) {
  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(
        lang === "es" ? "es-MX" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : "";

  const tileLetter = byline ? byline.trim().charAt(0).toUpperCase() : "W";

  return (
    <header className="text-center py-6 pb-2 relative flex flex-col items-center select-none">
      {/* Signature Brand Tile */}
      <span className="inline-flex items-center justify-center w-11 h-11 bg-[var(--color-cta)] text-white rounded-[10px] font-display font-extrabold text-2xl mb-3">
        {tileLetter}
      </span>

      {/* Brand Title */}
      <div className="font-display font-extrabold text-[1.28rem] tracking-[0.14em] uppercase text-[var(--color-fg)] leading-tight">
        The Transformation Letter
      </div>

      {/* Issue Details Meta */}
      <div className="font-sans font-semibold text-[0.76rem] tracking-[0.18em] uppercase text-[var(--color-fg-muted)] mt-1.5">
        {lang === "es" ? "Edición" : "Edition"} {editionNumber} · {lang.toUpperCase()} · {formattedDate}
      </div>

      {/* Thick Horizontal Divider Bar */}
      <div className="w-16 h-[5px] bg-[var(--color-cta)] my-[18px] mx-auto"></div>

      {/* Main Headline (Balanced Wrapping) */}
      <h1 className="font-display font-extrabold text-[1.75rem] md:text-[2rem] lg:text-[2.45rem] leading-[1.18] tracking-[-0.01em] text-[var(--color-fg)] my-0 mx-auto max-w-[32ch] lg:max-w-[30ch] text-wrap-balance">
        {subject}
      </h1>
    </header>
  );
}
