"use client";

export function EvidenceRetryButton() {
  return (
    <button
      type="button"
      className="button button-secondary button-small"
      onClick={() => window.location.reload()}
    >
      Kanıtları yeniden yükle
    </button>
  );
}
