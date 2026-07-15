/**
 * Brand lockup — original W monogram (Brand System assets/w-mark.png) +
 * wordmark text. The monogram is the one required graphic element of the
 * brand per DESIGN.md.
 */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`} aria-label="Wadi Bardawil">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/w-mark.png" alt="" aria-hidden="true" className="h-7 w-auto" />
      <span className="font-bold tracking-[0.18em] uppercase text-[0.95rem] leading-none">
        Wadi Bardawil
      </span>
    </span>
  );
}
