"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  addressErrorCodes,
  addressQueryLength,
  sessionRenewalMarginMs,
  type AddressCandidate,
  type AddressSearchSession,
  type AddressSuggestion,
} from "./contract";
import { AddressGatewayError, browserAddressGateway, type AddressGateway } from "./gateway-client";

/** Öneri listesinin üç ekran durumu artı ara adımlar (`AGENTS.md`). */
export type AddressSearchStatus = "idle" | "searching" | "ready" | "empty" | "resolving" | "error";

export type AddressSearchState = {
  status: AddressSearchStatus;
  suggestions: AddressSuggestion[];
  errorCode: string | null;
  httpStatus: number;
  /** Sağlayıcı düştüyse form kilitlenmez; kullanıcı elle doldurmaya geçer. */
  providerAvailable: boolean;
};

export type UseAddressSearchOptions = {
  gateway?: AddressGateway;
  /** Sağlayıcı çağrısı ücretli: her tuş vuruşu değil, duraklama aranır. */
  debounceMs?: number;
  onCandidateResolved?: (candidate: AddressCandidate) => void;
};

const idleState: AddressSearchState = {
  status: "idle",
  suggestions: [],
  errorCode: null,
  httpStatus: 0,
  providerAvailable: true,
};

/**
 * Adres arama oturumunun istemci tarafındaki ömrü.
 *
 * Backend oturumu iki şekilde tüketiyor: `expiresAt` geçtiğinde ve bir aday
 * çözümlendiğinde (`AddressSearchManager.resolve` oturumu tamamlanmış
 * işaretleyip siliyor). Kullanıcının bunu bilmesi gerekmiyor; oturum
 * gerektiğinde sessizce açılır, düştüğünde sessizce yeniden açılır ve yazdığı
 * sorgu kaybolmaz.
 */
export function useAddressSearch({
  gateway = browserAddressGateway,
  debounceMs = 350,
  onCandidateResolved,
}: UseAddressSearchOptions = {}) {
  const [state, setState] = useState<AddressSearchState>(idleState);

  const sessionRef = useRef<AddressSearchSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef("");
  // Yanıtlar yazma sırasına göre dönmüyor: geç dönen eski arama, yeni
  // sorgunun sonucunu ezmesin diye her istek kendi sürümüyle karşılaştırılır.
  const revisionRef = useRef(0);

  useEffect(() => () => clearTimer(timerRef), []);

  const runSearch = useCallback(
    async (query: string, revision: number) => {
      // Oturumun düşmesi kullanıcının hatası değil ve tek çaresi var: yeniden
      // açıp aynı sorguyu sormak. Bir kez denenir; döngü yerine sayılı tur
      // olması, ikinci kez düşen bir oturumda sonsuza dönmesini engelliyor.
      for (let attempt = 0; attempt <= 1; attempt += 1) {
        try {
          const session = await activeSession(gateway, sessionRef);
          if (revision !== revisionRef.current) return;

          const suggestions = await gateway.suggestions(session.id, query);
          if (revision !== revisionRef.current) return;

          setState({
            status: suggestions.length > 0 ? "ready" : "empty",
            suggestions,
            errorCode: null,
            httpStatus: 0,
            providerAvailable: true,
          });
          return;
        } catch (error) {
          if (revision !== revisionRef.current) return;

          if (isSessionGone(error) && attempt === 0) {
            sessionRef.current = null;
            continue;
          }

          setState({ status: "error", suggestions: [], ...failureOf(error) });
          return;
        }
      }
    },
    [gateway],
  );

  const search = useCallback(
    (rawQuery: string) => {
      const query = rawQuery.trim();
      queryRef.current = query;
      revisionRef.current += 1;
      clearTimer(timerRef);

      if (query.length < addressQueryLength.minimum) {
        setState((current) => ({ ...current, status: "idle", suggestions: [], errorCode: null }));
        return;
      }

      const revision = revisionRef.current;
      setState((current) => ({ ...current, status: "searching", errorCode: null }));
      timerRef.current = setTimeout(() => {
        void runSearch(query.slice(0, addressQueryLength.maximum), revision);
      }, debounceMs);
    },
    [debounceMs, runSearch],
  );

  const select = useCallback(
    async (suggestion: AddressSuggestion): Promise<AddressCandidate | null> => {
      const session = sessionRef.current;
      if (!session) return null;

      clearTimer(timerRef);
      revisionRef.current += 1;
      setState((current) => ({ ...current, status: "resolving", errorCode: null }));

      try {
        const candidate = await gateway.resolve(session.id, suggestion.id);
        // Çözümleme oturumu backend'de tüketiyor; elde tutmak sonraki
        // aramanın 400 almasını garanti ederdi.
        sessionRef.current = null;
        queryRef.current = "";
        setState(idleState);
        onCandidateResolved?.(candidate);
        return candidate;
      } catch (error) {
        if (isSessionGone(error)) sessionRef.current = null;
        setState({ status: "error", suggestions: [], ...failureOf(error) });
        return null;
      }
    },
    [gateway, onCandidateResolved],
  );

  /** Kullanıcı "yeniden dene" dediğinde: oturumu tazeleyip son sorguyu sorar. */
  const retry = useCallback(() => {
    sessionRef.current = null;
    setState(idleState);
    search(queryRef.current);
  }, [search]);

  return { ...state, search, select, retry };
}

async function activeSession(
  gateway: AddressGateway,
  sessionRef: { current: AddressSearchSession | null },
): Promise<AddressSearchSession> {
  const current = sessionRef.current;
  if (current && Date.parse(current.expiresAt) > Date.now() + sessionRenewalMarginMs) {
    return current;
  }

  const opened = await gateway.startSession();
  sessionRef.current = opened;
  return opened;
}

/** Oturum ya da aday artık backend'de yok; ikisi de yeniden açmayı gerektirir. */
function isSessionGone(error: unknown): boolean {
  return (
    error instanceof AddressGatewayError &&
    (error.errorCode === addressErrorCodes.sessionInvalid ||
      error.errorCode === addressErrorCodes.candidateInvalid)
  );
}

function failureOf(error: unknown) {
  const gatewayError = error instanceof AddressGatewayError ? error : null;
  return {
    errorCode: gatewayError?.errorCode ?? "UNEXPECTED",
    httpStatus: gatewayError?.httpStatus ?? 500,
    providerAvailable: gatewayError?.errorCode !== addressErrorCodes.providerUnavailable,
  };
}

function clearTimer(timerRef: { current: ReturnType<typeof setTimeout> | null }) {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = null;
}
