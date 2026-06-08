import { z } from "zod";

export const ImageStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "regenerating",
  "failed",
]);
export type ImageStatus = z.infer<typeof ImageStatusSchema>;

export const ContentStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "regenerating",
  "failed",
]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const PublishStatusSchema = z.enum([
  "blocked",
  "ready",
  "published",
  "failed",
]);
export type PublishStatus = z.infer<typeof PublishStatusSchema>;

export const ReviewDecisionSchema = z.enum([
  "image_approve",
  "image_reject",
  "content_approve",
  "content_reject",
  "section_reject",
]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ReviewEventSchema = z.object({
  timestamp: z.string(),
  decision: ReviewDecisionSchema,
  reason: z.string().optional(),
  sectionType: z.string().optional(),
});
export type ReviewEvent = z.infer<typeof ReviewEventSchema>;

export const RejectedSectionSchema = z.object({
  sectionType: z.string(),
  reason: z.string().optional(),
});
export type RejectedSection = z.infer<typeof RejectedSectionSchema>;

/** Feedback from the editor after rejecting a draft — passed to agents on rerun. */
export const EditorialFeedbackSchema = z.object({
  /** Free-text reason the editor rejected the draft or image. */
  reason: z.string().optional(),
  /** Specific sections the editor flagged (for section_reject decisions). */
  rejectedSections: z.array(RejectedSectionSchema).optional(),
});
export type EditorialFeedback = z.infer<typeof EditorialFeedbackSchema>;

/** Persisted rejection file written by portal/app/review/route.ts. */
export const RejectionFileSchema = z.object({
  editionId: z.string(),
  type: z.enum(["content_reject", "section_reject"]),
  reason: z.string().nullable(),
  sections: z.array(RejectedSectionSchema),
  createdAt: z.string(),
});
export type RejectionFile = z.infer<typeof RejectionFileSchema>;

export const ImageReviewSchema = z.object({
  status: ImageStatusSchema,
  attempt: z.number().int().positive(),
  assetPath: z.string().nullable(),
  publicUrl: z.string().nullable(),
  prompt: z.string().nullable(),
  rejectedPrompts: z.array(z.string()),
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});
export type ImageReview = z.infer<typeof ImageReviewSchema>;

export const ContentReviewSchema = z.object({
  status: ContentStatusSchema,
  attempt: z.number().int().positive(),
  rejectedSections: z.array(RejectedSectionSchema),
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});
export type ContentReview = z.infer<typeof ContentReviewSchema>;

export const PublishStateSchema = z.object({
  status: PublishStatusSchema,
  blockedReason: z.string().nullable(),
  publishedAt: z.string().nullable(),
});
export type PublishState = z.infer<typeof PublishStateSchema>;

export const ReviewStateSchema = z.object({
  editionId: z.string(),
  runId: z.string(),
  reviewVersion: z.number().int().positive(),
  image: ImageReviewSchema,
  content: ContentReviewSchema,
  publish: PublishStateSchema,
  events: z.array(ReviewEventSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReviewState = z.infer<typeof ReviewStateSchema>;
