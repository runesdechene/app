-- WHY: faille critique trouvée à l'audit du 11/10/2026, prouvée en transaction annulée : avec la
--      seule clé publique (anon), on pouvait modifier — ajouter, effacer — titles, user_fragments,
--      shopify_unlocks, title_fragments, fragment_words, faction_tag_bonuses,
--      fragment_tag_affinities et tags. Des politiques « Service role can manage … » avaient été
--      écrites POUR public avec `true` : le service_role n'en a jamais eu besoin (il passe outre
--      la RLS), elles ouvraient tout à tout le monde.
--      Et « Public can create user accounts » (INSERT public, true) laissait n'importe qui créer
--      une ligne users : handle_new_user reprend une ligne de même e-mail AVEC son rôle — de quoi
--      se fabriquer un compte admin avant de s'inscrire.
--   L'écriture de ces tables est réservée à l'équipe (le Hub, compte admin) ; la lecture ne change
--   pas (les politiques SELECT existantes restent). Le webhook Shopify et les fonctions serveur
--   passent par le service_role : la RLS ne les concerne pas. Personne ne crée de ligne users
--   en direct : handle_new_user (SECURITY DEFINER) et les RPC s'en chargent.
-- SCHEMA CHECKED (11/10/2026, pg_policies live) : les politiques nommées ci-dessous ; _is_admin()
--   (users.role = 'admin') ; seul le Hub écrit ces tables en direct (TitlesManager, Fragments,
--   AssignFragments, ShopifyUnlocks, Factions, TagsManager).

DROP POLICY "Service role can manage titles" ON public.titles;
DROP POLICY "Service role can manage user_fragments" ON public.user_fragments;
DROP POLICY "Service role can manage shopify_unlocks" ON public.shopify_unlocks;
DROP POLICY "Service role can manage title_fragments" ON public.title_fragments;
DROP POLICY "Service role can manage fragment_words" ON public.fragment_words;
DROP POLICY faction_tag_bonuses_admin ON public.faction_tag_bonuses;
DROP POLICY fragment_tag_affinities_all ON public.fragment_tag_affinities;
DROP POLICY "Authenticated users can update tags" ON public.tags;
DROP POLICY "Authenticated can insert place_tags" ON public.place_tags;
DROP POLICY "Public can create user accounts" ON public.users;

CREATE POLICY equipe_ecrit ON public.titles FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
CREATE POLICY equipe_ecrit ON public.user_fragments FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
CREATE POLICY equipe_ecrit ON public.shopify_unlocks FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
CREATE POLICY equipe_ecrit ON public.title_fragments FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
CREATE POLICY equipe_ecrit ON public.fragment_words FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
CREATE POLICY equipe_ecrit ON public.faction_tag_bonuses FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
CREATE POLICY equipe_ecrit ON public.fragment_tag_affinities FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
CREATE POLICY equipe_ecrit ON public.place_tags FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
