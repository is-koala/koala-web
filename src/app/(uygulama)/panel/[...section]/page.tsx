import { ShellSection } from "../../shell";

export default function Page({ params }: { params: Promise<{ section: string[] }> }) {
  return <ShellSection shell="worker" params={params} />;
}
