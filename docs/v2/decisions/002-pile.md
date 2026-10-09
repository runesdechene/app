# 002 — La pile technique

**Date :** 2026-09-27 · **Statut :** adoptée

## Contexte
Un front neuf doit partir de versions actuelles, déclarées honnêtement. La V1 tourne en React
19.0.0 tout en déclarant React 18, par un override du `package.json` racine.

## Décision
React 19.3, React Router 8 (mode data), TanStack Query 5, supabase-js 2, Vite 8, TypeScript 6.0
en mode ultra-strict, vite-plugin-pwa, ESLint 10 + typescript-eslint `strict-type-checked`,
Prettier, Vitest 5 + Testing Library. Versions exactes, sans `^`. CSS Modules + jetons CSS.

**TypeScript reste en 6.0** : typescript-eslint n'accepte pas encore la 7
(`typescript >=4.8.4 <6.1.0`, relevé le 27/09/2026). On montera quand il suivra.

## Écarté
- **Tailwind** (utilisé par la V1) — le style dans le balisage se lit mal pour un codeur moyen ;
  un fichier `.module.css` à côté du composant se lit comme du CSS.
- **TypeScript 7** — pas de lint possible aujourd'hui.

## Conséquences
- Node ≥ 22.22 (exigé par React Router 8).
- L'override React global du monorepo disparaît : la V1 et le Hub déclarent 19.0.0 eux-mêmes.
