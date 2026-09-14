"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  idleTalentPoolRemovalState,
  type TalentPoolPage,
  type TalentPoolRemovalAction,
} from "@/applications/employer-review";
import { ApplicantNameLink } from "@/components/applicant-name-link";
import { Avatar } from "@/components/ui";
import { formatDate, isFormattableDate } from "@/lib/dates";
import { errorPresentation } from "@/lib/errors";
import { talentPoolPath } from "@/lib/app-routes";

/**
 * Yetenek havuzunun liste ekranı.
 *
 * Sayfalama adres çubuğunda: burada uç **sayfalı**
 * (`EmployerToolsController.java:58`) ve her sayfa yeni bir istek, yani
 * bağlantı paylaşılabilir olmalı. Başvuru listesindeki tersine karar bu yüzden
 * ayrı — orada uç sayfasız ve dilimleme tarayıcıda yapılıyor.
 */
export function TalentPoolList({
  pool,
  action,
}: {
  pool: TalentPoolPage;
  action: TalentPoolRemovalAction;
}) {
  const [state, submit, pending] = useActionState(action, idleTalentPoolRemovalState);

  return (
    <div className="talent-pool-list">
      {state.status === "error" ? (
        <p role="alert" className="form-warning">
          {errorPresentation(state.errorCode, state.httpStatus).message}
        </p>
      ) : null}

      <ul className="talent-pool-entries" aria-label="Yetenek havuzu">
        {pool.content.map((entry) => (
          <li key={entry.id} className="talent-pool-entry">
            <Avatar name={entry.fullName || "?"} src={entry.profilePictureUrl} size="md" />
            <div className="talent-pool-entry-copy">
              {/*
                Ad aday dosyasına bağlı: havuz bir ilana bağlı değil, yani
                kartın altına dosya çizen başvuru ekranı burada yok; dosya
                sayfası (#166) o boşluğu kapatıyor. Kimlik UUID değilse düz ad.
              */}
              <strong>
                <ApplicantNameLink workerId={entry.workerId} name={entry.fullName || "Adı paylaşılmadı"} />
              </strong>
              {/*
                `dateTime` makineye ayrıştırılabilir bir tarih söz veriyor ve
                `createdAt` yanıtta eksikse boş dizeye düşüyor; o sözü
                tutamayacak değerde `<time>` hiç kurulmuyor.
              */}
              {isFormattableDate(entry.createdAt) ? (
                <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)} tarihinde eklendi</time>
              ) : null}
              {entry.note ? <p className="talent-pool-note">{entry.note}</p> : null}
            </div>
            <form action={submit}>
              <input type="hidden" name="workerId" value={entry.workerId} />
              <button className="button button-secondary button-small" disabled={pending}>
                Havuzdan çıkar
              </button>
            </form>
          </li>
        ))}
      </ul>

      {pool.totalPages > 1 ? (
        <nav className="application-pagination" aria-label="Havuz sayfaları">
          {pool.first ? <span /> : (
            <Link href={`${talentPoolPath}?sayfa=${pool.page}`}>Önceki sayfa</Link>
          )}
          <span>{`Sayfa ${pool.page + 1} / ${pool.totalPages}`}</span>
          {pool.last ? <span /> : (
            <Link href={`${talentPoolPath}?sayfa=${pool.page + 2}`}>Sonraki sayfa</Link>
          )}
        </nav>
      ) : null}
    </div>
  );
}
