import type { SVGProps } from "react";

export type CrmV3IconName = "day" | "deals" | "leads" | "activities" | "visits" | "sales" | "management" | "settings" | "matrix" | "search" | "plus" | "more" | "message" | "calendar" | "check" | "close" | "arrow" | "wifi" | "file" | "home" | "clock";

export function CrmV3Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: CrmV3IconName }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const path = name === "day" ? <><path d="M4 6h16M4 12h16M4 18h11"/><path d="m17 17 2 2 3-4"/></>
    : name === "deals" ? <path d="M3 4h18l-7 8v7l-4 2v-9Z"/>
    : name === "leads" ? <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M17 7h4M19 5v4"/></>
    : name === "activities" ? <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 2 2 2-3M3 12l2 2 2-3M3 18l2 2 2-3"/></>
    : name === "visits" || name === "home" ? <><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>
    : name === "sales" ? <><path d="M4 18V9m6 9V5m6 13v-7m4 7H2"/></>
    : name === "management" ? <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M3 21h19"/></>
    : name === "settings" ? <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1A8 8 0 0 0 15 6l-.3-2.5h-4L10.4 6a8 8 0 0 0-1.6 1L6.5 6 4.5 9.5 6.6 11a7 7 0 0 0 0 2L4.5 14.5l2 3.5 2.3-1a8 8 0 0 0 1.6 1l.3 2.5h4L15 18a8 8 0 0 0 1.6-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z"/></>
    : name === "matrix" ? <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>
    : name === "search" ? <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>
    : name === "plus" ? <path d="M12 5v14M5 12h14"/>
    : name === "more" ? <><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></>
    : name === "message" ? <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/>
    : name === "calendar" ? <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>
    : name === "check" ? <path d="m5 12 4 4L19 6"/>
    : name === "close" ? <path d="m6 6 12 12M18 6 6 18"/>
    : name === "arrow" ? <path d="m9 18 6-6-6-6"/>
    : name === "wifi" ? <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/></>
    : name === "file" ? <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></>
    : <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>;
  return <svg width="18" height="18" {...common} {...props}>{path}</svg>;
}

