interface StoryCardProps {
  title: string;
  htmlContent: string;
}

export function NewsletterStoryCard({ title, htmlContent }: StoryCardProps) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-[1.35rem_1.4rem_1.15rem] md:p-[1.5rem_1.7rem_1.3rem] lg:p-[2rem_2.6rem_1.7rem] my-[1.15rem] mx-0">
      
      {/* Labeled Section Divider with horizontal lines extending left & right */}
      <h2 className="flex items-center gap-[14px] font-sans font-extrabold text-[0.78rem] tracking-[0.26em] uppercase text-[var(--color-cta)] mb-4 before:content-[''] before:flex-1 before:h-[1px] before:bg-[var(--color-line)] after:content-[''] after:flex-1 after:h-[1px] after:bg-[var(--color-line)] select-none">
        {title}
      </h2>

      {/* Content wrapper with Tailwind-scoped custom styles */}
      <div 
        className="
          text-[16.5px] lg:text-[17.5px] leading-relaxed text-[var(--color-fg)]
          [&_p]:my-[0.9rem] [&_p]:leading-relaxed [&_p:first-of-type]:mt-0 [&_p:last-child]:mb-[0.2rem]
          [&_strong]:font-bold [&_strong]:text-[var(--color-fg)]
          [&_em]:text-[var(--color-fg-muted)] [&_em]:not-italic
          [&_h3]:font-display [&_h3]:font-bold [&_h3]:text-[var(--color-fg)] [&_h3]:text-[1.02rem] [&_h3]:mt-5 [&_h3]:mb-2
          [&_blockquote]:border-l-3 [&_blockquote]:border-l-[var(--color-cta)] [&_blockquote]:my-[1.1rem] [&_blockquote]:pl-4 [&_blockquote]:py-[0.2rem] [&_blockquote]:text-[var(--color-fg-muted)]
          [&_ul]:list-none [&_ul]:pl-0
          [&_li]:my-[0.55rem] [&_li]:pl-[1.3rem] [&_li]:relative [&_li]:text-[var(--color-fg)] 
          [&_li]:before:content-[''] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.52em] [&_li]:before:w-2 [&_li]:before:h-2 [&_li]:before:bg-[var(--color-cta)]
          [&_a]:text-[var(--color-fg)] [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-[var(--color-cta)] [&_a]:decoration-[1.5px] [&_a]:hover:text-[var(--color-cta)] [&_a]:transition-colors
          [&_a[target='_blank']::after]:content-['\00a0\2197'] [&_a[target='_blank']::after]:text-[0.85em] [&_a[target='_blank']::after]:text-[var(--color-cta)]
          [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_figure]:my-4 [&_figure]:text-center [&_figcaption]:text-[0.88rem] [&_figcaption]:text-[var(--color-fg-muted)] [&_figcaption]:mt-2 [&_figcaption]:italic
        "
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </section>
  );
}
