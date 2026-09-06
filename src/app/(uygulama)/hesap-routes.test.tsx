import { describe, expect, it, vi } from "vitest";

import EmployerAccountPage from "./isveren/hesap/page";
import WorkerAccountPage from "./panel/hesap/page";

const accountPage = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("./hesap-page", () => ({ AccountPage: accountPage }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));

describe("hesap route kapıları", () => {
  it.each([
    ["worker", "/panel/hesap", WorkerAccountPage],
    ["employer", "/isveren/hesap", EmployerAccountPage],
  ] as const)("%s hesabını kendi ShellGate kapısıyla sarar", (shell, href, Page) => {
    const searchParams = Promise.resolve({ bildirimSayfasi: "2" });
    const route = (Page as (props: { searchParams: typeof searchParams }) => ReturnType<typeof Page>)(
      { searchParams },
    );

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell, href });
    expect(route.props.children.type).toBe(accountPage);
    expect(route.props.children.props.searchParams).toBe(searchParams);
  });
});
