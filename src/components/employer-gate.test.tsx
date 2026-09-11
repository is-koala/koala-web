import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmployerGate, GateAdvisories, GateBlocks } from "./employer-gate";

describe("yetki kapısı bileşeni", () => {
  it("kapı açıkken eylemi olduğu gibi çizer", () => {
    render(
      <EmployerGate blocked={[]} action="İlan aç">
        <button type="button">İlan aç</button>
      </EmployerGate>,
    );

    expect(screen.getByRole("button", { name: "İlan aç" })).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("engelleyici kapıda eylemi devre dışı gösterir ve nedenini yazar", () => {
    // "Butonu gizledik" değil: kullanıcı neyi yapamadığını ve niçin
    // yapamadığını görmeli, yoksa eksik ekranı bir arıza gibi okur.
    render(
      <EmployerGate blocked={["companyApproval"]} action="İlan aç">
        <button type="button">İlan aç</button>
      </EmployerGate>,
    );

    const blocked = screen.getByRole("button", { name: "İlan aç" });
    expect(blocked).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Şirketin henüz onaylanmadı");
  });

  it("engellenen eylemin kendi içeriğini hiç çizmez", () => {
    // Devre dışı bir form yine de gönderilebilir; eylemin kendisi ekrana
    // girmemeli.
    render(
      <EmployerGate blocked={["employerRole"]} action="İlan aç">
        <button type="button">Gerçek eylem</button>
      </EmployerGate>,
    );

    expect(screen.queryByRole("button", { name: "Gerçek eylem" })).toBeNull();
  });

  it("birden çok engelin hepsini yazar", () => {
    render(
      <EmployerGate blocked={["employerRole", "identityNumber"]} action="Ödemeyi başlat">
        <button type="button">Ödemeyi başlat</button>
      </EmployerGate>,
    );

    expect(screen.getByText("Bu hesap işveren hesabı değil")).toBeVisible();
    expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil")).toBeVisible();
  });

  it("uyarı şeridi kalıcıdır ama hiçbir şeyi kapatmaz", () => {
    // Advisory kip kabuğu kullanılabilir bırakıyor: kullanıcı doğrulamayı
    // bitirmeden de gezinebilmeli.
    render(<GateAdvisories gates={["identityVerification"]} />);

    const strip = screen.getByRole("status");
    expect(strip).toHaveTextContent("Kimliğini doğrulaman gerekiyor");
    expect(screen.getByRole("link", { name: "Uygulamada doğrula" })).toHaveAttribute(
      "href",
      "/kimlik-dogrula",
    );
  });

  it("kimlik kapısına dönüş yolunu next olarak yazar", () => {
    render(
      <EmployerGate blocked={["identityVerification"]} action="İlan aç" returnPath="/isveren/ilan/yeni">
        <button type="button">İlan aç</button>
      </EmployerGate>,
    );

    expect(screen.getByRole("link", { name: "Uygulamada doğrula" })).toHaveAttribute(
      "href",
      "/kimlik-dogrula?next=%2Fisveren%2Filan%2Fyeni",
    );
  });

  it("karşılanmamış kapı yoksa şerit hiç çizilmez", () => {
    const { container } = render(<GateAdvisories gates={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("eylemsiz engel", () => {
  it("devre dışı bırakılacak bir düğme yokken nedeni yine de yazar", () => {
    // Bölümler sırayla açılıyor: bugün ekranda kapatılacak bir düğme yok ama
    // kullanıcı yolun kendisine kapalı olduğunu okumalı.
    render(<GateBlocks gates={["employerRole"]} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Bu hesap işveren hesabı değil");
  });

  it("engel yoksa hiç çizilmez", () => {
    const { container } = render(<GateBlocks gates={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
