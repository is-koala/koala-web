import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("iş ayrıntısı yükleniyor durumu", () => {
  it("yalnız bölüm içeriği için anlamlı yükleme durumu gösterir", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("İş ayrıntısı yükleniyor");
  });
});
