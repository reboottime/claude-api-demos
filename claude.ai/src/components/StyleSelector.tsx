"use client";

import { useState, useRef, useEffect } from "react";
import { Style } from "@/db/schema";

type StyleSelectorProps = {
  styles: Style[];
  currentStyle: Style | null;
  onSelect: (style: Style | null) => void;
};

export function StyleSelector({
  styles,
  currentStyle,
  onSelect,
}: StyleSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        title="Response style"
      >
        {/* Style icon */}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        <span className="max-w-[100px] truncate">
          {currentStyle?.name || "Normal"}
        </span>
        {/* Chevron */}
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {/* Header */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              RESPONSE STYLE
            </p>
          </div>

          {/* Normal (no style) option */}
          <button
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
              !currentStyle ? "bg-zinc-100 dark:bg-zinc-700" : ""
            }`}
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Normal</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Default response style</p>
            </div>
            {!currentStyle && (
              <svg className="h-4 w-4 shrink-0 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />

          {/* Style list */}
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => {
                onSelect(style);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                currentStyle?.id === style.id ? "bg-zinc-100 dark:bg-zinc-700" : ""
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {style.name}
                </p>
                {style.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {style.description}
                  </p>
                )}
              </div>
              {currentStyle?.id === style.id && (
                <svg className="h-4 w-4 shrink-0 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
