import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { EmployerJobsPage } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const readMyJobs = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/jobs/jobs", () => ({ readMyJobs }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const emptyPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};

function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  return EmployerJobsPage({ searchParams: Promise.resolve(searchParams) });
}

describe("işverenin ilanlar sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({
      viewer: {
        firstName: "Ayşe",
        companies: [{ companyId, companyName: "Koala Etkinlik", role: "ADMIN", approved: true }],
      },
      failure: null,
    });
    readMyJobs.mockResolvedValue(emptyPage);
  });

  it("listenin creator bazlı olduğunu başlığında ve açıklamasında söyler", async () => {
    // `GET /users/me/jobs` yalnız `findAllByCreatorId` ile çalışıyor: şirketin
    // ikinci yetkilisi başkasının açtığı ilanı burada göremiyor. Sessiz bir
    // eksiklik, kullanıcıya ilanının kaybolduğunu düşündürürdü.
    render(await renderPage());

    expect(screen.getByRole("heading", { name: "Benim açtığım ilanlar" })).toBeVisible();
    expect(screen.getByText(/başka bir yetkilinin açtığı/i)).toBeVisible();
  });

  it("yeni ilan için hem bireysel hem şirket yolunu gösterir", async () => {
    render(await renderPage());

    expect(screen.getByRole("link", { name: /Kendi adıma ilan aç/ })).toHaveAttribute(
      "href",
      "/isveren/ilan/yeni",
    );
    expect(screen.getByRole("link", { name: /Koala Etkinlik adına ilan aç/ })).toHaveAttribute(
      "href",
      `/isveren/sirket/${companyId}/ilan/yeni`,
    );
  });

  it("adres çubuğundaki tanınmayan sıralamayı sunucuya götürmez", async () => {
    await renderPage({ sort: "password,desc", page: "3" });

    expect(readMyJobs).toHaveBeenCalledWith({ page: 3, sort: "createdAt,desc" });
  });

  it("tanıdığı sıralamayı ve sayfayı olduğu gibi taşır", async () => {
    await renderPage({ sort: "title,asc", page: "2" });

    expect(readMyJobs).toHaveBeenCalledWith({ page: 2, sort: "title,asc" });
  });

  it("sayfa parametresi sayı değilse ilk sayfayı ister", async () => {
    await renderPage({ page: "üç" });

    expect(readMyJobs).toHaveBeenCalledWith({ page: 0, sort: "createdAt,desc" });
  });

  it("liste okunamazsa nedenini koddan seçilmiş Türkçe metinle yazar", async () => {
    readMyJobs.mockRejectedValue(
      new ApiError({
        status: 400,
        errorCode: "PAGE_SORT_FIELD_NOT_ALLOWED",
        errorCategory: "VALIDATION",
        message: "ham mesaj",
      }),
    );

    render(await renderPage());

    expect(screen.getByRole("alert")).toHaveTextContent("Bu sıralama desteklenmiyor");
  });

  it("şirketi olmayan kullanıcıya şirket yolu göstermez", async () => {
    enterShell.mockResolvedValue({
      viewer: { firstName: "Ayşe", companies: [] },
      failure: null,
    });

    render(await renderPage());

    expect(screen.queryByText(/adına ilan aç/)).toBeNull();
  });
});
