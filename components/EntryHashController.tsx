"use client";

import { useEffect } from "react";

export function EntryHashController() {
  useEffect(() => {
    function openHashTarget(hash: string) {
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }
      if (!id) return;

      const target = document.getElementById(id);
      if (!(target instanceof HTMLDetailsElement)) return;

      target.open = true;
      target.querySelector<HTMLElement>("summary")?.focus();
    }

    function openLocationHash() {
      openHashTarget(window.location.hash);
    }

    function openClickedHash(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (link) {
        window.requestAnimationFrame(() => openHashTarget(link.hash));
      }
    }

    openLocationHash();
    window.addEventListener("hashchange", openLocationHash);
    document.addEventListener("click", openClickedHash);
    return () => {
      window.removeEventListener("hashchange", openLocationHash);
      document.removeEventListener("click", openClickedHash);
    };
  }, []);

  return null;
}
