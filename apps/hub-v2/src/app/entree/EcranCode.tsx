/**
 * QUOI     — l'entrée du Hub : l'e-mail, puis le code à 6 chiffres reçu par e-mail.
 * POURQUOI — même geste que la V2 ; un e-mail qui n'a pas de compte ne reçoit rien (le Hub ne
 *            crée pas de compte).
 */
import { useState, type SubmitEvent } from 'react'
import logo from '@/assets/ui/logo-explore.webp'
import { envoyerCode, verifierCode } from './entree'
import styles from './EcranCode.module.css'

export function EcranCode() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [etape, setEtape] = useState<'email' | 'code'>('email')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function valider(event: SubmitEvent) {
    event.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      if (etape === 'email') {
        await envoyerCode(email.trim())
        setEtape('code')
      } else {
        await verifierCode(email.trim(), code.trim())
      }
    } catch {
      setErreur(etape === 'email' ? 'Cet e-mail n’a pas pu recevoir de code.' : 'Ce code ne marche pas.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className={styles.ecran}>
      <form className={styles.carte} onSubmit={(e) => void valider(e)}>
        <img className={styles.logo} src={logo} alt="Runes de Chêne Explore" />
        <p className={styles.surtitre}>Le Hub</p>
        {etape === 'email' ? (
          <label className={styles.champ}>
            <span>Ton e-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value) }} />
          </label>
        ) : (
          <label className={styles.champ}>
            <span>Le code reçu par e-mail</span>
            <input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => { setCode(e.target.value) }} />
          </label>
        )}
        {erreur && <p className={styles.erreur} role="alert">{erreur}</p>}
        <button className={styles.bouton} type="submit" disabled={envoi}>
          {etape === 'email' ? 'Recevoir un code' : 'Entrer'}
        </button>
      </form>
    </main>
  )
}
