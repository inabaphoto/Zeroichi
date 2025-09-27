"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}

