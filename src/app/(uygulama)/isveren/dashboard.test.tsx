import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryGrid } from "./dashboard";

describe("işveren özet kartları", () => {
  it("liste tek sayfaya sığdığında düz sayı ve dört bağlantı çizer", () => {
    render(
      <SummaryGrid
        summary={{
          openJobs: 2,
          openApplications: 5,
          activeAssignments: 3,
          pendingPayments: 1,
          partial: { jobs: false, assignments: false },
        }}
      />,
    );

    const list = screen.getByRole("list", { name: "Özet" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByRole("link", { name: /Açık ilan/ })).toHaveTextContent(/^2Açık ilan$/);
    expect(within(list).getByRole("link", { name: /Bekleyen başvuru/ })).toHaveAttribute(
      "href",
      "/isveren/ilanlar",
    );
    expect(within(list).getByRole("link", { name: /Bekleyen ödeme/ })).toHaveAttribute(
      "href",
      "/isveren/odemeler",
    );
  });

  it("liste taştığında dört kart da sayıyı alt sınır olarak ve kapsamı yazar", () => {
    // Başvuru sayısı ilan listesinden, ödeme sayısı atama listesinden türüyor;
    // kaynak liste kesildiyse türetilen sayı da kesik ve kart bunu söylemeli.
    render(
      <SummaryGrid
        summary={{
          openJobs: 20,
          openApplications: 37,
          activeAssignments: 100,
          pendingPayments: 12,
          partial: { jobs: true, assignments: true },
        }}
      />,
    );

    const applications = screen.getByRole("link", { name: /Bekleyen başvuru/ });
    expect(applications).toHaveTextContent("37+");
    expect(applications).toHaveTextContent("ilk sayfadaki açık ilanlarda");

    const payments = screen.getByRole("link", { name: /Bekleyen ödeme/ });
    expect(payments).toHaveTextContent("12+");
    expect(payments).toHaveTextContent("ilk 100 atamada");

    expect(screen.getByRole("link", { name: /Açık ilan/ })).toHaveTextContent("20+");
    expect(screen.getByRole("link", { name: /Aktif atama/ })).toHaveTextContent("100+");
  });
});
