export type GeolocationAccess = {
  secure: boolean;
  getCurrentPosition:
    | ((
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
        failure?: (error: { code: number }) => void,
        options?: PositionOptions,
      ) => void)
    | null;
};

export type LocationCapture =
  | { status: "located"; point: { latitude: number; longitude: number } }
  | {
      status: "unavailable";
      reason: "denied" | "insecure" | "unsupported" | "failed";
      point: null;
    };

/** Tek kullanıcı hareketi için tek bir best-effort konum okuması. */
export async function captureCheckpointLocation(
  access: GeolocationAccess = browserGeolocationAccess(),
): Promise<LocationCapture> {
  if (!access.secure) return unavailable("insecure");
  if (!access.getCurrentPosition) return unavailable("unsupported");

  return new Promise((resolve) => {
    try {
      access.getCurrentPosition?.(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (
            Number.isFinite(latitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            Number.isFinite(longitude) &&
            longitude >= -180 &&
            longitude <= 180
          ) {
            resolve({ status: "located", point: { latitude, longitude } });
          } else {
            resolve(unavailable("failed"));
          }
        },
        (error) => resolve(unavailable(error.code === 1 ? "denied" : "failed")),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
      );
    } catch {
      resolve(unavailable("failed"));
    }
  });
}

function browserGeolocationAccess(): GeolocationAccess {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { secure: false, getCurrentPosition: null };
  }
  return {
    secure: window.isSecureContext,
    getCurrentPosition: navigator.geolocation?.getCurrentPosition.bind(
      navigator.geolocation,
    ) ?? null,
  };
}

function unavailable(reason: Exclude<LocationCapture, { status: "located" }>["reason"]) {
  return { status: "unavailable", reason, point: null } as const;
}
