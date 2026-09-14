import { homeContent } from "@/content/marketing";

import { PhoneFrame, screens, type ScreenId } from "./phone-screens";
import { IconTile, Section, SectionHeading } from "./section";
import { Tabs } from "./tabs";

/**
 * "Uygulamayı dene": beş ekran, tek telefon çerçevesi.
 *
 * Ekranlar sunucuda çizilir; `Tabs` yalnız hangisinin görüneceğini tutar.
 * Betiksiz sayfada ilk ekran (harita) görünür kalır.
 */
export function AppDemo() {
  const copy = homeContent.app;
  return (
    <Section id="uygulama" tone="sunken" labelledBy="uygulama-title">
      <SectionHeading id="uygulama-title" eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <Tabs
        label="Uygulama ekranları"
        variant="list"
        items={copy.screens.map((screen) => {
          const Screen = screens[screen.id as ScreenId];
          return {
            id: screen.id,
            label: (
              <>
                <IconTile icon={screen.icon} tone={screen.tone} size={44} />
                <span className="mk-tab-text">
                  <span className="mk-tab-title">{screen.title}</span>
                  <span className="mk-tab-body">{screen.body}</span>
                </span>
              </>
            ),
            panel: (
              <PhoneFrame screen={screen.id as ScreenId} label={screen.title}>
                <Screen />
              </PhoneFrame>
            ),
          };
        })}
      />
    </Section>
  );
}
