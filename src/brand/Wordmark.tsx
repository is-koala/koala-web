import Link from "next/link";

export function Wordmark() {
  return (
    <Link className="wordmark" href="/" aria-label="Koala ana sayfa">
      Koala<span aria-hidden="true">.</span>
    </Link>
  );
}
