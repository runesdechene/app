-- WHY: jusqu'à la 1.8.1 (07/10/2026), la V2 n'envoyait jamais touch_last_login (une requête
--      supabase-js écrite `void …` ne part pas) : users.last_login_at, que le Hub affiche, est resté
--      figé depuis le passage de chacun à la V2 — 110 fiches « jamais connectées » alors qu'elles
--      l'ont été. Supabase, lui, a noté chaque connexion par code (auth.users.last_sign_in_at) :
--      on la recopie quand elle est plus récente. Aucune date n'est effacée ni reculée.
--      Ce que ce rattrapage ne voit pas : les retours dans l'appli sans nouvelle connexion
--      (retours.ts) ; ils s'enregistrent depuis la 1.8.1.
-- SCHEMA CHECKED (08/10/2026, relu en prod) : users.last_login_at timestamptz ;
--      auth.users.last_sign_in_at ; 120 fiches où Supabase est plus récent, dont 110 sans date.

UPDATE public.users u
   SET last_login_at = a.last_sign_in_at
  FROM auth.users a
 WHERE a.id::text = u.id
   AND a.last_sign_in_at > COALESCE(u.last_login_at, '-infinity'::timestamptz);
