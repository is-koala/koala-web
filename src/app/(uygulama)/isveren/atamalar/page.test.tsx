import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const enterShell = vi.hoisted(() => vi.fn());
const readEmployerAssignments = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payments", () => ({ readEmployerAssignments }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));

import Page, { EmployerAssignmentsPage } from "./page";

describe("işveren atamaları sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ali" }, failure: null });
  });

  it("merkezi bölüm kapısını veri yüklemeden önce taşır", () => {
    const searchParams = Promise.resolve({});
    const route = Page({ searchParams });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "employer", href: "/isveren/atamalar" });
    expect(readEmployerAssignments).not.toHaveBeenCalled();
  });

  it("atama yoksa boş durumu gösterir", async () => {
    readEmployerAssignments.mockResolvedValue({
      content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true,
    });

    render(await EmployerAssignmentsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("status")).toHaveTextContent("Henüz işveren ataman yok");
  });

  it("backend hatasını ham mesaj yerine errorCode ile gösterir", async () => {
    readEmployerAssignments.mockRejectedValue(new ApiError({
      status: 503,
      errorCode: "EXTERNAL_SERVICE",
      errorCategory: "EXTERNAL_SERVICE",
      message: "backend internal detail",
    }));

    render(await EmployerAssignmentsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByText("backend internal detail")).toBeNull();
  });
});
