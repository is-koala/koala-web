import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

vi.mock("@/server/session/session", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@/server/session/session";

import { createAssignmentReview, isAlreadyReviewed } from "./reviews";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const request = vi.mocked(apiRequest);

describe("atama değerlendirmesi yazma ucu", () => {
  afterEach(() => vi.clearAllMocks());

  it("backend gövdesini olduğu gibi yollar ve yanıttaki değerlendirmeyi döndürür", async () => {
    request.mockResolvedValueOnce({
      id: "review-1",
      author: { id: "viewer-1" },
      rating: 4,
      comment: "  Dakikti  ",
      anonymous: false,
      createdAt: "2026-09-14T10:00:00Z",
    });

    await expect(createAssignmentReview(assignmentId, 4, "Dakikti")).resolves.toEqual({
      rating: 4,
      comment: "Dakikti",
      createdAt: "2026-09-14T10:00:00Z",
    });
    expect(request).toHaveBeenCalledWith(`/job-assignments/${assignmentId}/reviews`, {
      method: "POST",
      body: { rating: 4, comment: "Dakikti", anonymous: false },
    });
  });

  it("zarf boş dönerse gönderilen puanı ve yorumu taşır, boş yorumu null yapar", async () => {
    request.mockResolvedValueOnce(null);

    await expect(createAssignmentReview(assignmentId, 5, "")).resolves.toEqual({
      rating: 5,
      comment: null,
      createdAt: null,
    });
  });

  it("yalnız backend'in REVIEW_ALREADY_REVIEWED kodunu 'zaten değerlendirilmiş' sayar", () => {
    const already = new ApiError({
      status: 409,
      errorCode: "REVIEW_ALREADY_REVIEWED",
      errorCategory: "CONFLICT",
      message: "",
    });
    const other = new ApiError({
      status: 409,
      errorCode: "REVIEW_WORK_NOT_COMPLETED",
      errorCategory: "CONFLICT",
      message: "",
    });

    expect(isAlreadyReviewed(already)).toBe(true);
    expect(isAlreadyReviewed(other)).toBe(false);
    expect(isAlreadyReviewed(new Error("409"))).toBe(false);
  });
});
