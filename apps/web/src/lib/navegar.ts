"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

// Next 15.5 tiene un bug del router con navegaciones que cambian SOLO
// searchParams: la entrada "optimista" de cache reutiliza el
// renderedSearch/canonicalUrl de la primera navegacion del mismo pathname y
// re-reproduce esa URL (ver requestOptimisticRouteCacheEntry en
// segment-cache-impl/cache.js ~L409). En la agenda se veia asi: el tab
// Semana->Mes funcionaba la primera vez y nunca mas, ni con <Link> ni con
// router.push.
//
// Fix determinista sin parchear APIs globales (v1.6.2):
//   1) router.prefetch(url) -> crea una entrada de ruta EXACTA para la URL
//      destino, de modo que el push posterior usa esa entrada y no la
//      optimista envenenada.
//   2) router.push(url)    -> navegacion SPA normal.
//   3) Fallback a los 600ms: SOLO si la URL sigue exactamente igual que antes
//      del click Y no es ya la de destino (evita recargas spurious cuando se
//      pulsa un control que apunta a la URL actual, p.ej. "Hoy" estando en
//      hoy), se fuerza una navegacion completa, que siempre funciona.
//
// El token por click cancela el fallback del click anterior: con clics
// rapidos (tabs Dia/Semana/Mes) solo queda activo el ultimo, y si alguno de
// los pushes llego a cambiar la URL la condicion del fallback ya no se
// cumple. No se envuelve history.pushState ni se cuentan eventos globales.
let ultimoToken = 0;

export function useNavegar() {
  const router = useRouter();
  return useCallback(
    (url: string) => {
      const antes = window.location.href;
      const destino = new URL(url, antes).href;
      const token = ++ultimoToken;
      try {
        router.prefetch(url);
      } catch {
        // prefetch es opcional; push/fallback cubren la navegacion.
      }
      router.push(url);
      window.setTimeout(() => {
        if (token !== ultimoToken) return; // un click mas reciente ya decidio
        const actual = window.location.href;
        if (actual === antes && actual !== destino) {
          window.location.assign(destino);
        }
      }, 600);
    },
    [router],
  );
}
