"use client";

import { useState } from "react";

import type { WorkDetail, WorkDetailCommand } from "@/assignments/work-detail";
import { formatMoney } from "@/lib/money";
import {
  formatStopTime,
  seatFor,
  seatsLeft,
  shuttlesFor,
  stopDirectionsUrl,
  transportDirectionLabels,
  transportDirections,
  transportMethodLabels,
  type AssignmentTransport,
  type Shuttle,
  type TransportDirection,
} from "@/transport/contract";

/**
 * Çalışanın "Ulaşım" kartı (is-koala/koala-web#187, backend 0.9.28).
 *
 * Yön başına tek koltuk: işçi servis + durak seçer, seçim o yöndeki
 * öncekinin yerine geçer. Plaka ve şoför yalnız koltuk seçilen serviste
 * **geliyor** — sunucu öbürlerinde alanı `null` bırakıyor ve kart geleni
 * yazıyor, kendisi gizlemiyor. Durağın tam adresi ve yol tarifi bağlantısı
 * (#178 kararı: harici haritaya derin bağlantı, toplu taşıma) yalnız seçili
 * durakta; ötekilerde durak adı ve saat.
 *
 * Seçim öbür komutlarla aynı kanaldan (`onCommand`) gidiyor: ekranın tamamı
 * sunucu gerçeğiyle tazeleniyor ve 409'da (`TRANSPORT_SHUTTLE_FULL`,
 * `TRANSPORT_SEAT_ALREADY_TAKEN`) güncel doluluk görünüyor.
 *
 * Koltuk seçimi yalnız PENDING_CONFIRMATION/CONFIRMED/IN_PROGRESS atamada;
 * öbürlerinde kart salt okunur ve seçim düğmesi çizilmiyor.
 */
export function WorkTransport({
  detail,
  pending,
  onCommand,
}: {
  detail: WorkDetail;
  pending: boolean;
  onCommand: (command: WorkDetailCommand) => Promise<unknown>;
}) {
  const transport = detail.transport;
  if (transport === null) return null;
  const canSelect = seatSelectableStatuses.has(detail.assignment.status);

  return (
    <section className="work-detail-section work-transport" aria-labelledby="work-transport-heading" data-testid="work-transport">
      <h2 id="work-transport-heading">Ulaşım</h2>
      {transport.notes ? <p className="work-transport-notes">{transport.notes}</p> : null}
      {transportDirections.map((direction) => (
        <DirectionBlock
          key={direction}
          direction={direction}
          transport={transport}
          canSelect={canSelect}
          pending={pending}
          onCommand={onCommand}
        />
      ))}
    </section>
  );
}

const seatSelectableStatuses: ReadonlySet<string> = new Set([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
]);

function DirectionBlock({
  direction,
  transport,
  canSelect,
  pending,
  onCommand,
}: {
  direction: TransportDirection;
  transport: AssignmentTransport;
  canSelect: boolean;
  pending: boolean;
  onCommand: (command: WorkDetailCommand) => Promise<unknown>;
}) {
  const method = direction === "OUTBOUND" ? transport.outboundMethod : transport.returnMethod;
  const shuttles = shuttlesFor(transport.shuttles, direction);
  const seat = seatFor(transport, direction);

  return (
    <div className="work-transport-direction" data-testid={`work-transport-${direction}`}>
      <h3>{transportDirectionLabels[direction]}</h3>
      {method === "CASH_ALLOWANCE" ? (
        <p>
          <strong>Yol parası</strong>
          {transport.allowanceAmount !== null
            ? `: ${formatMoney(transport.allowanceAmount, "TRY")}`
            : ""}
          {transport.allowanceNote ? <span className="muted"> · {transport.allowanceNote}</span> : null}
          <span className="muted"> — işveren elden verir.</span>
        </p>
      ) : method === "SHUTTLE" ? (
        shuttles.length === 0 ? (
          <p className="muted">Servis bilgisi henüz girilmedi.</p>
        ) : (
          <ShuttleChoice
            direction={direction}
            shuttles={shuttles}
            seat={seat}
            canSelect={canSelect}
            pending={pending}
            onCommand={onCommand}
          />
        )
      ) : (
        <p className="muted">{transportMethodLabels[method]}</p>
      )}
    </div>
  );
}

function ShuttleChoice({
  direction,
  shuttles,
  seat,
  canSelect,
  pending,
  onCommand,
}: {
  direction: TransportDirection;
  shuttles: readonly Shuttle[];
  seat: { shuttleId: string; stopId: string } | null;
  canSelect: boolean;
  pending: boolean;
  onCommand: (command: WorkDetailCommand) => Promise<unknown>;
}) {
  const [choice, setChoice] = useState<{ shuttleId: string; stopId: string } | null>(null);
  // Seçim durumu sunucudan gelen koltuk; kullanıcının henüz kaydetmediği
  // tıklaması onun üstüne biniyor ve kaydedilince sunucu değeri geri alıyor.
  const selected = choice ?? seat;
  const changed =
    selected !== null && (selected.shuttleId !== seat?.shuttleId || selected.stopId !== seat?.stopId);
  const groupName = `seat-${direction}`;

  return (
    <div className="work-transport-shuttles">
      {seat === null && canSelect ? (
        <p className="muted">Henüz durak seçmedin; bineceğin durağı seç.</p>
      ) : null}
      {shuttles.map((shuttle) => {
        const mine = seat?.shuttleId === shuttle.id;
        const left = seatsLeft(shuttle);
        return (
          <fieldset
            key={shuttle.id}
            className="work-transport-shuttle"
            data-selected={mine ? "true" : undefined}
            data-testid="work-transport-shuttle"
          >
            <legend>
              {shuttle.name}
              <span className="muted">
                {" "}· {left > 0 ? `${left} boş koltuk` : "dolu"}
              </span>
            </legend>
            {/*
              Plaka ve şoför yalnız sunucunun doldurduğu serviste; başka
              serviste alan `null` geliyor ve satır hiç çizilmiyor.
            */}
            {shuttle.plate || shuttle.driverName || shuttle.driverPhone ? (
              <dl className="work-transport-facts">
                {shuttle.plate ? <div><dt>Plaka</dt><dd>{shuttle.plate}</dd></div> : null}
                {shuttle.driverName ? <div><dt>Şoför</dt><dd>{shuttle.driverName}</dd></div> : null}
                {shuttle.driverPhone ? (
                  <div>
                    <dt>Şoför telefonu</dt>
                    <dd><a className="text-link" href={`tel:${shuttle.driverPhone.replace(/\s+/g, "")}`}>{shuttle.driverPhone}</a></dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <ul className="work-transport-stops">
              {shuttle.stops.map((stop) => {
                const isMine = mine && seat?.stopId === stop.id;
                const isSelected = selected?.shuttleId === shuttle.id && selected.stopId === stop.id;
                const full = left === 0 && !mine;
                return (
                  <li key={stop.id} className="work-transport-stop" data-mine={isMine ? "true" : undefined}>
                    {canSelect ? (
                      <label>
                        <input
                          type="radio"
                          name={groupName}
                          value={`${shuttle.id}:${stop.id}`}
                          checked={isSelected}
                          disabled={pending || full}
                          onChange={() => setChoice({ shuttleId: shuttle.id, stopId: stop.id })}
                        />{" "}
                        <StopLine stop={stop} />
                      </label>
                    ) : (
                      <StopLine stop={stop} />
                    )}
                    {/*
                      Tam adres her durakta: işçi durağı adresine göre seçiyor
                      ve sunucu işçi görünümünde adresi zaten veriyor. Yol
                      tarifi yalnız seçili durakta — tek bir hedef.
                    */}
                    {stop.address?.displayAddress ? (
                      <address className="work-transport-address">{stop.address.displayAddress}</address>
                    ) : null}
                    {isMine ? (
                      <div className="work-transport-mine">
                        <span className="badge">Seçtiğin durak</span>
                        {stop.address?.position ? (
                          <a
                            className="text-link"
                            href={stopDirectionsUrl(stop.address.position)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Yol tarifi al
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
      {canSelect ? (
        <button
          type="button"
          className="button button-primary button-small"
          disabled={pending || !changed}
          onClick={() => {
            if (!selected) return;
            void onCommand({ type: "seat", shuttleId: selected.shuttleId, stopId: selected.stopId }).then(
              () => setChoice(null),
            );
          }}
        >
          {seat === null ? "Koltuğu seç" : "Koltuğu değiştir"}
        </button>
      ) : null}
    </div>
  );
}

function StopLine({ stop }: { stop: Shuttle["stops"][number] }) {
  return (
    <span className="work-transport-stop-line">
      <time dateTime={stop.scheduledAt}>{formatStopTime(stop.scheduledAt)}</time>
      {" · "}
      {stop.label ?? "Durak"}
    </span>
  );
}
