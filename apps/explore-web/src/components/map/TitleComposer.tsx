import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'

interface WordItem {
  key: string       // unique key (word_id ou "free:xxx")
  word: string
  type: 'fragment' | 'title' | 'free'
  fragmentWordId: number | null  // ID fragment_words (pour sauvegarde), null pour les mots gratuits
  source: string   // nom du fragment ou "Gratuit"
}

const MAX_WORDS = 5

// Mots gratuits disponibles pour tous
const FREE_WORDS: WordItem[] = [
  { key: 'free:Le', word: 'Le', type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: 'free:La', word: 'La', type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: "free:L'", word: "L'", type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: 'free:au', word: 'au', type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: 'free:aux', word: 'aux', type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: 'free:de', word: 'de', type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: 'free:du', word: 'du', type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: 'free:de la', word: 'de la', type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: "free:de l'", word: "de l'", type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: "free:a l'", word: "a l'", type: 'free', fragmentWordId: null, source: 'Gratuit' },
  { key: 'free:&', word: '&', type: 'free', fragmentWordId: null, source: 'Gratuit' },
]

interface Props {
  currentWordIds: number[]
  onSave: (wordIds: number[], phrase: string) => void
  onCancel: () => void
  saving: boolean
}

export function TitleComposer({ onSave, onCancel, saving }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const composedPhrase = usePlayerStore(s => s.composedPhrase)
  const [allWords, setAllWords] = useState<WordItem[]>([])
  const [loading, setLoading] = useState(true)

  // La phrase = liste ordonnee de keys
  const [phraseKeys, setPhraseKeys] = useState<string[]>([])

  useEffect(() => {
    if (!userId) return
    loadWords()
  }, [userId])

  async function loadWords() {
    const fragmentWords: WordItem[] = []
    const titleWords: WordItem[] = []

    // 1. Fragments du joueur
    const { data: fragmentsData } = await supabase.rpc('get_user_fragments', { p_user_id: userId })
    if (fragmentsData && Array.isArray(fragmentsData)) {
      for (const frag of fragmentsData as Array<{ name: string; words: Array<{ id: number; word: string; slot: string }> | null }>) {
        if (!frag.words) continue
        for (const w of frag.words) {
          fragmentWords.push({
            key: `fw:${w.id}`,
            word: w.word,
            type: 'fragment',
            fragmentWordId: w.id,
            source: frag.name,
          })
        }
      }
    }

    // 2. Titres debloques
    const { data: titlesData } = await supabase.rpc('get_user_titles', { p_user_id: userId })
    if (titlesData) {
      const td = titlesData as {
        unlockedGeneralTitles: Array<{ id: number; name: string; icon: string }> | null
        factionTitle: { id: number; name: string; icon: string } | null
      }
      if (td.unlockedGeneralTitles) {
        for (const t of td.unlockedGeneralTitles) {
          titleWords.push({
            key: `title:${t.id}`,
            word: t.name,
            type: 'title',
            fragmentWordId: null,
            source: `${t.icon} Titre`,
          })
        }
      }
      if (td.factionTitle) {
        titleWords.push({
          key: `ftitle:${td.factionTitle.id}`,
          word: td.factionTitle.name,
          type: 'title',
          fragmentWordId: null,
          source: `${td.factionTitle.icon} Faction`,
        })
      }
    }

    const all = [...FREE_WORDS, ...titleWords, ...fragmentWords]
    setAllWords(all)

    // Restaurer la phrase actuelle depuis le texte sauvegarde
    if (composedPhrase) {
      const savedWords = composedPhrase.split(' ')
      const restoredKeys: string[] = []
      const usedKeys = new Set<string>()

      for (const sw of savedWords) {
        // Chercher dans les mots disponibles
        const match = all.find(w => w.word === sw && !usedKeys.has(w.key))
        if (match) {
          restoredKeys.push(match.key)
          usedKeys.add(match.key)
        }
      }
      // Aussi essayer les mots composes (ex: "de la" = 2 mots dans le split)
      // Reconstituer en testant les paires
      if (restoredKeys.length < savedWords.length) {
        const rebuilt: string[] = []
        let i = 0
        while (i < savedWords.length) {
          if (i + 1 < savedWords.length) {
            const pair = `${savedWords[i]} ${savedWords[i + 1]}`
            const pairMatch = all.find(w => w.word === pair && !usedKeys.has(w.key))
            if (pairMatch) {
              rebuilt.push(pairMatch.key)
              usedKeys.add(pairMatch.key)
              i += 2
              continue
            }
          }
          const single = all.find(w => w.word === savedWords[i] && !usedKeys.has(w.key))
          if (single) {
            rebuilt.push(single.key)
            usedKeys.add(single.key)
          }
          i++
        }
        if (rebuilt.length > restoredKeys.length) {
          setPhraseKeys(rebuilt)
          setLoading(false)
          return
        }
      }
      setPhraseKeys(restoredKeys)
    }

    setLoading(false)
  }

  // Ajouter un mot a la phrase
  function addWord(key: string) {
    if (phraseKeys.length >= MAX_WORDS) return
    if (phraseKeys.includes(key)) return
    setPhraseKeys(prev => [...prev, key])
  }

  // Retirer un mot de la phrase (par index)
  function removeWord(index: number) {
    setPhraseKeys(prev => prev.filter((_, i) => i !== index))
  }

  // Construire la phrase texte
  const phraseWords = phraseKeys
    .map(k => allWords.find(w => w.key === k))
    .filter(Boolean) as WordItem[]
  const phrase = phraseWords.map(w => w.word).join(' ')

  function handleSave() {
    const wordIds = phraseWords
      .filter(w => w.fragmentWordId != null)
      .map(w => w.fragmentWordId!)
    onSave(wordIds, phrase)
  }

  // Grouper les mots par source pour l'affichage
  const freeWords = allWords.filter(w => w.type === 'free')
  const titlesPool = allWords.filter(w => w.type === 'title')
  const fragmentPool = allWords.filter(w => w.type === 'fragment')

  // Regrouper fragments par source
  const fragmentsBySource: Record<string, WordItem[]> = {}
  for (const w of fragmentPool) {
    if (!fragmentsBySource[w.source]) fragmentsBySource[w.source] = []
    fragmentsBySource[w.source].push(w)
  }

  if (loading) return <div style={{ padding: '1rem', opacity: 0.5 }}>Chargement des mots...</div>

  return (
    <div className="title-composer">
      <label className="player-modal-edit-label" style={{ textAlign: 'center' }}>Composez votre titre</label>

      {/* Zone de phrase — cliquer pour retirer */}
      <div className="title-composer-phrase">
        {phraseWords.length === 0 ? (
          <span className="title-composer-placeholder">Cliquez sur les mots ci-dessous...</span>
        ) : (
          phraseWords.map((w, i) => (
            <button
              key={`${w.key}-${i}`}
              className={`title-composer-phrase-word ${w.type}`}
              onClick={() => removeWord(i)}
              title="Cliquer pour retirer"
            >
              {w.word}
              <span className="title-composer-phrase-x">&times;</span>
            </button>
          ))
        )}
      </div>

      {phraseKeys.length >= MAX_WORDS && (
        <span className="title-composer-limit">Maximum {MAX_WORDS} mots atteint</span>
      )}

      {/* Mots gratuits */}
      <div className="title-composer-section">
        <span className="title-composer-section-label">Articles & Connecteurs</span>
        <div className="title-composer-options">
          {freeWords.map(w => (
            <button
              key={w.key}
              className={`title-composer-chip chip-free${phraseKeys.includes(w.key) ? ' used' : ''}`}
              onClick={() => addWord(w.key)}
              disabled={phraseKeys.includes(w.key) || phraseKeys.length >= MAX_WORDS}
            >
              {w.word}
            </button>
          ))}
        </div>
      </div>

      {/* Titres debloques */}
      {titlesPool.length > 0 && (
        <div className="title-composer-section">
          <span className="title-composer-section-label">Titres debloques</span>
          <div className="title-composer-options">
            {titlesPool.map(w => (
              <button
                key={w.key}
                className={`title-composer-chip chip-title${phraseKeys.includes(w.key) ? ' used' : ''}`}
                onClick={() => addWord(w.key)}
                disabled={phraseKeys.includes(w.key) || phraseKeys.length >= MAX_WORDS}
                title={w.source}
              >
                {w.word}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fragments — par source */}
      {Object.entries(fragmentsBySource).map(([source, words]) => (
        <div key={source} className="title-composer-section">
          <span className="title-composer-section-label">{source}</span>
          <div className="title-composer-options">
            {words.map(w => (
              <button
                key={w.key}
                className={`title-composer-chip chip-fragment${phraseKeys.includes(w.key) ? ' used' : ''}`}
                onClick={() => addWord(w.key)}
                disabled={phraseKeys.includes(w.key) || phraseKeys.length >= MAX_WORDS}
              >
                {w.word}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="player-modal-edit-actions" style={{ marginTop: 16 }}>
        <button className="player-modal-cancel-btn" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
        <button className="player-modal-save-btn" onClick={handleSave} disabled={saving || phraseWords.length === 0}>
          {saving ? 'Sauvegarde...' : 'Valider'}
        </button>
      </div>
    </div>
  )
}
