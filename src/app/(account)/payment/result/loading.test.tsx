import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import Loading from "./loading";

it("ödeme sonucu doğrulanırken erişilebilir yükleniyor durumu gösterir", () => {
  render(<Loading />);
  expect(screen.getByRole("status")).toHaveTextContent("Ödeme sonucu doğrulanıyor");
});
