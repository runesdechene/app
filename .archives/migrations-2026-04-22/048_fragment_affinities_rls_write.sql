-- 048_fragment_affinities_rls_write.sql
-- Autoriser l'écriture sur fragment_tag_affinities (le hub admin en a besoin)

CREATE POLICY "fragment_tag_affinities_all"
  ON fragment_tag_affinities FOR ALL
  USING (true) WITH CHECK (true);
