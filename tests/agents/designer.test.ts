import { describe, it, expect, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesignerAgent } from "../../src/agents/designer.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";
import { createFakeAnthropic } from "../helpers/fake-anthropic.js";
import type { AgentDeps } from "../../src/agents/base-agent.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAngle() {
  return {
    headline: "Your team escalates because your system tells them to",
    thesis: "Escalation is the rational response to undefined decision rights.",
    targetPersona: "$5M–$100M owner-operator",
    relevanceToAudience: "Every corridor operator hits the autonomy wall.",
    suggestedSources: [randomUUID()],
    talkingPoints: ["Decision rights architecture reduces escalation."],
    osPillar: "Operating Model OS" as const,
    peopleAngle: {
      challenge:
        "The owner must stop answering decisions that should not reach him.",
      framework: "ADKAR: Reinforcement",
    },
    quarterlyTheme: "The Machine",
  };
}

function makeContent() {
  return {
    language: "en" as const,
    subject: "Your team is following the system you built",
    preheader: "The autonomy problem is not a people problem.",
    sections: [
      {
        id: randomUUID(),
        type: "lead" as const,
        heading: "The Apertura",
        body: "Opening paragraph.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "analysis" as const,
        heading: "The Insight",
        body:
          "You told them to act independently. They keep coming to you. The instinct is to read this as a capability problem. It is not. It is a systems problem — escalation is the rational response when decision rights are undefined.",
        sourceRefs: [],
      },
    ],
  };
}

function depsWithFakeAnthropic(
  fake: ReturnType<typeof createFakeAnthropic>,
  overrides: Partial<AgentDeps["apiClients"]> = {},
): AgentDeps {
  const base = makeDeps();
  return {
    ...base,
    apiClients: {
      ...base.apiClients,
      anthropic: fake as never,
      ...overrides,
    },
  };
}

const tmpDirs: string[] = [];
function mkTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "designer-test-"));
  tmpDirs.push(d);
  return d;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAltTextCaption() {
  return JSON.stringify({
    altText: {
      en: "Abstract scaffolding illustration in muted teal and ochre over a cream textured field.",
      es: "Ilustración abstracta de andamios en tonos teal y ocre sobre un fondo crema texturizado.",
    },
    caption: {
      en: "Decision rights are scaffolding — without them every floor of the business rests on you.",
      es: "Los derechos de decisión son andamios; sin ellos, cada piso del negocio se apoya en ti.",
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DesignerAgent", () => {
  it("has the correct agent name", () => {
    const agent = new DesignerAgent(makeDeps());
    expect(agent.name).toBe("designer");
  });

  it("has input and output schemas defined", () => {
    const agent = new DesignerAgent(makeDeps());
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("validates designer input with required fields only", () => {
    const agent = new DesignerAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({
        angle: makeAngle(),
        enContent: makeContent(),
        outputDir: "/tmp/x",
      }),
    ).not.toThrow();
  });

  it("validates designer input with all optional fields", () => {
    const agent = new DesignerAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({
        angle: makeAngle(),
        enContent: makeContent(),
        outputDir: "/tmp/x",
        heroFilename: "2026-21-hero.png",
        attempt: 2,
        rejectionFeedback: "The image was too abstract — needs more structure.",
        rejectedPrompts: ["A dark scaffolding on a navy background..."],
      }),
    ).not.toThrow();
  });

  it("rejects input missing outputDir", () => {
    const agent = new DesignerAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({
        angle: makeAngle(),
        enContent: makeContent(),
      }),
    ).toThrow();
  });

  it("rejects input with invalid attempt (zero)", () => {
    const agent = new DesignerAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({
        angle: makeAngle(),
        enContent: makeContent(),
        outputDir: "/tmp/x",
        attempt: 0,
      }),
    ).toThrow();
  });

  it("returns error when LLM unavailable (no API key in tests)", async () => {
    const agent = new DesignerAgent(makeDeps());
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "designer",
      payload: {
        angle: makeAngle(),
        enContent: makeContent(),
        outputDir: mkTempDir(),
      },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("error");
  }, 10_000);

  it("dryRun mode writes a placeholder and skips Gemini call (attempt 1)", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({ text: "An abstract editorial illustration of scaffolding..." });
    fake.enqueue({ text: makeAltTextCaption() });

    const outDir = mkTempDir();
    const deps = depsWithFakeAnthropic(fake, {
      dryRun: true,
      geminiApiKey: undefined,
    });
    const agent = new DesignerAgent(deps);

    const output = await agent.run({
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "designer",
      payload: {
        angle: makeAngle(),
        enContent: makeContent(),
        outputDir: outDir,
      },
    });

    expect(output.status).toBe("success");
    expect(output.data.assets).toHaveLength(1);
    const asset = output.data.assets[0]!;
    expect(asset.kind).toBe("hero");
    expect(asset.imagePath).toMatch(/hero\.dryrun\.txt$/);
    expect(asset.attempt).toBe(1);
    expect(asset.publicUrl).toBeNull();
    expect(existsSync(asset.imagePath)).toBe(true);
    expect(readFileSync(asset.imagePath, "utf-8")).toContain("dryRun placeholder");
    expect(asset.altText.en).toMatch(/scaffolding/i);
    expect(asset.altText.es.length).toBeGreaterThan(0);
    expect(asset.caption.en.length).toBeGreaterThan(0);
    expect(asset.caption.es.length).toBeGreaterThan(0);
    fake.assertDrained();
  });

  it("dryRun mode at attempt 2 writes a versioned placeholder", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({ text: "A fundamentally different visual concept..." });
    fake.enqueue({ text: makeAltTextCaption() });

    const outDir = mkTempDir();
    const deps = depsWithFakeAnthropic(fake, {
      dryRun: true,
      geminiApiKey: undefined,
    });
    const agent = new DesignerAgent(deps);

    const output = await agent.run({
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "designer",
      payload: {
        angle: makeAngle(),
        enContent: makeContent(),
        outputDir: outDir,
        heroFilename: "2026-07-hero.png",
        attempt: 2,
        rejectionFeedback: "Too abstract — needs architectural metaphor.",
        rejectedPrompts: ["An abstract scaffolding on a navy background..."],
      },
    });

    expect(output.status).toBe("success");
    const asset = output.data.assets[0]!;
    expect(asset.attempt).toBe(2);
    expect(asset.imagePath).toMatch(/hero-v2\.dryrun\.txt$/);
    expect(asset.publicUrl).toBeNull();
    fake.assertDrained();
  });

  it("calls Gemini when key is set and writes the returned image bytes", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({ text: "Abstract editorial illustration..." });
    fake.enqueue({ text: makeAltTextCaption() });

    const fakeImageBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const fakeBase64 = fakeImageBytes.toString("base64");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, _init?: unknown) => {
      const u = typeof url === "string" ? url : url.toString();
      // Verify it's calling the Gemini generateContent endpoint (model name is configurable via brand-style-tokens.json)
      expect(u).toContain("generativelanguage.googleapis.com");
      expect(u).toContain(":generateContent");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: { mimeType: "image/png", data: fakeBase64 },
                  },
                ],
              },
            },
          ],
        }),
        text: async () => "",
      };
    }) as typeof fetch;

    try {
      const outDir = mkTempDir();
      const deps = depsWithFakeAnthropic(fake, {
        dryRun: false,
        geminiApiKey: "fake-gemini-key",
        supabaseUrl: undefined,
        supabaseServiceRoleKey: undefined,
      });
      const agent = new DesignerAgent(deps);

      const output = await agent.run({
        runId: randomUUID(),
        editionId: "2026-07",
        agentName: "designer",
        payload: {
          angle: makeAngle(),
          enContent: makeContent(),
          outputDir: outDir,
        },
      });

      expect(output.status).toBe("success");
      const asset = output.data.assets[0]!;
      expect(asset.imagePath).toMatch(/hero\.png$/);
      expect(asset.attempt).toBe(1);
      expect(asset.publicUrl).toBeNull(); // no Supabase configured
      expect(existsSync(asset.imagePath)).toBe(true);
      const written = readFileSync(asset.imagePath);
      expect(written.equals(fakeImageBytes)).toBe(true);
      // imageModel comes from brand-style-tokens.json — verify it's populated, not the specific name
      expect(output.data.imageModel.length).toBeGreaterThan(0);
      fake.assertDrained();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("versioned filename: attempt 2 appends -v2 before extension", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({ text: "Different visual concept for attempt 2..." });
    fake.enqueue({ text: makeAltTextCaption() });

    const fakeImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fakeBase64 = fakeImageBytes.toString("base64");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, _init?: unknown) => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: fakeBase64 } }] } }],
      }),
      text: async () => "",
    })) as typeof fetch;

    try {
      const outDir = mkTempDir();
      const deps = depsWithFakeAnthropic(fake, {
        dryRun: false,
        geminiApiKey: "fake-gemini-key",
        supabaseUrl: undefined,
        supabaseServiceRoleKey: undefined,
      });
      const agent = new DesignerAgent(deps);

      const output = await agent.run({
        runId: randomUUID(),
        editionId: "2026-21",
        agentName: "designer",
        payload: {
          angle: makeAngle(),
          enContent: makeContent(),
          outputDir: outDir,
          heroFilename: "2026-21-hero.png",
          attempt: 2,
        },
      });

      expect(output.status).toBe("success");
      const asset = output.data.assets[0]!;
      expect(asset.imagePath).toMatch(/2026-21-hero-v2\.png$/);
      expect(asset.attempt).toBe(2);
      expect(existsSync(asset.imagePath)).toBe(true);
      fake.assertDrained();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uploads to Supabase Storage when credentials are available and returns publicUrl", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({ text: "Abstract scaffolding..." });
    fake.enqueue({ text: makeAltTextCaption() });

    const fakeImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fakeBase64 = fakeImageBytes.toString("base64");
    const fakePublicUrl = "https://project.supabase.co/storage/v1/object/public/edition-assets/2026-07/hero-v1.png";

    // Mock both the Gemini call and the Supabase Storage upload
    const originalFetch = globalThis.fetch;
    let fetchCallCount = 0;
    globalThis.fetch = (async (url: string | URL, _init?: unknown) => {
      fetchCallCount++;
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("gemini")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: fakeBase64 } }] } }],
          }),
          text: async () => "",
        };
      }
      // Supabase Storage upload
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }) as typeof fetch;

    // Mock uploadEditionAsset to return fake URL
    const storageModule = await import("../../src/utils/storage-client.js");
    vi.spyOn(storageModule, "uploadEditionAsset").mockResolvedValue(fakePublicUrl);

    try {
      const outDir = mkTempDir();
      const deps = depsWithFakeAnthropic(fake, {
        dryRun: false,
        geminiApiKey: "fake-gemini-key",
        supabaseUrl: "https://project.supabase.co",
        supabaseServiceRoleKey: "fake-service-role-key",
      });
      const agent = new DesignerAgent(deps);

      const output = await agent.run({
        runId: randomUUID(),
        editionId: "2026-07",
        agentName: "designer",
        payload: {
          angle: makeAngle(),
          enContent: makeContent(),
          outputDir: outDir,
          heroFilename: "2026-07-hero.png",
        },
      });

      expect(output.status).toBe("success");
      const asset = output.data.assets[0]!;
      expect(asset.publicUrl).toBe(fakePublicUrl);
      fake.assertDrained();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("continues gracefully when Storage upload fails (non-fatal)", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({ text: "Abstract scaffolding..." });
    fake.enqueue({ text: makeAltTextCaption() });

    const fakeImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fakeBase64 = fakeImageBytes.toString("base64");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, _init?: unknown) => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: fakeBase64 } }] } }],
      }),
      text: async () => "",
    })) as typeof fetch;

    const storageModule = await import("../../src/utils/storage-client.js");
    vi.spyOn(storageModule, "uploadEditionAsset").mockRejectedValue(
      new Error("Storage upload failed: bucket not found"),
    );

    try {
      const outDir = mkTempDir();
      const deps = depsWithFakeAnthropic(fake, {
        dryRun: false,
        geminiApiKey: "fake-gemini-key",
        supabaseUrl: "https://project.supabase.co",
        supabaseServiceRoleKey: "fake-service-role-key",
      });
      const agent = new DesignerAgent(deps);

      const output = await agent.run({
        runId: randomUUID(),
        editionId: "2026-07",
        agentName: "designer",
        payload: {
          angle: makeAngle(),
          enContent: makeContent(),
          outputDir: outDir,
        },
      });

      // Agent should still succeed, just without a publicUrl
      expect(output.status).toBe("success");
      const asset = output.data.assets[0]!;
      expect(existsSync(asset.imagePath)).toBe(true);
      expect(asset.publicUrl).toBeNull();
      fake.assertDrained();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
