"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const BOARDSIGNAL_THEME_STORAGE_KEY = "boardsignal:theme";
export const BOARDSIGNAL_THEME_CHANGE_EVENT = "boardsignal:theme-change";

export type BoardSignalThemeChoice = "light" | "dark" | "system";

function isThemeChoice(value: string | null | undefined): value is BoardSignalThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

function resolveActiveTheme(choice: BoardSignalThemeChoice): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyBoardSignalTheme(choice: BoardSignalThemeChoice, persist = true) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const activeTheme = resolveActiveTheme(choice);
  root.dataset.bsTheme = activeTheme;
  root.dataset.bsThemeChoice = choice;
  root.style.colorScheme = activeTheme;
  if (persist) window.localStorage.setItem(BOARDSIGNAL_THEME_STORAGE_KEY, choice);
  window.dispatchEvent(new CustomEvent(BOARDSIGNAL_THEME_CHANGE_EVENT, { detail: { choice, activeTheme } }));
}

export default function BoardSignalThemeControl({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<BoardSignalThemeChoice>("system");

  useEffect(() => {
    const rootChoice = document.documentElement.dataset.bsThemeChoice;
    const stored = window.localStorage.getItem(BOARDSIGNAL_THEME_STORAGE_KEY);
    setChoice(isThemeChoice(rootChoice) ? rootChoice : isThemeChoice(stored) ? stored : "system");

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = document.documentElement.dataset.bsThemeChoice;
      if (current === "system" || !isThemeChoice(current)) applyBoardSignalTheme("system", false);
    };
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ choice?: string }>).detail;
      if (isThemeChoice(detail?.choice)) setChoice(detail.choice);
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener(BOARDSIGNAL_THEME_CHANGE_EVENT, onThemeChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener(BOARDSIGNAL_THEME_CHANGE_EVENT, onThemeChange);
    };
  }, []);

  const icon = choice === "light" ? <Sun size={15} aria-hidden="true" /> : choice === "dark" ? <Moon size={15} aria-hidden="true" /> : <Monitor size={15} aria-hidden="true" />;

  return (
    <label className={`bs-theme-control ${className}`.trim()}>
      <span className="bs-theme-control-label">Appearance</span>
      <span className="bs-theme-control-field">
        {icon}
        <select
          aria-label="BoardSignal appearance"
          value={choice}
          onChange={(event) => {
            const next = event.target.value;
            if (!isThemeChoice(next)) return;
            setChoice(next);
            applyBoardSignalTheme(next);
          }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </span>
    </label>
  );
}
