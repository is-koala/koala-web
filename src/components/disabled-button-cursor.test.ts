import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const globalStyles = readFileSync(
  resolve("src/app/globals.css"),
  "utf8",
);

describe("kapalı düğme imleci", () => {
  afterEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it("geçici kapalılıkta beklemeyi, kalıcı kapalılıkta erişilemezliği anlatır", () => {
    const style = document.createElement("style");
    style.textContent = globalStyles;
    document.head.append(style);

    const temporary = disabledButton();
    const permanent = disabledButton();
    permanent.dataset.disabledKind = "permanent";
    document.body.append(temporary, permanent);

    expect(getComputedStyle(temporary).cursor).toBe("wait");
    expect(getComputedStyle(permanent).cursor).toBe("not-allowed");
  });
});

function disabledButton() {
  const button = document.createElement("button");
  button.className = "button";
  button.disabled = true;
  return button;
}
