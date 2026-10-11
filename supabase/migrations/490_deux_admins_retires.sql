-- WHY: audit de sécurité du 11/10/2026 — deux comptes avaient le rôle admin sans raison (Uriel :
--      « retire admin aux deux comptes ») : « L'EMPEREUR CALIGULA » (créé le 23/02/2026) et un
--      ancien compte V1 sans nom, jamais connecté à la V2. Ils redeviennent des Explorateurs.
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users(id, role) ; role vaut 'user'
--   pour un Explorateur.

UPDATE public.users SET role = 'user'
 WHERE id IN ('8502ad3f-a450-4150-8d98-c3e7ef692604', 'KsTIYvxFwzVxvLbGVRgtka7IKN02')
   AND role = 'admin';
