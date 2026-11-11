/**
 * QUOI     — /soumettre-contenu : un client laisse son avis, puis, s'il le veut, ses photos en tenue
 *            Runes de Chêne, puis son prénom et son e-mail. Trois étapes ; le lien d'une mission
 *            (`?quete=<slug>`) présélectionne la mission à l'étape des photos.
 * POURQUOI — le design de la page en ligne (ancien StudioSubmit), gardé par Uriel le 15/10 : sur PC,
 *            une carte à deux panneaux posée sur la photo du réglage Studio ; au téléphone, le
 *            formulaire seul, plein écran. L'avis d'abord et les photos ensuite (Uriel, 11/11) : on
 *            n'a rien à choisir avant d'écrire, et on peut ajouter une photo après. L'écran est dans
 *            l'adresse (`?etape=2`) : le retour du navigateur revient d'un écran, et un écran tapé à
 *            la main n'ouvre jamais plus loin que ce qui est rempli.
 */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PagePublique } from '../PagePublique'
import { lireConfigStudio, lireMissions } from './api'
import { EtapeAvis } from './EtapeAvis'
import { EtapeContenus } from './EtapeContenus'
import { EtapeTailles } from './EtapeTailles'
import { EtapeToi } from './EtapeToi'
import { Frise } from './Frise'
import { ECRANS, ETAPES, etapeAffichee, etapeDeLaFrise, HISTOIRE_VIDE, TOI_VIDE, VETEMENTS, type Contenu } from './lib/formulaire'
import { Succes } from './Succes'
import { useEnvoi } from './useEnvoi'
import styles from './PageSoumettre.module.css'

function liberer(apercus: Set<string>) {
  for (const apercu of apercus) URL.revokeObjectURL(apercu)
  apercus.clear()
}

export function PageSoumettre() {
  const [params, setParams] = useSearchParams()
  const missions = useQuery({ queryKey: ['soumettre', 'missions'], queryFn: lireMissions })
  const config = useQuery({ queryKey: ['soumettre', 'config'], queryFn: lireConfigStudio })
  const [contenus, setContenus] = useState<Contenu[]>([])
  // Les adresses d'aperçu encore ouvertes : libérées au retrait, à l'envoi réussi et en quittant.
  const [apercus] = useState(() => new Set<string>())
  // Le lien de l'e-mail de demande d'avis pré-remplit le vêtement et l'adresse ; rien de plus.
  const [histoire, setHistoire] = useState(() => {
    const type = params.get('type') ?? ''
    return VETEMENTS.some((v) => v.cle === type) ? { ...HISTOIRE_VIDE, vetement: type } : HISTOIRE_VIDE
  })
  const [toi, setToi] = useState(() => ({ ...TOI_VIDE, email: params.get('email') ?? '' }))
  const { envoyer, progression, erreur, reussite } = useEnvoi()

  useEffect(
    () => () => {
      liberer(apercus)
    },
    [apercus],
  )

  const ecran = etapeAffichee(params.get('etape'), histoire, contenus)
  const avecPhotos = contenus.length > 0
  const quete = params.get('quete') ?? ''
  const mission = missions.data?.some((m) => m.slug === quete) ? quete : ''

  function allerA(n: number) {
    setParams((p) => {
      const suite = new URLSearchParams(p)
      suite.set('etape', String(n))
      return suite
    })
  }

  function choisirMission(slug: string) {
    setParams(
      (p) => {
        const suite = new URLSearchParams(p)
        if (slug) suite.set('quete', slug)
        else suite.delete('quete')
        return suite
      },
      { replace: true },
    )
  }

  function ajouter(fichiers: File[]) {
    const nouveaux = fichiers.map((fichier) => ({ fichier, apercu: URL.createObjectURL(fichier), taille: null }))
    for (const c of nouveaux) apercus.add(c.apercu)
    setContenus((cs) => [...cs, ...nouveaux])
  }

  function retirer(rang: number) {
    const contenu = contenus[rang]
    if (contenu) {
      URL.revokeObjectURL(contenu.apercu)
      apercus.delete(contenu.apercu)
    }
    setContenus((cs) => cs.filter((_, i) => i !== rang))
  }

  function choisirTaille(rang: number, taille: string) {
    setContenus((cs) => cs.map((c, i) => (i === rang ? { ...c, taille } : c)))
  }

  const fond = config.data?.fond
  const colonne = config.data?.colonne

  function changerHistoire(modif: Partial<typeof histoire>) {
    setHistoire((h) => ({ ...h, ...modif }))
  }

  let corps
  if (reussite) {
    corps = <Succes reussite={reussite} couronnes={config.data?.couronnes ?? 0} avisSeul={!avecPhotos} />
  } else if (progression) {
    corps = (
      <div className={styles.attente}>
        <span className={styles.roue} />
        <p role="status">{progression}</p>
      </div>
    )
  } else {
    corps = (
      <div className={styles.console}>
        <aside className={styles.colonne}>
          {colonne && <img className={styles.imageColonne} src={colonne} alt="" />}
          <div className={styles.colonneDedans}>
            <p className={styles.marque}>Runes de Chêne</p>
            <h1 className={styles.titre}>Ton avis</h1>
            <Frise etapes={ETAPES} etape={etapeDeLaFrise(ecran)} sens="vertical" />
            <p className={styles.citation}>« On te guide pas à pas. Quelques minutes, et ton avis rejoint le Mouvement. »</p>
          </div>
        </aside>

        <section className={styles.panneau}>
          <Frise etapes={ETAPES} etape={etapeDeLaFrise(ecran)} sens="horizontal" />
          {ecran === ECRANS.avis && (
            <EtapeAvis
              histoire={histoire}
              changer={changerHistoire}
              suivant={() => {
                allerA(ECRANS.photos)
              }}
            />
          )}
          {ecran === ECRANS.photos && (
            <EtapeContenus
              missions={missions.data ?? []}
              mission={mission}
              choisirMission={choisirMission}
              contenus={contenus}
              ajouter={ajouter}
              retirer={retirer}
              precedent={() => {
                allerA(ECRANS.avis)
              }}
              suivant={() => {
                allerA(avecPhotos ? ECRANS.tailles : ECRANS.toi)
              }}
            />
          )}
          {ecran === ECRANS.tailles && (
            <EtapeTailles
              contenus={contenus}
              choisirTaille={choisirTaille}
              precedent={() => {
                allerA(ECRANS.photos)
              }}
              suivant={() => {
                allerA(ECRANS.toi)
              }}
            />
          )}
          {ecran === ECRANS.toi && (
            <EtapeToi
              avecPhotos={avecPhotos}
              toi={toi}
              changer={(modif) => {
                setToi((t) => ({ ...t, ...modif }))
              }}
              histoire={histoire}
              changerHistoire={changerHistoire}
              erreur={erreur}
              precedent={() => {
                allerA(avecPhotos ? ECRANS.tailles : ECRANS.photos)
              }}
              envoyer={() => {
                void envoyer(contenus, histoire, toi, mission).then((reussi) => {
                  if (reussi) liberer(apercus)
                })
              }}
            />
          )}
        </section>
      </div>
    )
  }

  return (
    <PagePublique titre="Ton avis — Runes de Chêne" disposition="carte" photo={fond ? <img className={styles.fond} src={fond} alt="" /> : undefined}>
      {corps}
    </PagePublique>
  )
}
