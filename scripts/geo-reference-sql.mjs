/**
 * QUOI     — télécharge les contours (départements, pays) et écrit la migration 350.
 * POURQUOI — 3 Mo de géométries ne s'écrivent pas à la main ; un script rejouable garde la
 *            trace de la source. Sources : départements simplifiés (Licence Ouverte, d'après
 *            l'IGN — github.com/gregoiredavid/france-geojson) ; pays Natural Earth 1:50m
 *            (domaine public — le 1:110m oublie Malte, les Féroé, Jersey…) ; articles des
 *            départements : Code officiel géographique INSEE.
 * Usage    — node scripts/geo-reference-sql.mjs
 */
import { writeFileSync } from 'node:fs'

const DEPARTEMENTS =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson'
const PAYS =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
// Code officiel géographique INSEE : TNCC = type d'article du département (décision d'Uriel, 27/09).
const INSEE = 'https://www.insee.fr/fr/statistiques/fichier/8377162/v_departement_2025.csv'
const ARTICLE = { 0: 'de ', 1: "d'", 2: 'du ', 3: 'de la ', 4: 'des ', 5: "de l'", 6: 'des ', 7: 'de las ', 8: 'de los ' }

const sql = (s) => `'${String(s).replaceAll("'", "''")}'`
const geom = (g) =>
  `extensions.ST_Multi(extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(${sql(JSON.stringify(g))}), 4326))`

const dep = await (await fetch(DEPARTEMENTS)).json()
const deNom = new Map(
  (await (await fetch(INSEE)).text())
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((ligne) => {
      // Colonnes : DEP, REG, CHEFLIEU, TNCC, NCC, NCCENR, LIBELLE
      const [code, , , tncc, , nomEnrichi] = ligne.split(',').map((c) => c.replaceAll('"', ''))
      return [code, `${ARTICLE[Number(tncc)]}${nomEnrichi}`]
    }),
)
const pays = await (await fetch(PAYS)).json()

const lignes = [
  '-- 350 — Contours des départements et des pays (données de référence)',
  '--',
  '-- WHY : données de la migration 349, générées par scripts/geo-reference-sql.mjs. Ne pas',
  '-- éditer à la main : relancer le script.',
  '',
  'TRUNCATE public.geo_departements, public.geo_pays;',
  '',
]
for (const f of dep.features) {
  const de = deNom.get(f.properties.code)
  if (!de) throw new Error(`Département ${f.properties.code} absent du fichier INSEE`)
  lignes.push(
    `INSERT INTO public.geo_departements (code, nom, de_nom, geom) VALUES (${sql(f.properties.code)}, ${sql(f.properties.nom)}, ${sql(de)}, ${geom(f.geometry)});`,
  )
}
let nPays = 0
for (const f of pays.features) {
  const iso = f.properties.ISO_A2_EH ?? f.properties.ISO_A2
  if (!iso || iso === '-99') continue
  nPays += 1
  lignes.push(
    `INSERT INTO public.geo_pays (iso2, nom_fr, geom) VALUES (${sql(iso)}, ${sql(f.properties.NAME_FR ?? f.properties.NAME)}, ${geom(f.geometry)}) ON CONFLICT (iso2) DO NOTHING;`,
  )
}
writeFileSync('supabase/migrations/350_geo_reference_donnees.sql', lignes.join('\n') + '\n')
console.info(`départements : ${dep.features.length} · pays : ${nPays}`)
