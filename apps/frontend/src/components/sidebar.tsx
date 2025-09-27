"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/tenant", label: "Tenant" },
  { href: "/apps", label: "Apps" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white p-4 sm:block">
      <div className="mb-4 text-sm font-semibold text-neutral-800">Zeroichi</div>
      <nav className="space-y-1 text-sm">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "block rounded px-3 py-2 transition " +
                (active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

