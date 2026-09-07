import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Page, { CompanyJobFormPanel } from "./page";

const currentGates = vi.hoisted(() => vi.fn());
const fetchJobCategories = vi.hoisted(() => vi.fn());
const fetchJobTemplates = vi.hoisted(() => vi.fn());
const jobForm = vi.hoisted(() => vi.fn(() => <p>form</p>));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/server/jobs/jobs", () => ({ fetchJobCategories, fetchJobTemplates }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/components/job-form", () => ({ JobForm: jobForm }));
vi.mock("@/server/session/gates", async () => {
  const real = await vi.importActual<typeof import("@/server/session/gates")>(
    "@/server/session/gates",
  );
  return { ...real, currentGates };
});

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const category = {
  id: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f01",
  name: "Garson",
  code: "WAITER",
  requiresInsurance: false,
};

function membership(overrides: Record<string, unknown> = {}) {
  return {
    companyId,
    companyName: "Koala Etkinlik",
    role: "ADMIN",
    approved: true,
    corporateJob: { open: true },
    ...overrides,
  };
}

async function renderPage(companies: readonly unknown[]) {
  currentGates.mockResolvedValue({
    viewer: { firstName: "Ayşe" },
    failure: null,
    gates: { companies },
  });

  return render(await Page({ params: Promise.resolve({ companyId }) }));
}

describe("şirket adına ilan açma sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchJobCategories.mockResolvedValue([category]);
    fetchJobTemplates.mockResolvedValue([]);
  });

  it("formu şirket kimliğiyle çizer", async () => {
    // Panel doğrudan çağrılıyor: `render` içinde askıya giren bir sunucu
    // bileşeninin ağacı okunamaz ve prop'lar görünmez olurdu.
    const tree = (await CompanyJobFormPanel({ companyId, companyName: "Koala Etkinlik" })) as {
      type: unknown;
      props: Record<string, unknown>;
    };

    expect(tree.type).toBe(jobForm);
    expect(tree.props).toMatchObject({
      owner: { kind: "company", companyId, companyName: "Koala Etkinlik" },
      blocked: [],
    });
  });

  it("kapı açıkken başlığa şirketin adını yazar ve hiçbir engel bildirmez", async () => {
    // Ağaç okunuyor, çizilmiyor: kapı açıkken içeride veri bekleyen bir sunucu
    // bileşeni var ve `render` onu çözemez.
    currentGates.mockResolvedValue({
      viewer: { firstName: "Ayşe" },
      failure: null,
      gates: { companies: [membership()] },
    });

    const tree = (await Page({ params: Promise.resolve({ companyId }) })) as {
      props: { children: readonly { type: unknown; props: Record<string, unknown> }[] };
    };
    const nodes = [tree.props.children].flat(3);

    expect(nodes.find((node) => node?.type === "h1")?.props.children).toBe(
      "Koala Etkinlik adına yeni ilan",
    );
    expect(
      nodes.find((node) => node?.props?.action === "İlanı yayımla")?.props.blocked,
    ).toEqual([]);
  });

  it("onaylanmamış şirkette formu hiç çizmez, nedenini yazar", async () => {
    // Form tek kullanımlık bir adres kanıtı taşıyor: doldurulup reddedilmesi
    // kullanıcıya o kanıtı yeniden ürettirirdi.
    await renderPage([membership({ approved: false, corporateJob: { open: false, blockedBy: ["companyApproval"] } })]);

    expect(jobForm).not.toHaveBeenCalled();
    expect(screen.getByText("Şirketin henüz onaylanmadı")).toBeVisible();
  });

  it("yetkilisi olunmayan şirkette formu hiç çizmez", async () => {
    await renderPage([]);

    expect(jobForm).not.toHaveBeenCalled();
    expect(screen.getByText("Bu şirketin yetkilisi değilsin")).toBeVisible();
  });

  it("kapı kapalıyken kategori ve şablonları hiç sormaz", async () => {
    // Kullanıcının göremeyeceği bir ekran için backend'e gidilmez.
    await renderPage([]);

    expect(fetchJobCategories).not.toHaveBeenCalled();
    expect(fetchJobTemplates).not.toHaveBeenCalled();
  });

  it("UUID olmayan şirket kimliğinde 404 verir", async () => {
    currentGates.mockResolvedValue({ viewer: {}, failure: null, gates: { companies: [] } });

    await expect(
      Page({ params: Promise.resolve({ companyId: "../auth/login" }) }),
    ).rejects.toThrowError("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
