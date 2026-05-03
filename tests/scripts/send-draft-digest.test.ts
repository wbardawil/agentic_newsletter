import { describe, it, expect } from "vitest";
import {
  renderDigestHtml,
  renderDigestText,
  sendViaResend,
} from "../../src/scripts/send-draft-digest.js";

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
      sections: [],
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

const links = {
  prUrl: "https://github.com/wbardawil/agentic_newsletter/pull/42",
  publishWorkflowUrl:
    "https://github.com/wbardawil/agentic_newsletter/actions/workflows/publish-to-beehiiv.yml",
  reRunDraftUrl:
    "https://github.com/wbardawil/agentic_newsletter/actions/workflows/weekly-draft.yml",
};

describe("renderDigestText", () => {
  it("includes edition ID, score, headline, and links", () => {
    const draft = makeDraft();
    const text = renderDigestText(draft as never, links);
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
      validation: {
        isValid: false,
        score: 55,
        issues: [],
        recommendations: [],
        wordCounts: { total: 800 },
        shareableSentence: null,
      },
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
      validation: {
        isValid: true,
        score: 90,
        issues: [],
        recommendations: ["one", "two", "three", "four", "five"],
        wordCounts: { total: 900 },
        shareableSentence: null,
      },
    });
    const text = renderDigestText(draft as never, links);
    expect(text).toContain("• one");
    expect(text).toContain("• two");
    expect(text).toContain("• three");
    expect(text).not.toContain("• four");
  });

  it("omits PR line when prUrl is null", () => {
    const text = renderDigestText(makeDraft() as never, {
      ...links,
      prUrl: null,
    });
    expect(text).not.toContain("Review:");
    expect(text).toContain(links.publishWorkflowUrl);
  });
});

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
        peopleAngle: {
          challenge: "Owner must \"step\" out & change.",
          framework: "ADKAR: Reinforcement",
        },
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
    const html = renderDigestHtml(makeDraft() as never, {
      ...links,
      prUrl: null,
    });
    expect(html).not.toContain("Review draft on GitHub");
    expect(html).toContain("Publish to Beehiiv when ready");
  });
});

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
      {
        from: "Drafts <drafts@example.com>",
        to: ["editor@example.com"],
        subject: "Subject",
        html: "<p>html</p>",
        text: "text",
      },
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
    expect(body.subject).toBe("Subject");
  });

  it("throws on non-200 with a useful message", async () => {
    const fakeFetch = (async () => {
      return {
        ok: false,
        status: 422,
        json: async () => ({}),
        text: async () => "Invalid `from` address",
      } as Response;
    }) as typeof fetch;

    await expect(
      sendViaResend(
        "test-key",
        { from: "x", to: ["y"], subject: "s", html: "h", text: "t" },
        fakeFetch,
      ),
    ).rejects.toThrow(/HTTP 422.*Invalid `from`/);
  });

  it("throws if the response is missing an id", async () => {
    const fakeFetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      } as Response;
    }) as typeof fetch;

    await expect(
      sendViaResend(
        "test-key",
        { from: "x", to: ["y"], subject: "s", html: "h", text: "t" },
        fakeFetch,
      ),
    ).rejects.toThrow(/missing id/);
  });
});
