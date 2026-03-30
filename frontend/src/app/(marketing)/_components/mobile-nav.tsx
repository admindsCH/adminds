"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

interface MobileNavProps {
  links: { href: string; label: string }[];
}

export default function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors"
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-xl flex flex-col">
          <div className="flex justify-end px-6 py-4">
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex flex-col items-center justify-center flex-1 gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-lg text-zinc-700 hover:text-indigo-600 transition-colors"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#demo"
              onClick={() => setOpen(false)}
              className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Demander un accès
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}
