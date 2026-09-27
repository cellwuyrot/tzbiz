import { useId, type ReactNode } from "react";

export function ArrowUpRight() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5.25 14.75 14.5 5.5M7.25 5.5h7.25v7.25" /></svg>;
}

export function MenuIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}

export function XIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

export function ChevronRight() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m7.25 4.5 5.5 5.5-5.5 5.5" /></svg>;
}

export function ChevronLeft() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12.75 4.5-5.5 5.5 5.5 5.5" /></svg>;
}

export function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 11v6M14 11v6M9 4h6l1 3H8l1-3ZM7 7l.8 13h8.4L17 7" /></svg>;
}

export function LockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><path d="M12 14v2.5"/></svg>;
}

export function LogoMark() {
  const id = useId();
  const gradientId = `${id.replace(/:/g, "")}-logo-gradient`;

  return (
    <svg
      aria-hidden="true"
      viewBox="160 170 700 610"
      className="brand-logo h-10 w-12 shrink-0"
      fill={`url(#${gradientId})`}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop className="brand-logo__stop brand-logo__stop--start" offset="0%" />
          <stop className="brand-logo__stop brand-logo__stop--mid" offset="52%" />
          <stop className="brand-logo__stop brand-logo__stop--end" offset="100%" />
        </linearGradient>
      </defs>
      <g transform="translate(0 1024) scale(0.1 -0.1)">
        <path d="M3383 8337 c-15 -25 -66 -118 -112 -208 l-84 -164 91 -145 c50 -80 107 -171 126 -202 l36 -58 1060 0 c583 0 1060 -3 1060 -7 0 -5 -36 -75 -81 -158 -44 -82 -150 -278 -234 -435 -397 -742 -525 -979 -710 -1318 -43 -78 -76 -144 -74 -146 2 -2 143 -1 312 3 l309 6 107 200 c59 110 197 362 306 560 108 198 225 412 260 475 34 63 113 207 175 320 61 113 144 264 183 335 38 72 77 138 85 148 14 15 39 17 246 17 l232 0 116 198 116 197 -19 35 c-11 19 -70 113 -132 209 l-112 175 -1617 4 -1617 4 -28 -45z" />
        <path d="M5367 5968 c-62 -108 -257 -476 -257 -487 0 -6 39 -75 87 -154 47 -78 114 -189 148 -247 34 -58 126 -211 205 -340 318 -521 753 -1246 757 -1261 4 -13 -63 -137 -222 -413 l-22 -39 130 -198 129 -198 232 6 c151 3 235 9 242 17 6 6 47 74 91 151 44 77 196 343 338 590 142 248 335 585 430 750 95 165 224 390 287 500 361 628 471 821 471 830 0 14 -212 367 -232 385 -14 13 -50 15 -254 10 l-239 -5 -264 -460 c-146 -253 -340 -590 -431 -750 -91 -159 -209 -364 -261 -454 l-96 -164 -20 26 c-12 15 -73 111 -135 214 -63 103 -178 292 -256 418 -78 127 -232 376 -342 555 -418 678 -470 760 -482 760 -5 0 -20 -19 -34 -42z" />
        <path d="M2188 5843 c-160 -3 -167 -4 -174 -25 -3 -11 -53 -118 -111 -237 -92 -190 -103 -218 -92 -236 7 -11 37 -63 67 -115 30 -52 157 -270 282 -485 237 -406 834 -1444 1030 -1790 62 -110 132 -231 155 -270 l41 -70 150 -3 c82 -2 190 0 239 3 l91 7 123 196 c122 195 122 197 108 227 -13 26 -588 1033 -926 1620 -82 143 -116 212 -108 216 7 3 154 9 327 13 701 15 1982 54 1989 61 2 3 -65 120 -150 261 l-153 257 -271 -7 c-586 -14 -1651 -36 -1854 -39 l-213 -2 -104 180 c-156 273 -132 245 -212 243 -37 -1 -142 -4 -234 -5z" />
      </g>
    </svg>
  );
}

const paths = [
  <><path d="M6 12h12"/><path d="M6 7h5"/><path d="M6 17h8"/><rect x="13" y="5" width="5" height="5" rx="1"/></>,
  <><circle cx="7" cy="7" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><path d="m8.7 8.2 6.6 2.6M15.8 13.7l-5 2.6"/></>,
  <><rect x="5" y="6" width="14" height="12" rx="2"/><path d="M8 10h8M8 14h5"/><circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/></>,
  <><path d="M5 17 9 13l3 3 7-8"/><path d="M15 8h4v4"/><circle cx="6" cy="18" r="1"/></>,
  <><path d="M6 6h12v12H6z"/><path d="M9 9h6v6H9z"/><path d="M3 9h3M18 9h3M3 15h3M18 15h3"/></>,
  <><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M8 9h8M8 12h5M8 15h8"/></>,
  <><path d="M5 18V8l7-3 7 3v10"/><path d="M9 15h6M12 9v3"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></>,
  <><path d="M6 6h12v12H6z"/><path d="M9 10h6M9 14h4"/><path d="M6 8H4M20 8h-2"/></>,
  <><rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 18v2M15 18v2M8 10h8M8 14h5"/></>,
  <><path d="M5 17V9l7-4 7 4v8"/><path d="M8 17v-5h8v5"/><path d="M10 17v-3h4v3"/></>,
  <><path d="M6 7h12v10H6z"/><path d="m8.5 9.5 3 2.5-3 2.5M13 14.5h3"/></>,
];

export function ServiceIcon({ index }: { index: number }) {
  const body: ReactNode = paths[index] ?? paths[0];
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{body}</svg>;
}
