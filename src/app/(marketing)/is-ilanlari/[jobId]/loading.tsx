import { LoadingState } from "@/components/states";

export default function Loading() {
  return (
    <section className="job-detail-state">
      <LoadingState label="İlan ayrıntısı yükleniyor" />
    </section>
  );
}
