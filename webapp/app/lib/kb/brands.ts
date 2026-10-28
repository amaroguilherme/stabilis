import { useEffect, useState } from "react";

// Brand names (ANVISA open data) are only needed by the medication search, so they are loaded in a
// separate chunk instead of travelling with every page.
let pending: Promise<Record<string, string[]>> | null = null;

export function loadBrands(): Promise<Record<string, string[]>> {
  pending ??= import("./brands.client.generated.json").then((module) => module.default.brands as Record<string, string[]>);
  return pending;
}

/** Brand → drug ids, or null while loading (search works on generic names meanwhile). */
export function useBrands(): Record<string, string[]> | null {
  const [brands, setBrands] = useState<Record<string, string[]> | null>(null);
  useEffect(() => {
    let active = true;
    loadBrands().then((loaded) => active && setBrands(loaded), () => {});
    return () => {
      active = false;
    };
  }, []);
  return brands;
}
