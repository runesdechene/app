/**
 * QUOI     — « Réglages » : ce qui part vers les joueurs. Le texte de partage (compteur, aperçu avec « Abbaye de
 *            Fontenay », « Enregistrer ») et l'image des pages SEO (aperçu, « Remplacer l'image »). Sur téléphone,
 *            les liens « Parler aux joueurs » passent en tête (R7) ; sur PC le menu les porte déjà.
 * POURQUOI — Explore et les pages /lieu/ lisent la même phrase ; {name} devient le nom du lieu. L'image change au
 *            passage de la nuit, pas tout de suite : l'écran le dit. L'image choisie ne part qu'à « Enregistrer l'image ».
 */
import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from 'react'
import { Link } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import sectionNouvelles from '@/assets/ui/section-nouvelles.png'
import { dateCourte } from '@/shared/lib/dates'
import { verifierFichier, type RegleFichier } from '@/shared/lib/envoi'
import { pluriel } from '@/shared/lib/texte'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Reglages as LesReglages } from '../api/reglages'
import { useEnregistrerPartage, useReglages, useRemplacerImageSeo } from '../hooks/useReglages'
import { morceauxDApercu, NOM_D_EXEMPLE } from '../lib/partage'
import styles from './Reglages.module.css'

const REGLE_IMAGE: RegleFichier = { types: ['image/jpeg', 'image/png', 'image/webp'], maxOctets: 5 * 1024 * 1024 }

const LIENS = [
  { chemin: '/joueurs/mises-a-jour', titre: 'Mises à jour', phrase: 'Les notes « Nouveautés » d’Explore' },
  { chemin: '/joueurs/notifications', titre: 'Notifications', phrase: 'Ce qui part vers les téléphones' },
  { chemin: '/joueurs/blog', titre: 'Blog de la boutique', phrase: 'Les articles de runesdechene.com' },
]

function ParlerAuxJoueurs() {
  return (
    <section className={styles.telephone}>
      <TitreDeSection titre="Parler aux joueurs" icone={sectionNouvelles} />
      <Bloc>
        {LIENS.map((l) => (
          <Link key={l.chemin} className={styles.lien} to={l.chemin}>
            <span className={styles.lienTitre}>{l.titre}</span>
            <span className={styles.aide}>{l.phrase}</span>
            <img className={styles.chevron} src={chevron} alt="" />
          </Link>
        ))}
      </Bloc>
    </section>
  )
}

function TexteDePartage({ depart }: { depart: LesReglages }) {
  const enregistrer = useEnregistrerPartage()
  const [texte, setTexte] = useState(depart.partage)
  const morceaux = morceauxDApercu(texte)

  function valider(e: SyntheticEvent) {
    e.preventDefault()
    enregistrer.mutate(texte)
  }

  return (
    <section className={styles.section}>
      <TitreDeSection titre="Le texte de partage" icone={sectionNouvelles} />
      <Bloc>
        <form className={`${styles.formulaire ?? ''} ${styles.carte ?? ''}`} onSubmit={valider}>
          <div className={styles.champ}>
            <label htmlFor="phrase-de-partage" className={styles.etiquette}>La phrase</label>
            <textarea id="phrase-de-partage" rows={2} value={texte}
              onChange={(e) => { enregistrer.reset(); setTexte(e.target.value) }} />
            <span className={styles.compteur}>{texte.length} {pluriel(texte.length, 'signe')}</span>
          </div>
          <p className={styles.aide}>
            {'{name}'} devient le nom du lieu, partout où il apparaît. Explore et les pages /lieu lisent cette phrase ;
            vide ou sans {'{name}'}, les deux gardent leur phrase d’origine, celle de l’aperçu.
          </p>
          <div className={styles.champ}>
            <p className={styles.etiquette}>Aperçu — {NOM_D_EXEMPLE}</p>
            <p className={styles.apercu}>
              {morceaux.map((m, i) => (
                <span key={i}>{i > 0 && <strong>{NOM_D_EXEMPLE}</strong>}{m}</span>
              ))}
            </p>
          </div>
          <div className={styles.pied}>
            <span className={styles.aide}>
              {depart.partageModifieLe ? `Enregistrée le ${dateCourte(depart.partageModifieLe)}` : 'Pas encore enregistrée'}
            </span>
            <button type="submit" className={styles.bouton} disabled={enregistrer.isPending}>Enregistrer</button>
          </div>
          {enregistrer.isSuccess && <p role="status" className={styles.aide}>Enregistré.</p>}
          {enregistrer.isError && <p role="alert" className={styles.erreur}>{enregistrer.error.message}</p>}
        </form>
      </Bloc>
    </section>
  )
}

function ImageSeo({ depart }: { depart: LesReglages }) {
  const remplacer = useRemplacerImageSeo()
  // Le fichier choisi ne part qu'à l'enregistrement ; son aperçu est libéré au changement et à la fermeture.
  const [choix, setChoix] = useState<{ fichier: File; apercu: string } | null>(null)
  const [refus, setRefus] = useState<string | null>(null)

  useEffect(() => {
    if (!choix) return
    return () => { URL.revokeObjectURL(choix.apercu) }
  }, [choix])

  function choisir(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    const erreur = verifierFichier(fichier, REGLE_IMAGE)
    setRefus(erreur)
    if (erreur) return
    remplacer.reset()
    setChoix({ fichier, apercu: URL.createObjectURL(fichier) })
  }

  const image = choix?.apercu ?? depart.imageSeo

  return (
    <section className={styles.section}>
      <TitreDeSection titre="L’image des pages SEO" icone={sectionNouvelles} />
      <Bloc>
        <div className={`${styles.formulaire ?? ''} ${styles.carte ?? ''}`}>
          <div className={styles.vignette}>
            {image && <img className={styles.image} src={image} alt="" />}
            <span className={styles.puce}>runesdechene.com/mouvement</span>
          </div>
          <p className={styles.legende}>Le fond de la page /mouvement, la porte des pages publiques.</p>
          <p className={styles.nuit}>Une nouvelle image apparaît au prochain passage de la nuit.</p>
          <label className={styles.boutonContour}>
            Remplacer l’image
            <input type="file" accept={REGLE_IMAGE.types.join(',')} disabled={remplacer.isPending} onChange={choisir} />
          </label>
          {choix && (
            <div className={styles.pied}>
              <button type="button" className={styles.boutonContour} disabled={remplacer.isPending}
                onClick={() => { setChoix(null) }}>Annuler</button>
              <button type="button" className={styles.bouton} disabled={remplacer.isPending}
                onClick={() => { remplacer.mutate({ fichier: choix.fichier, ancienne: depart.imageSeo }, { onSuccess: () => { setChoix(null) } }) }}>
                Enregistrer l’image
              </button>
            </div>
          )}
          {refus && <p role="alert" className={styles.erreur}>{refus}</p>}
          {remplacer.isSuccess && <p role="status" className={styles.aide}>Image enregistrée.</p>}
          {remplacer.isError && <p role="alert" className={styles.erreur}>{remplacer.error.message}</p>}
        </div>
      </Bloc>
    </section>
  )
}

export function Reglages() {
  const { data, error } = useReglages()
  return (
    <div className={styles.ecran}>
      <EnTeteDePage surtitre="Réglages" titre="Ce qui part vers les joueurs"
        phrase="La phrase qu’un Explorateur envoie en partageant un lieu, et l’image des pages publiques." />
      <ParlerAuxJoueurs />
      {error && <p role="alert" className={styles.erreur}>Les réglages n’ont pas pu se charger : {error.message}</p>}
      {data && (
        <div className={styles.blocs}>
          <TexteDePartage depart={data} />
          <ImageSeo depart={data} />
        </div>
      )}
    </div>
  )
}
