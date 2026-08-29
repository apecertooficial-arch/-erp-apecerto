import type { AnchorHTMLAttributes, ReactNode } from "react";

export default function Link({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return <a {...props} href={href} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, "", href);
    window.dispatchEvent(new Event("crm:harness:navigate"));
  }}>{children}</a>;
}
