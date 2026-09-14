import type { SVGProps } from "react";

/**
 * Tanıtım sitesinin ikon seti: 24px ızgara, 1,5px yuvarlak uçlu çizgi.
 *
 * Tasarım sistemi Hugeicons'ın stroke-rounded ailesini kullanıyor; o font
 * yalnız CDN'den geliyor ve sayfaya üçüncü taraf bir stil dosyası sokardı.
 * Buradaki yollar aynı ızgara ve çizgi kalınlığında elle çizildi; satır içi
 * SVG olduğu için ek istek yok ve `currentColor` ile rengini yazıdan alıyor.
 */
const paths = {
  mail: "M3 7.5C3 6.4 3.9 5.5 5 5.5h14c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-9Zm0 .5 7.9 5.3c.7.4 1.5.4 2.2 0L21 8",
  mobile: "M8 3.5h8c1.1 0 2 .9 2 2v13c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2v-13c0-1.1.9-2 2-2Zm2.5 13.5h3",
  pin: "M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2",
  touch: "M9 11.5V5.5a2 2 0 1 1 4 0v5m0-2a2 2 0 1 1 4 0v3m0-1.5a2 2 0 1 1 4 0v4.5c0 3.3-2.7 6-6 6h-2.2c-1.6 0-3.1-.6-4.2-1.8L4.3 14.4a1.8 1.8 0 0 1 2.6-2.5L9 14",
  shield: "M12 3 5 6v5.5c0 4.3 3 8.1 7 9.5 4-1.4 7-5.2 7-9.5V6l-7-3Zm-3 9 2 2 4-4.5",
  money: "M9.5 3.5h5l1.5 3h-8l1.5-3Zm-3 5h11c1.9 1.7 3 4 3 6.3 0 3.4-3.1 5.7-8.5 5.7S3.5 18.2 3.5 14.8c0-2.3 1.1-4.6 3-6.3Zm5.5 3v6m2-4.7c-.4-.6-1.1-.9-2-.9-1.1 0-2 .6-2 1.4 0 1.8 4 1 4 2.8 0 .8-.9 1.4-2 1.4-.9 0-1.7-.4-2-1",
  calendar: "M4 8.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-10Zm0 3h16M8 4v4m8-4v4",
  star: "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5Z",
  navigation: "m4.5 11.2 14.2-6.7c.6-.3 1.2.3.9.9l-6.7 14.2c-.3.7-1.3.6-1.5-.1l-1.7-5.6a1 1 0 0 0-.6-.6l-5.6-1.7c-.7-.2-.8-1.2-.1-1.5Z",
  file: "M7 3.5h6.6L19 8.9v9.6c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2v-13c0-1.1.9-2 2-2Zm6 0v5.5h5.5M8.5 13h7m-7 3.5h5",
  briefcase: "M4 9.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-8Zm5-2v-2c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v2M4 13h16",
  chat: "M12 4c-4.7 0-8.5 3.1-8.5 7 0 1.6.6 3 1.7 4.2L4.5 19l4-1.4c1.1.4 2.3.6 3.5.6 4.7 0 8.5-3.1 8.5-7S16.7 4 12 4Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.6-3.4 3.4-5.5 7-5.5s6.4 2.1 7 5.5",
  plus: "M12 5v14M5 12h14",
  users: "M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c.5-3 3-4.8 6.5-4.8S15.5 17 16 20m-1-8.6a3 3 0 1 0 0-6M21 19c-.3-2.3-1.6-3.8-3.8-4.3",
  chart: "M4 19.5h16M6.5 15.5l3.5-4 3 2.5 4.5-6M17.5 8h-3m3 0v3",
  check: "m5 12.5 4.5 4.5L19 7.5",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  search: "M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2.1.9-.8-1-3.1-1.2.1a7 7 0 0 0-1-1.6l.4-1.1L15 4.5l-.8.9a7 7 0 0 0-1.9-.3L11.7 4 8.6 5l.1 1.2a7 7 0 0 0-1.6 1l-1.1-.4L4.5 9l.9.8a7 7 0 0 0-.3 1.9L4 12.3 5 15.4l1.2-.1a7 7 0 0 0 1 1.6l-.4 1.1L9 19.5l.8-.9a7 7 0 0 0 1.9.3l.6 1.1 3.1-1-.1-1.2a7 7 0 0 0 1.6-1l1.1.4 1.5-2.2-.9-.8a7 7 0 0 0 .3-1.9Z",
  building: "M5 20.5v-15c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v15m0-9h3c.6 0 1 .4 1 1v8M3 20.5h18M8.5 7.5h3m-3 3.5h3m-3 3.5h3",
  quill: "M19.5 4.5c-6 0-11 3.5-12.5 9.5-.4 1.6-.5 3.2-.5 5.5m0 0c3-4.5 6-7 9.5-9m-9.5 9c4.5 0 8.4-2.2 10.6-6.4 1-1.9 1.9-4.6 2.4-8.6",
  chevronDown: "m6 9.5 6 6 6-6",
  signal: "M4 17.5h2m3 0v-4m4 4v-7m4 7V7.5m4 10V4.5",
  wifi: "M2.5 9.5C8 5 16 5 21.5 9.5M5.5 13c4-3.3 9-3.3 13 0M8.5 16.3c2.1-1.7 4.9-1.7 7 0M12 19.5h.01",
  battery: "M3 9.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v5c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-5Zm18 1.5v2M6 10.5h7v3H6v-3Z",
  bookmark: "M7 4.5h10c.6 0 1 .4 1 1v14l-6-3.5L6 19.5v-14c0-.6.4-1 1-1Z",
  home: "M4 11 12 4l8 7v8c0 .6-.4 1-1 1h-4.5v-6h-5v6H5c-.6 0-1-.4-1-1v-8Z",
  menu: "M4 7h16M4 12h16M4 17h16",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  className,
  ...rest
}: { name: IconName; size?: number; className?: string } & Omit<
  SVGProps<SVGSVGElement>,
  "name" | "width" | "height"
>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
