import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("ilan ayrıntısı bekleme durumu", () => {
  it("ilanın yüklendiğini erişilebilir biçimde duyurur", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("İlan ayrıntısı yükleniyor");
  });
});
