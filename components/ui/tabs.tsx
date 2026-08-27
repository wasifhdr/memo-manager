"use client";

import { useId, useState, type ReactNode } from "react";

export type Tab = { key: string; label: string; content: ReactNode; count?: number };

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const id = useId();
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const selected = tab.key === activeTab?.key;
          return (
            <button
              key={tab.key}
              role="tab"
              id={`${id}-${tab.key}`}
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-bold transition-colors duration-100 ${
                selected ? "bg-(--color-ink) text-(--color-paper)" : "text-(--color-ink)/70 hover:bg-(--color-cream)"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" ? (
                <span
                  className={`rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[0.6875rem] font-bold ${
                    selected ? "bg-(--color-paper)/20 text-(--color-paper)" : "bg-(--color-sand) text-(--color-ink)/70"
                  }`}
                >
                  {tab.count}
                </span>
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
