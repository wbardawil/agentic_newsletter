/**
 * Tiny markdown-ish renderer for archive bodies. We do not pull a full
 * markdown lib because edition bodies come from our own pipeline and are
 * already sanitized at write-time. If you want full markdown, swap in
 * marked + DOMPurify here.
 */
export interface NewsletterSection {
  title: string;
  contentHtml: string;
}

export function parseNewsletterBody(bodyMarkdown: string, lang: "es" | "en" = "es"): {
  leadHtml: string | null;
  sections: NewsletterSection[];
} {
  // 1. Preprocess Door in the raw full markdown first
  const doorPatternEs = /##\s*LA\s*PUERTA[\s\S]*?(?=\n+##|$)/i;
  const doorPatternEn = /##\s*THE\s*DOOR[\s\S]*?(?=\n+##|$)/i;

  const newDoorEs = `## LA PUERTA\n\nSi algo de esta publicación resonó contigo - platiquemos en [Instagram](https://ig.me/m/wbardawil)\n\nSi le es útil a alguien en tu red - reenvialo por [WhatsApp](https://wa.me/?text=Checa%20este%20newsletter%3A%20https%3A%2F%2Fnewsletter.wadibardawil.com)\n\nCuando estés listo para trabajar juntos directamente - descubre mis 4 formas de trabajo en [wadibardawil.com](https://wadibardawil.com)`;

  const newDoorEn = `## THE DOOR\n\nIf something in this publication resonated with you - let's chat on [Instagram](https://ig.me/m/wbardawil)\n\nIf it's useful to someone in your network - forward it via [WhatsApp](https://wa.me/?text=Check%20out%20this%20newsletter%3A%20https%3A%2F%2Fnewsletter.wadibardawil.com)\n\nWhen you're ready to work together directly - discover my 4 ways of working at [wadibardawil.com](https://wadibardawil.com)`;

  let fullMarkdown = bodyMarkdown.trim();

  if (lang === "es") {
    if (doorPatternEs.test(fullMarkdown)) {
      fullMarkdown = fullMarkdown.replace(doorPatternEs, newDoorEs);
    } else if (doorPatternEn.test(fullMarkdown)) {
      fullMarkdown = fullMarkdown.replace(doorPatternEn, newDoorEs);
    } else {
      fullMarkdown = fullMarkdown + "\n\n" + newDoorEs;
    }
  } else {
    if (doorPatternEn.test(fullMarkdown)) {
      fullMarkdown = fullMarkdown.replace(doorPatternEn, newDoorEn);
    } else if (doorPatternEs.test(fullMarkdown)) {
      fullMarkdown = fullMarkdown.replace(doorPatternEs, newDoorEn);
    } else {
      fullMarkdown = fullMarkdown + "\n\n" + newDoorEn;
    }
  }

  // 1.5. Clean up duplicate section headers and internal AI-tell labels
  const labelLineRe = /^[ \t]*(?:Sección|Section)[ \t]*:[ \t]*(?:lead|news|analysis|spotlight|tool|quickTakes|cta)[ \t]*$/gim;
  const duplicateHeaderRe = /^##[ \t]+(?:Spotlight|Lead|News|Analysis|Tool|QuickTakes|Cta)[ \t]*$/gim;
  fullMarkdown = fullMarkdown
    .replace(labelLineRe, "")
    .replace(duplicateHeaderRe, "")
    .replace(/\n{3,}/g, "\n\n");

  // 2. Split on lines starting with '## '
  const parts = fullMarkdown.split(/^##\s+/gm);
  const leadPart = parts[0] || "";
  const sectionParts = parts.slice(1);

  // Process Lead Part:
  // Remove any leading main H1 if present
  const cleanedLeadMarkdown = leadPart.replace(/^#\s+.+$/gm, "").trim();
  let leadHtml: string | null = null;
  if (cleanedLeadMarkdown) {
    leadHtml = renderBody(cleanedLeadMarkdown, lang, false);
  }

  // Process Card Sections:
  const sections: NewsletterSection[] = sectionParts.map((part) => {
    const lines = part.split("\n");
    const title = lines[0].trim();
    const contentMarkdown = lines.slice(1).join("\n").trim();
    const contentHtml = renderBody(contentMarkdown, lang, false);

    return { title, contentHtml };
  });

  return { leadHtml, sections };
}

export function renderBody(input: string, lang: "es" | "en" = "es", appendDoor: boolean = true): string {
  // Overwrite the Door section dynamically so all past and future articles are immediately updated with the new text and links
  let processed = input;

  if (appendDoor) {
    const doorPatternEs = /##\s*LA\s*PUERTA[\s\S]*?(?=\n+##|$)/i;
    const doorPatternEn = /##\s*THE\s*DOOR[\s\S]*?(?=\n+##|$)/i;

    const newDoorEs = `## LA PUERTA\n\nSi algo de esta publicación resonó contigo - platiquemos en [Instagram](https://ig.me/m/wbardawil)\n\nSi le es útil a alguien en tu red - reenvialo por [WhatsApp](https://wa.me/?text=Checa%20este%20newsletter%3A%20https%3A%2F%2Fnewsletter.wadibardawil.com)\n\nCuando estés listo para trabajar juntos directamente - descubre mis 4 formas de trabajo en [wadibardawil.com](https://wadibardawil.com)`;

    const newDoorEn = `## THE DOOR\n\nIf something in this publication resonated with you - let's chat on [Instagram](https://ig.me/m/wbardawil)\n\nIf it's useful to someone in your network - forward it via [WhatsApp](https://wa.me/?text=Check%20out%20this%20newsletter%3A%20https%3A%2F%2Fnewsletter.wadibardawil.com)\n\nWhen you're ready to work together directly - discover my 4 ways of working at [wadibardawil.com](https://wadibardawil.com)`;

    if (lang === "es") {
      if (doorPatternEs.test(processed)) {
        processed = processed.replace(doorPatternEs, newDoorEs);
      } else if (doorPatternEn.test(processed)) {
        processed = processed.replace(doorPatternEn, newDoorEs);
      } else {
        processed = processed + "\n\n" + newDoorEs;
      }
    } else {
      if (doorPatternEn.test(processed)) {
        processed = processed.replace(doorPatternEn, newDoorEn);
      } else if (doorPatternEs.test(processed)) {
        processed = processed.replace(doorPatternEs, newDoorEn);
      } else {
        processed = processed + "\n\n" + newDoorEn;
      }
    }
  }

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return escape(processed)
    .replace(/^# (.+)$/gm, '<h1 class="font-display text-3xl mt-8 mb-3">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="font-display text-2xl mt-6 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="font-display text-xl mt-5 mb-2">$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote class="pull-quote my-4">$1</blockquote>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--color-cta)] transition-colors">$1</a>')
    .split(/\n{2,}/)
    .map((para) =>
      /^<h\d|^<blockquote/.test(para.trim())
        ? para
        : `<p class="my-4 leading-relaxed">${para.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
}
