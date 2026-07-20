interface LeadCalloutProps {
  htmlContent: string;
}

export function NewsletterLeadCallout({ htmlContent }: LeadCalloutProps) {
  return (
    <div 
      className="bg-[var(--color-surface)] border border-[var(--color-line)] border-l-4 border-l-[var(--color-cta)] rounded-r-[14px] my-[1.2rem] mx-0 p-4 lg:p-[1.3rem_1.7rem] text-left text-[var(--color-fg)] [&_p]:my-0 [&_p]:leading-relaxed"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
