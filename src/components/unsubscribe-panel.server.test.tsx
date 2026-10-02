// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UnsubscribePanel } from "./unsubscribe-panel";

describe("abonelikten çıkma panelinin statik HTML'i", () => {
  it("token istemcide okunana kadar onay düğmesini kapalı çizer", () => {
    // Sayfa statik üretiliyor; hidrasyondan önce düğmenin eylemi React'in yer
    // tutucusu. Açık çizilseydi o anki dokunuş sessizce kaybolur, JavaScript
    // kapalıyken de `<noscript>` notunun yanında işe yaramayan bir düğme dururdu.
    const html = renderToString(<UnsubscribePanel />);

    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Abonelikten çık<\/button>/);
  });
});
