import { describe, it, expect } from "vitest";
import {
  renderDigestHtml,
  renderDigestText,
  sendViaResend,
} from "../../src/scripts/send-draft-digest.js";
import type { DigestLinks } from "../../src/scripts/send-draft-digest.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    runId: "11111111-2222-3333-4444-555555555555",
    editionId: "2026-18",
    angle: {
      headline: "Your team escalates because your system tells them to",
      thesis: "Escalation is the rational response to undefined decision rights.",
      osPillar: "Operating Model OS",
      peopleAngle: {
        challenge: "The owner must stop answering decisions that are not his.",
        framework: "ADKAR: Reinforcement",
      },
      quarterlyTheme: "The Machine",
    },
    enContent: {
      language: "en",
      subject: "Your team is following the system you built",
      preheader: "The autonomy problem is not a people problem.",
      sections: [
        { type: "lead", heading: "The Apertura", body: "Opening." },
        { type: "analysis", heading: "The Insight", body: "The main insight." },
        { type: "spotlight", heading: "Field Report", body: "Field report." },
      ],
    },
    validation: {
      isValid: true,
      score: 87,
      issues: [],
      recommendations: [
        "Tighten the second paragraph; the framework name appears twice.",
        "Field Report could anchor harder in the corridor.",
      ],
      wordCounts: { total: 932 },
      shareableSentence: "Escalation is not timidity. It is self-preservation.",
    },
    ...overrides,
  };
}

function makeDraftWithDesigner(overrides: Record<string, unknown> = {}) {
  return makeDraft({
    designer: {
      assets: [
        {
          kind: "hero",
          imagePath: "drafts/2026-18-hero.png",
          publicUrl: "https://project.supabase.co/storage/v1/object/public/edition-assets/2026-18/hero-v1.png",
          prompt: "Abstract scaffolding on dark background...",
          altText: {
            en: "Abstract scaffolding illustration in muted teal and ochre.",
            es: "Ilustración abstracta de andamios en tonos teal y ocre.",
          },
          caption: {
            en: "Decision rights are scaffolding — without them every floor rests on you.",
            es: "Los derechos de decisión son andamios; sin ellos cada piso se apoya en ti.",
          },
          attempt: 1,
        },
      ],
      imageModel: "gemini-3-pro-image",
    },
    ...overrides,
  });
}

const links: DigestLinks = {
  prUrl: "https://github.com/wbardawil/agentic_newsletter/pull/42",
  publishWorkflowUrl:
    "https://github.com/wbardawil/agentic_newsletter/actions/workflows/publish-to-beehiiv.yml",
  reRunDraftUrl:
    "https://github.com/wbardawil/agentic_newsletter/actions/workflows/weekly-draft.yml",
  approveUrl: null,
  editorUrl: null,
};

const linksWithApprove: DigestLinks = {
  ...links,
  approveUrl:
    "https://approve.example.workers.dev/approve?t=eyJhbGciOiJIUzI1NiJ9.signed",
};

const linksWithReview: DigestLinks = {
  ...links,
  approveUrl: null,
  imageApproveUrl: "https://portal.example.com/review?t=img_approve_token",
  imageRejectUrl: "https://portal.example.com/review?t=img_reject_token",
  contentApproveUrl: "https://portal.example.com/review?t=content_approve_token",
  contentRejectUrl: "https://portal.example.com/review?t=content_reject_token",
  sectionRejectUrls: {
    lead: "https://portal.example.com/review?t=section_lead",
    analysis: "https://portal.example.com/review?t=section_analysis",
    spotlight: "https://portal.example.com/review?t=section_spotlight",
  },
};

// ── renderDigestText ──────────────────────────────────────────────────────────

describe("renderDigestText", () => {
  it("includes edition ID, score, headline, and links", () => {
    const text = renderDigestText(makeDraft() as never, links);
    expect(text).toContain("Edition 2026-18");
    expect(text).toContain("87/100");
    expect(text).toContain("valid");
    expect(text).toContain("Operating Model OS");
    expect(text).toContain("Your team escalates because your system tells them to");
    expect(text).toContain(links.prUrl!);
    expect(text).toContain(links.publishWorkflowUrl);
  });

  it("marks score as invalid when isValid is false", () => {
    const draft = makeDraft({
      validation: { isValid: false, score: 55, issues: [], recommendations: [], wordCounts: { total: 800 }, shareableSentence: null },
    });
    const text = renderDigestText(draft as never, links);
    expect(text).toContain("55/100");
    expect(text).toContain("invalid");
  });

  it("includes peopleAngle framework and challenge", () => {
    const text = renderDigestText(makeDraft() as never, links);
    expect(text).toContain("ADKAR: Reinforcement");
    expect(text).toContain("The owner must stop answering decisions");
  });

  it("includes top 3 recommendations only", () => {
    const draft = makeDraft({
      validation: { isValid: true, score: 90, issues: [], recommendations: ["one", "two", "three", "four", "five"], wordCounts: { total: 900 }, shareableSentence: null },
    });
    const text = renderDigestText(draft as never, links);
    expect(text).toContain("• one");
    expect(text).toContain("• three");
    expect(text).not.toContain("• four");
  });

  it("omits PR line when prUrl is null", () => {
    const text = renderDigestText(makeDraft() as never, { ...links, prUrl: null });
    expect(text).not.toContain("Review:");
    expect(text).toContain(links.publishWorkflowUrl);
  });

  it("uses the approval link as the publish CTA when set (no review links)", () => {
    const text = renderDigestText(makeDraft() as never, linksWithApprove);
    expect(text).toContain("Approve+publish:");
    expect(text).toContain(linksWithApprove.approveUrl!);
    expect(text).not.toContain("Publish workflow:");
  });

  it("falls back to the workflow link when approveUrl is null and no review links", () => {
    const text = renderDigestText(makeDraft() as never, links);
    expect(text).toContain("Publish workflow:");
    expect(text).toContain(links.publishWorkflowUrl);
  });

  it("includes the portal editor link when editorUrl is set", () => {
    const text = renderDigestText(makeDraft() as never, {
      ...links,
      editorUrl: "https://agentic-newsletter-testing.vercel.app/admin/drafts/2026-18/edit",
    });
    expect(text).toContain("Edit in portal:");
    expect(text).toContain("/admin/drafts/2026-18/edit");
  });

  it("includes image section when designer is present", () => {
    const text = renderDigestText(makeDraftWithDesigner() as never, linksWithReview);
    expect(text).toContain("Hero image");
    expect(text).toContain("intento 1");
    expect(text).toContain("gemini-3-pro-image");
    expect(text).toContain("project.supabase.co");
    expect(text).toContain("Decision rights are scaffolding");
    expect(text).toContain("Los derechos de decisión");
    expect(text).toContain(linksWithReview.imageApproveUrl!);
    expect(text).toContain(linksWithReview.imageRejectUrl!);
  });

  it("includes content decision links when review links are set", () => {
    const text = renderDigestText(makeDraftWithDesigner() as never, linksWithReview);
    expect(text).toContain(linksWithReview.contentApproveUrl!);
    expect(text).toContain(linksWithReview.contentRejectUrl!);
  });
});

// ── renderDigestHtml ──────────────────────────────────────────────────────────

describe("renderDigestHtml", () => {
  it("renders a complete HTML document", () => {
    const html = renderDigestHtml(makeDraft() as never, links);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("</html>");
    expect(html).toContain("Edition 2026-18");
    expect(html).toContain(links.prUrl!);
    expect(html).toContain(links.publishWorkflowUrl);
  });

  it("escapes HTML in user-controlled fields", () => {
    const draft = makeDraft({
      angle: {
        headline: "<script>alert('xss')</script>",
        thesis: "Plain.",
        osPillar: "Operating Model OS",
        peopleAngle: { challenge: 'Owner must "step" out & change.', framework: "ADKAR: Reinforcement" },
        quarterlyTheme: "The Machine",
      },
    });
    const html = renderDigestHtml(draft as never, links);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;step&quot;");
    expect(html).toContain("&amp;");
  });

  it("omits the review button when prUrl is null", () => {
    const html = renderDigestHtml(makeDraft() as never, { ...links, prUrl: null });
    expect(html).not.toContain("Review draft on GitHub");
    expect(html).toContain("Publish to Beehiiv when ready");
  });

  it("renders the one-click Approve button when approveUrl is set (no image links)", () => {
    const html = renderDigestHtml(makeDraft() as never, linksWithApprove);
    expect(html).toContain("Approve and publish");
    expect(html).toContain(linksWithApprove.approveUrl!);
    expect(html).not.toContain("Publish to Beehiiv when ready");
  });

  it("renders the Edit in portal button when editorUrl is set", () => {
    const html = renderDigestHtml(makeDraft() as never, {
      ...links,
      editorUrl: "https://agentic-newsletter-testing.vercel.app/admin/drafts/2026-18/edit",
    });
    expect(html).toContain("Edit in portal");
    expect(html).toContain("/admin/drafts/2026-18/edit");
  });

  it("explains the signed-link expiry in the footer when one-click is on", () => {
    const html = renderDigestHtml(makeDraft() as never, linksWithApprove);
    expect(html).toContain("signed link valid for 7 days");
  });

  // ── Image block tests ──

  it("image block appears before the headline (not after)", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, linksWithReview);
    const imageIdx = html.indexOf("Hero image");
    const headlineIdx = html.indexOf("Your team escalates");
    expect(imageIdx).toBeGreaterThan(0);
    expect(headlineIdx).toBeGreaterThan(0);
    expect(imageIdx).toBeLessThan(headlineIdx);
  });

  it("renders image preview using publicUrl when available", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, linksWithReview);
    expect(html).toContain("project.supabase.co/storage");
    expect(html).toContain('<img src="https://project.supabase.co');
  });

  it("renders approve/reject image buttons with correct URLs", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, linksWithReview);
    expect(html).toContain("Aprobar imagen");
    expect(html).toContain("Rechazar imagen");
    expect(html).toContain(linksWithReview.imageApproveUrl!);
    expect(html).toContain(linksWithReview.imageRejectUrl!);
  });

  it("shows bilingual caption in image block", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, linksWithReview);
    expect(html).toContain("Decision rights are scaffolding");
    expect(html).toContain("Los derechos de decisión");
  });

  it("shows attachment note when hasAttachment is true and no publicUrl", () => {
    const draft = makeDraftWithDesigner({
      designer: {
        assets: [{
          kind: "hero",
          imagePath: "drafts/2026-18-hero.png",
          publicUrl: null,
          prompt: "prompt",
          altText: { en: "en alt", es: "es alt" },
          caption: { en: "Caption.", es: "Caption ES." },
          attempt: 1,
        }],
        imageModel: "gemini-3-pro-image",
      },
    });
    const html = renderDigestHtml(draft as never, linksWithReview, { hasAttachment: true });
    expect(html).toContain("adjunta en este correo");
  });

  it("escapes HTML in image captions and prompts", () => {
    const draft = makeDraftWithDesigner({
      designer: {
        assets: [{
          kind: "hero",
          imagePath: "drafts/2026-18-hero.png",
          publicUrl: "https://example.com/hero.png",
          prompt: "<script>evil</script>",
          altText: { en: "alt", es: "alt" },
          caption: { en: 'Caption with <b>bold</b> & "quotes"', es: "Caption ES." },
          attempt: 1,
        }],
        imageModel: "gemini-3-pro-image",
      },
    });
    const html = renderDigestHtml(draft as never, linksWithReview);
    expect(html).not.toContain("<script>evil");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
  });

  it("does NOT render the old Approve button when imageApproveUrl is set", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, {
      ...linksWithReview,
      approveUrl: "https://old-approve-url.com",
    });
    expect(html).not.toContain("Approve and publish");
    expect(html).not.toContain("old-approve-url");
    expect(html).toContain("Aprobar imagen");
  });

  it("does NOT render image block when designer is absent", () => {
    const html = renderDigestHtml(makeDraft() as never, linksWithReview);
    expect(html).not.toContain("Aprobar imagen");
    expect(html).not.toContain("Rechazar imagen");
    expect(html).not.toContain("Hero image");
  });

  // ── Content action block tests ──

  it("renders content action buttons with correct URLs", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, linksWithReview);
    expect(html).toContain("Aprobar artículo");
    expect(html).toContain("Rechazar artículo");
    expect(html).toContain(linksWithReview.contentApproveUrl!);
    expect(html).toContain(linksWithReview.contentRejectUrl!);
  });

  it("renders per-section rejection links for existing sections only", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, linksWithReview);
    // draft has lead, analysis, spotlight sections
    expect(html).toContain("Apertura");
    expect(html).toContain("Insight");
    expect(html).toContain("Field Report");
    expect(html).toContain(linksWithReview.sectionRejectUrls!["analysis"]!);
    // tool and quickTakes are NOT in the draft sections
    expect(html).not.toContain(linksWithReview.sectionRejectUrls!["tool"] ?? "NO_TOOL");
  });

  it("does NOT render content block when no review links", () => {
    const html = renderDigestHtml(makeDraft() as never, links);
    expect(html).not.toContain("Aprobar artículo");
    expect(html).not.toContain("Rechazar artículo");
  });

  it("footer explains dual approval requirement when review links are present", () => {
    const html = renderDigestHtml(makeDraftWithDesigner() as never, linksWithReview);
    expect(html).toContain("Both approvals are required");
  });
});

// ── sendViaResend ─────────────────────────────────────────────────────────────

describe("sendViaResend", () => {
  it("posts the payload and returns the response id", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      capturedUrl = typeof url === "string" ? url : url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "resend-msg-abc-123" }),
        text: async () => "",
      } as Response;
    }) as typeof fetch;

    const result = await sendViaResend(
      "test-key",
      { from: "Drafts <drafts@example.com>", to: ["editor@example.com"], subject: "Subject", html: "<p>html</p>", text: "text" },
      fakeFetch,
    );

    expect(result.id).toBe("resend-msg-abc-123");
    expect(capturedUrl).toBe("https://api.resend.com/emails");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.from).toBe("Drafts <drafts@example.com>");
    expect(body.to).toEqual(["editor@example.com"]);
  });

  it("sends attachments when provided", async () => {
    let capturedBody: Record<string, unknown> = {};
    const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return { ok: true, status: 200, json: async () => ({ id: "msg-123" }), text: async () => "" } as Response;
    }) as typeof fetch;

    await sendViaResend(
      "test-key",
      {
        from: "x",
        to: ["y"],
        subject: "s",
        html: "h",
        text: "t",
        attachments: [{ filename: "hero.png", content: "base64data", contentType: "image/png" }],
      },
      fakeFetch,
    );

    expect(capturedBody["attachments"]).toHaveLength(1);
    expect((capturedBody["attachments"] as Array<{ filename: string }>)[0]?.filename).toBe("hero.png");
  });

  it("throws on non-200 with a useful message", async () => {
    const fakeFetch = (async () => ({
      ok: false, status: 422, json: async () => ({}), text: async () => "Invalid `from` address",
    } as Response)) as typeof fetch;

    await expect(
      sendViaResend("test-key", { from: "x", to: ["y"], subject: "s", html: "h", text: "t" }, fakeFetch),
    ).rejects.toThrow(/HTTP 422.*Invalid `from`/);
  });

  it("throws if the response is missing an id", async () => {
    const fakeFetch = (async () => ({
      ok: true, status: 200, json: async () => ({}), text: async () => "",
    } as Response)) as typeof fetch;

    await expect(
      sendViaResend("test-key", { from: "x", to: ["y"], subject: "s", html: "h", text: "t" }, fakeFetch),
    ).rejects.toThrow(/missing id/);
  });
});
