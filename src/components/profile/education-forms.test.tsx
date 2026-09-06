import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EducationCreator } from "./education-forms";

const referenceActions = vi.hoisted(() => ({
  loadFacultiesAction: vi.fn(),
  loadDepartmentsAction: vi.fn(),
}));

vi.mock("@/app/(uygulama)/panel/profil/education-actions", async (importOriginal) => ({
  ...(await importOriginal()),
  ...referenceActions,
}));

const universityOne = "11111111-1111-4111-8111-111111111111";
const universityTwo = "22222222-2222-4222-8222-222222222222";
const facultyOne = "33333333-3333-4333-8333-333333333333";
const facultyTwo = "44444444-4444-4444-8444-444444444444";

describe("eğitim referans seçimleri", () => {
  beforeEach(() => {
    referenceActions.loadFacultiesAction.mockReset();
    referenceActions.loadDepartmentsAction.mockReset();
  });

  it("önceki üniversitenin geç gelen fakültelerini güncel seçime yazmaz", async () => {
    const user = userEvent.setup();
    const first = deferred<ReferenceResult>();
    const second = deferred<ReferenceResult>();
    referenceActions.loadFacultiesAction.mockImplementation((id: string) =>
      id === universityOne ? first.promise : second.promise,
    );

    renderEducationCreator();
    const university = screen.getByLabelText("Üniversite");
    await user.selectOptions(university, universityOne);
    await user.selectOptions(university, universityTwo);

    await act(async () => {
      second.resolve(done(facultyTwo, "İkinci fakülte"));
      await second.promise;
    });
    expect(await screen.findByRole("option", { name: "İkinci fakülte" })).toBeInTheDocument();

    await act(async () => {
      first.resolve(done(facultyOne, "Eski fakülte"));
      await first.promise;
    });
    expect(screen.queryByRole("option", { name: "Eski fakülte" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "İkinci fakülte" })).toBeInTheDocument();
  });

  it("önceki fakültenin geç gelen bölümlerini güncel seçime yazmaz", async () => {
    const user = userEvent.setup();
    const first = deferred<ReferenceResult>();
    const second = deferred<ReferenceResult>();
    referenceActions.loadFacultiesAction.mockResolvedValue({
      status: "done",
      items: [
        { id: facultyOne, name: "Birinci fakülte" },
        { id: facultyTwo, name: "İkinci fakülte" },
      ],
    });
    referenceActions.loadDepartmentsAction.mockImplementation((id: string) =>
      id === facultyOne ? first.promise : second.promise,
    );

    renderEducationCreator();
    await user.selectOptions(screen.getByLabelText("Üniversite"), universityOne);
    const faculty = await screen.findByLabelText("Fakülte");
    await user.selectOptions(faculty, facultyOne);
    await user.selectOptions(faculty, facultyTwo);

    await act(async () => {
      second.resolve(done("55555555-5555-4555-8555-555555555555", "İkinci bölüm"));
      await second.promise;
    });
    expect(await screen.findByRole("option", { name: "İkinci bölüm" })).toBeInTheDocument();

    await act(async () => {
      first.resolve(done("66666666-6666-4666-8666-666666666666", "Eski bölüm"));
      await first.promise;
    });
    expect(screen.queryByRole("option", { name: "Eski bölüm" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "İkinci bölüm" })).toBeInTheDocument();
  });
});

type ReferenceResult = { status: "done"; items: readonly { id: string; name: string }[] };

function renderEducationCreator() {
  render(
    <EducationCreator
      universities={[
        { id: universityOne, name: "Birinci üniversite" },
        { id: universityTwo, name: "İkinci üniversite" },
      ]}
    />,
  );
}

function done(id: string, name: string): ReferenceResult {
  return { status: "done", items: [{ id, name }] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
