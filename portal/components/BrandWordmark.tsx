/**
 * Brand wordmark — text fallback used when /public/logo-horizontal.png
 * has not been dropped into the portal yet. Once the asset is in place,
 * SiteHeader swaps to <Image src="/logo-horizontal.png" />.
 */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-[0.18em] uppercase text-[0.95rem] leading-none ${className}`}
      aria-label="Wadi Bardawil"
    >
      Wadi Bardawil
    </span>
  );
}
