"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceTabs({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const base = `/app/w/${workspaceId}`;
  const tabs = [
    { href: base, label: "Documents", active: pathname === base || pathname.startsWith(`${base}/d/`) },
    { href: `${base}/ask`, label: "Ask", active: pathname.startsWith(`${base}/ask`) },
    { href: `${base}/reports`, label: "Reports", active: pathname.startsWith(`${base}/reports`) },
  ];
  return (
    <nav aria-label="Workspace" className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            t.active ? "border-accent text-accent" : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
