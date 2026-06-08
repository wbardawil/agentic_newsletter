import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  ReviewStateSchema,
  type ReviewState,
  type ReviewEvent,
  type ImageStatus,
} from "../types/review.js";

export function initializeReview(editionId: string, runId: string): ReviewState {
  const now = new Date().toISOString();
  return {
    editionId,
    runId,
    reviewVersion: 1,
    image: {
      status: "pending",
      attempt: 1,
      assetPath: null,
      publicUrl: null,
      prompt: null,
      rejectedPrompts: [],
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    content: {
      status: "pending",
      attempt: 1,
      rejectedSections: [],
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    publish: {
      status: "blocked",
      blockedReason: "image_pending",
      publishedAt: null,
    },
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function loadReview(
  draftsDir: string,
  editionId: string,
): ReviewState | null {
  const reviewPath = join(draftsDir, `${editionId}-review.json`);
  if (!existsSync(reviewPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(reviewPath, "utf-8"));
    return ReviewStateSchema.parse(raw);
  } catch {
    return null;
  }
}

export function saveReview(draftsDir: string, review: ReviewState): void {
  mkdirSync(draftsDir, { recursive: true });
  const reviewPath = join(draftsDir, `${review.editionId}-review.json`);
  const updated: ReviewState = { ...review, updatedAt: new Date().toISOString() };
  writeFileSync(reviewPath, JSON.stringify(updated, null, 2), "utf-8");
}

export function appendEvent(
  review: ReviewState,
  event: ReviewEvent,
): ReviewState {
  return {
    ...review,
    events: [...review.events, event],
    updatedAt: new Date().toISOString(),
  };
}

export function updateImageInReview(
  review: ReviewState,
  status: ImageStatus,
  extra?: {
    assetPath?: string | null;
    publicUrl?: string | null;
    prompt?: string | null;
    attempt?: number;
    rejectionReason?: string;
  },
): ReviewState {
  const now = new Date().toISOString();
  const prevPrompt = review.image.prompt;

  const rejectedPrompts =
    status === "rejected" && prevPrompt
      ? [...review.image.rejectedPrompts, prevPrompt]
      : review.image.rejectedPrompts;

  const publishBlockedReason =
    status === "approved" ? "content_pending" : "image_pending";

  return {
    ...review,
    image: {
      ...review.image,
      status,
      attempt: extra?.attempt ?? review.image.attempt,
      assetPath: extra?.assetPath !== undefined ? extra.assetPath : review.image.assetPath,
      publicUrl: extra?.publicUrl !== undefined ? extra.publicUrl : review.image.publicUrl,
      prompt: extra?.prompt !== undefined ? extra.prompt : review.image.prompt,
      approvedAt: status === "approved" ? now : review.image.approvedAt,
      rejectedAt: status === "rejected" ? now : review.image.rejectedAt,
      rejectionReason: extra?.rejectionReason ?? review.image.rejectionReason,
      rejectedPrompts,
    },
    publish: {
      ...review.publish,
      status: "blocked",
      blockedReason: publishBlockedReason,
    },
    updatedAt: now,
  };
}
