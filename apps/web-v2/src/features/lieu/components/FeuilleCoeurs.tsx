/**
 * QUOI     — la feuille « Les cœurs » d'un lieu : la feuille commune, avec les cœurs de ce lieu.
 * POURQUOI — elle s'ouvre depuis la rangée des visages, ou la pastille sur son propre lieu.
 */
import { FeuilleDesCoeurs } from '@/shared/ui/FeuilleDesCoeurs'
import { useCoeurs } from '../hooks/useCoeurs'

export function FeuilleCoeurs({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { coeurs } = useCoeurs(id)
  return <FeuilleDesCoeurs coeurs={coeurs} onFermer={onFermer} />
}
