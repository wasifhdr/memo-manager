"use client";

import { useId, useState, type ReactNode } from "react";

export type Tab = { key: string; label: string; content: ReactNode; count?: number };

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const id = useId();
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-(--border)">
        {tabs.map((tab) => {
          const selected = tab.key === activeTab?.key;
          return (
            <button
              key={tab.key}
              role="tab"
              id={`${id}-${tab.key}`}
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[0.8125rem] font-medium transition-colors ${
                selected ? "text-(--accent)" : "text-(--text-muted) hover:text-(--text)"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold ${
                    selected ? "bg-(--accent-tint) text-(--accent)" : "bg-(--surface-sunken) text-(--text-faint)"
                  }`}
                >
                  {tab.count}
                </span>
              ) : null}
              {selected ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-(--accent)" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-4">
        {activeTab?.content}
      </div>
    </div>
  );
}
