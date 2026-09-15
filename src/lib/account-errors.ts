import type { ErrorCatalog } from "./error-presentation";

/** Hesap ayarlarının (`/panel/hesap`, `/isveren/hesap`) redleri. */
export const accountErrors: ErrorCatalog = {
  LEGAL_DELETION_ALREADY_REQUESTED: {
    title: "Silme talebin zaten var",
    message: "Bekleyen talebinin güncel durumunu görmek için sayfayı yenileyebilirsin.",
    action: "retry",
  },
};
