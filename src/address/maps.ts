import { clampToServiceArea, type Coordinates } from "./contract";

const mapsJavaScriptEndpoint = "https://maps.googleapis.com/maps/api/js";

export type MapAttachOptions = {
  center: Coordinates;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  bounds: { south: number; west: number; north: number; east: number };
  onIdle: (center: Coordinates) => void;
};

export type MapHandle = {
  getCenter(): Coordinates;
  destroy(): void;
};

export type MapSurface = {
  attach(element: HTMLElement, options: MapAttachOptions): MapHandle;
};

export type LoadMap = (key: string) => Promise<MapSurface>;

/**
 * Maps JavaScript betiğinin adresi.
 *
 * `libraries` parametresi yok: Places/Geocoding tarayıcı anahtarına
 * bağlanırsa referrer kısıtı sunucu API'lerini açardı (`README.md`).
 */
export function mapsJavaScriptUrl(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  const params = new URLSearchParams({
    key: trimmed,
    v: "weekly",
    loading: "async",
  });
  return `${mapsJavaScriptEndpoint}?${params}`;
}

export function googleMapsJavaScriptKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY?.trim() ?? "";
}

export async function loadGoogleMaps(key: string): Promise<MapSurface> {
  const url = mapsJavaScriptUrl(key);
  if (!url) throw new Error("Maps JavaScript anahtarı yok.");
  await injectMapsScript(url);
  return googleMapSurface();
}

function googleMapSurface(): MapSurface {
  return {
    attach(element, options) {
      const maps = googleMapsApi();
      const map = new maps.Map(element, {
        center: { lat: options.center.latitude, lng: options.center.longitude },
        zoom: options.zoom,
        minZoom: options.minZoom,
        maxZoom: options.maxZoom,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        restriction: {
          latLngBounds: {
            south: options.bounds.south,
            west: options.bounds.west,
            north: options.bounds.north,
            east: options.bounds.east,
          },
          strictBounds: true,
        },
      });

      const listener = map.addListener("idle", () => {
        const center = map.getCenter();
        if (!center) return;
        options.onIdle(
          clampToServiceArea({ latitude: center.lat(), longitude: center.lng() }),
        );
      });

      return {
        getCenter() {
          const center = map.getCenter();
          return clampToServiceArea({
            latitude: center?.lat() ?? options.center.latitude,
            longitude: center?.lng() ?? options.center.longitude,
          });
        },
        destroy() {
          maps.event.removeListener(listener);
        },
      };
    },
  };
}

function googleMapsApi() {
  const maps = (window as GoogleMapsHost).google?.maps;
  if (!maps) throw new Error("Maps JavaScript API yüklenemedi.");
  return maps;
}

function injectMapsScript(url: string): Promise<void> {
  if ((window as GoogleMapsHost).google?.maps) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Maps JavaScript yüklenemedi.")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Maps JavaScript yüklenemedi."));
    document.head.appendChild(script);
  });
}

type GoogleMapsHost = Window & {
  google?: {
    maps?: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => {
        getCenter(): { lat(): number; lng(): number } | undefined;
        addListener(event: string, handler: () => void): { remove?: () => void };
      };
      event: { removeListener(listener: unknown): void };
    };
  };
};
