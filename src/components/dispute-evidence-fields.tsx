import { disputeEvidenceLimits } from "@/assignments/resolution";

export function DisputeEvidenceFields({
  id,
  label,
  required = false,
}: {
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name="evidence"
        type="file"
        accept={disputeEvidenceLimits.acceptedExtensions
          .map((extension) => `.${extension}`)
          .join(",")}
        required={required}
      />
      <p className="field-hint">
        Her yüklemede 1 dosya; uyuşmazlığa toplam 5 dosya ekleyebilirsiniz. PDF, PNG, JPG veya WEBP. Dosya en fazla 10 MB olabilir.
      </p>
    </div>
  );
}

export function selectedDisputeEvidence(form: HTMLFormElement): File[] {
  const input = form.elements.namedItem("evidence");
  return input instanceof HTMLInputElement ? Array.from(input.files ?? []) : [];
}
