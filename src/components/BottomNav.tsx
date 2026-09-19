"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Dashboard", icon: "◧" },
  { href: "/chain", label: "Chain", icon: "≣" },
  { href: "/ai", label: "AI", icon: "✦" },
  { href: "/trade", label: "Trade", icon: "⇅" },
  { href: "/positions", label: "Positions", icon: "▤" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] bg-panel border-t border-line flex">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              active ? "text-signal" : "text-sub"
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
