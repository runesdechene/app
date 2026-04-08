import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Setting {
  key: string
  value: string
}

interface CategoryGroup {
  name: string
  label: string
  settings: Setting[]
}

const CATEGORIES: Record<string, string> = {
  influence: 'Influence',
  exploration: 'Exploration',
  erudition: 'Érudition',
  enigma: 'Énigmes',
  fragment: 'Fragments',
  faction: 'Héritage',
  distance: 'Coût par distance',
  energy: 'Énergie',
  glory: 'Gloire',
  default: 'Défauts globaux',
}

/** Clés obsolètes — anciens systèmes supprimés (conquête, construction, vitalité, fortification, claim) */
const DEAD_KEYS = new Set([
  'conquest_base_cycle',
  'construction_base_cycle',
  'vitalite_base_cycle',
  'zone_fort_multiplier',
  'zone_detection_radius_km',
  'territory_size_defense_mult',
  'glory_claim',
  'glory_fortify',
  'glory_discover',
  'glory_cost_bonus_pct',
  'fragment_collection_1',
  'fragment_collection_2',
  'fragment_collection_3',
  'fragment_collection_4',
  'shopify_access_token',
  'shopify_shop',
  'unknown_place_icon',
  'ad_screen_duration',
  'influence_max_remote_per_day',
  'influence_visit_gps',
  'influence_revisit_gps',
  'fragment_affinity_bonus_default',
])

const DESCRIPTIONS: Record<string, string> = {
  influence_max_remote_per_day: "Limite de clics d'influence à distance par jour et par lieu",
  influence_decay_per_week: "Points d'influence perdus par semaine (decay)",
  influence_visit_gps: "Stock d'influence gagné quand on VISITE un lieu en GPS (1re fois)",
  influence_add_place: "Stock d'influence gagné quand on CRÉE un lieu sur place (GPS uniquement, 0 si à distance)",
  influence_revisit_gps: "Influence placée automatiquement quand on RE-VISITE un lieu en GPS",
  influence_add_carnet: "Stock d'influence gagné pour l'ajout d'un récit",
  influence_add_photo: "Stock d'influence gagné pour l'ajout d'une photo",
  exploration_gps_bonus: "Bonus exploration quand on CRÉE un lieu sur place (GPS < 500m, 0 si à distance)",
  exploration_visit_gps: "Exploration gagnée quand on VISITE un lieu existant en GPS (1re fois)",
  exploration_add_place: "Exploration de base pour l'ajout d'un lieu (GPS ou à distance)",
  exploration_add_photo: "Exploration gagnée pour l'ajout d'une photo",
  exploration_add_carnet: "Exploration gagnée pour l'ajout d'un récit",
  erudition_add_carnet: "Érudition gagnée pour l'ajout d'un récit",
  enigma_influence_easy: 'Influence gagnée — énigme facile réussie',
  enigma_influence_medium: 'Influence gagnée — énigme moyenne réussie',
  enigma_influence_hard: 'Influence gagnée — énigme difficile réussie',
  enigma_erudition_easy: 'Érudition gagnée — énigme facile réussie',
  enigma_erudition_medium: 'Érudition gagnée — énigme moyenne réussie',
  enigma_erudition_hard: 'Érudition gagnée — énigme difficile réussie',
  enigma_place_influence_base: 'Influence base — énigme de lieu',
  enigma_place_influence_per_diff: 'Influence par niveau de difficulté (lieu)',
  enigma_place_erudition_base: 'Érudition base — énigme de lieu',
  enigma_place_erudition_per_diff: 'Érudition par niveau de difficulté (lieu)',
  fragment_enigma_influence: 'Influence gagnée — énigme de fragment réussie',
  fragment_enigma_erudition: 'Érudition gagnée — énigme de fragment réussie',
  fragment_enigma_cooldown_hours: "Cooldown entre énigmes d'un même fragment (heures)",
  fragment_affinity_bonus_default: 'Clics remote supplémentaires par affinité de fragment',
  faction_change_cooldown_days: "Cooldown changement d'héritage (jours)",
  energy_base_cycle: "Secondes pour régénérer 1 pt d'énergie",
  default_max_energy: 'Énergie max par défaut (nouveaux joueurs)',
  distance_gps_km: 'Rayon GPS "sur place" (km)',
  distance_close_km: 'Rayon zone "proche" (km)',
  distance_mid_km: 'Rayon zone "moyen" (km)',
  distance_mult_gps: 'Multiplicateur coût GPS',
  distance_mult_close: 'Multiplicateur coût proche',
  distance_mult_mid: 'Multiplicateur coût moyen',
  distance_mult_far: 'Multiplicateur coût lointain',
  underdog_enabled: "Bonus underdog activé (0 = non, 1 = oui)",
  underdog_multiplier: "Multiplicateur regen pour l'héritage en dernière position",
  enigma_bonus_energy_cost: "Coût en énergie pour lancer un bonus d'énigme",
  erudition_enigma_wrong: "Érudition perdue sur mauvaise réponse d'énigme",
  influence_per_vote: "Influence placée par clic de bannière",
  influence_visit_gps_stock: "Stock d'influence gagné pour une visite GPS (1re fois)",
  influence_revisit_gps_stock: "Stock d'influence gagné pour une re-visite GPS (base avant diminishing)",
}

export function GameRules() {
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .order('key')

      if (error) {
        console.error('Erreur chargement app_settings:', error)
        return
      }

      const grouped: Record<string, Setting[]> = {}
      for (const row of data ?? []) {
        if (DEAD_KEYS.has(row.key)) continue
        const prefix = row.key.split('_')[0]
        const catName = CATEGORIES[prefix] ? prefix : 'divers'
        if (!grouped[catName]) grouped[catName] = []
        grouped[catName].push({ key: row.key, value: row.value })
      }

      const orderedNames = [...Object.keys(CATEGORIES), 'divers']
      const cats: CategoryGroup[] = orderedNames
        .filter(name => grouped[name]?.length)
        .map(name => ({
          name,
          label: CATEGORIES[name] ?? 'Divers',
          settings: grouped[name],
        }))

      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }

  function updateValue(catName: string, key: string, value: string) {
    setCategories(prev =>
      prev.map(cat =>
        cat.name !== catName
          ? cat
          : {
              ...cat,
              settings: cat.settings.map(s =>
                s.key === key ? { ...s, value } : s
              ),
            }
      )
    )
  }

  async function saveCategory(catName: string) {
    const cat = categories.find(c => c.name === catName)
    if (!cat) return

    setSaving(catName)
    try {
      for (const setting of cat.settings) {
        const { error } = await supabase
          .from('app_settings')
          .upsert({ key: setting.key, value: String(setting.value) }, { onConflict: 'key' })
        if (error) {
          console.error(`Erreur save ${setting.key}:`, error)
        }
      }
      setSaveMsg(`${cat.label} sauvegardé`)
      setTimeout(() => setSaveMsg(null), 2500)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="section">
        <p>Chargement des paramètres...</p>
      </div>
    )
  }

  return (
    <div className="section">
      <h1>Règles du Jeu</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        Tous les paramètres du jeu. Les modifications sont appliquées immédiatement après sauvegarde.
      </p>

      {saveMsg && (
        <div
          style={{
            background: '#4a7c59',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            marginBottom: 16,
            fontSize: '0.9em',
          }}
        >
          {saveMsg}
        </div>
      )}

      {categories.map(cat => (
        <div key={cat.name} className="divers-card">
          <h3>{cat.label}</h3>
          <table className="settings-table">
            <thead>
              <tr>
                <th>Paramètre</th>
                <th>Valeur</th>
                <th>Clé</th>
              </tr>
            </thead>
            <tbody>
              {cat.settings.map(s => (
                <tr key={s.key}>
                  <td>{DESCRIPTIONS[s.key] ?? s.key}</td>
                  <td>
                    <input
                      type="number"
                      value={s.value}
                      onChange={e => updateValue(cat.name, s.key, e.target.value)}
                      className="settings-input"
                      style={{ width: 100 }}
                    />
                  </td>
                  <td style={{ fontSize: '0.75em', opacity: 0.5 }}>{s.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="btn-primary"
            onClick={() => saveCategory(cat.name)}
            style={{ marginTop: 10 }}
          >
            {saving === cat.name ? '...' : 'Sauvegarder'}
          </button>
        </div>
      ))}
    </div>
  )
}
