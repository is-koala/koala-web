import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  notificationCategoryLabels,
  notificationCategoryValues,
  notificationChannelLabels,
  notificationChannelValues,
} from "./notification-labels";

/**
 * Bildirim kategorisi ve kanal listesinin backend sözleşmesine bağı
 * (is-koala/koala-web#198).
 *
 * Web listesi backend'den geride kaldığında tercih formu bilmediği değeri
 * gizli alana yazıyor, action onu reddediyor ve **her** kayıt düşüyordu.
 * `tests/contracts/notification-preferences.openapi.json` canlı
 * `/v3/api-docs`'tan alınmış enum parçası; web listeleri onunla birebir aynı
 * olmalı. Testler hermetik, ağa çıkmıyor; parçayı canlı sözleşmeye karşı
 * yeniden denetlemek için `KOALA_LIVE_CONTRACT=1` ile koşulur — backend yeni
 * bir değer eklediyse o koşu kırmızıya döner ve parça güncellenir.
 */

type EnumFragment = Record<string, Record<string, { enum: string[] }>>;

const contractPath = path.resolve(
  import.meta.dirname,
  "../../tests/contracts/notification-preferences.openapi.json",
);
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
  source: string;
  schemas: EnumFragment;
};

describe("bildirim tercihleri backend sözleşmesi", () => {
  it.each(Object.entries(contract.schemas))("%s kategorileri web listesiyle aynı", (_name, schema) => {
    expect([...notificationCategoryValues]).toEqual(schema.category.enum);
  });

  it.each(Object.entries(contract.schemas))("%s kanalları web listesiyle aynı", (_name, schema) => {
    expect([...notificationChannelValues]).toEqual(schema.channel.enum);
  });

  it("sözleşmedeki her değerin Türkçe etiketi var", () => {
    for (const category of notificationCategoryValues) {
      expect(notificationCategoryLabels[category], category).toMatch(/\S/);
    }
    for (const channel of notificationChannelValues) {
      expect(notificationChannelLabels[channel], channel).toMatch(/\S/);
    }
  });

  it.runIf(process.env.KOALA_LIVE_CONTRACT === "1")(
    "kayıtlı sözleşme parçası canlı backend ile aynı",
    async () => {
      const live = (await (await fetch(contract.source)).json()) as {
        components: { schemas: Record<string, { properties: Record<string, { enum?: string[] }> }> };
      };
      for (const [name, schema] of Object.entries(contract.schemas)) {
        for (const [field, { enum: values }] of Object.entries(schema)) {
          expect(live.components.schemas[name].properties[field].enum, `${name}.${field}`).toEqual(values);
        }
      }
    },
    30_000,
  );
});
