import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("İşlerim yükleniyor durumu", () => {
  it("bölüm verisi beklenirken kabuğun içerik durumunu açıklar", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Atamalar yükleniyor");
  });
});
