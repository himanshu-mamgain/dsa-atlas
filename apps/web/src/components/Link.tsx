import type { AnchorHTMLAttributes } from "react";
import { hrefFor, navigate, type Route } from "../router";

export function Link({ to, ...rest }: { to: Route } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const href = hrefFor(to);
  return (
    <a
      {...rest}
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
