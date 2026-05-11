/**
 * Tiny markdown-ish renderer for archive bodies. We do not pull a full
 * markdown lib because edition bodies come from our own pipeline and are
 * already sanitized at write-time. If you want full markdown, swap in
 * marked + DOMPurify here.
 */
export function renderBody(input: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return escape(input)
    .replace(/^# (.+)$/gm, '<h1 class="font-display text-3xl mt-8 mb-3">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="font-display text-2xl mt-6 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="font-display text-xl mt-5 mb-2">$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote class="pull-quote my-4">$1</blockquote>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .split(/\n{2,}/)
    .map((para) =>
      /^<h\d|^<blockquote/.test(para.trim())
        ? para
        : `<p class="my-4 leading-relaxed">${para.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
}
