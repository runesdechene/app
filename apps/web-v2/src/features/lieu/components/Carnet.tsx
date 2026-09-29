/**
 * QUOI     — le Carnet de passage d'un lieu (maquette Figma « Lieu — le carnet de passage (sur la
 *            fiche) », validée par Uriel le 30/09) : le titre et le nombre de mots, écrire, puis
 *            les mots — qui, « est venu·e » s'il a visité le lieu, quand, le texte, les photos,
 *            ♥ (un par personne, Uriel 30/09), « Répondre » (un seul niveau), « Effacer » pour le sien.
 * POURQUOI — les commentaires de la V1 reviennent sous la fiche, dans le ton de la V2. Sur la fiche,
 *            les trois derniers mots et « Lire les N mots » ; la page du carnet les montre tous.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { ilYA } from '@/shared/lib/ilYA'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { Avatar } from '@/shared/ui/Avatar'
import type { Mot } from '../api/lireLieu'
import { useCarnet } from '../hooks/useCarnet'
import { EcrireAuCarnet } from './EcrireAuCarnet'
import styles from './Carnet.module.css'

const pluriel = (n: number) => `${String(n)} ${n > 1 ? 'mots' : 'mot'}`

export function Carnet({ id, limite }: { id: string; limite: number | null }) {
  const { carnet, ecrire, aimer, effacer } = useCarnet(id, limite)
  if (!carnet) return null

  const actions = { ecrire: ecrire.mutate, enCours: ecrire.isPending, aimer, effacer }

  return (
    <section
      className={styles.carnet}
      aria-label="Carnet de passage"
      data-page={limite === null || undefined}
    >
      <h3 className={styles.titre}>
        Carnet de passage
        {carnet.total > 0 && <span className={styles.compte}>{pluriel(carnet.total)}</span>}
      </h3>
      <p className={styles.chapo}>
        Ce que les Explorateurs ont laissé ici : conseils, souvenirs, ce qui a changé.
      </p>
      <EcrireAuCarnet onEcrire={ecrire.mutate} enCours={ecrire.isPending} erreur={ecrire.error} />
      <ul className={styles.mots}>
        {carnet.mots.map((m) => (
          <li key={m.id}>
            <MotDuCarnet mot={m} actions={actions} />
          </li>
        ))}
      </ul>
      {limite !== null &&
        carnet.total > carnet.mots.reduce((n, m) => n + 1 + m.reponses.length, 0) && (
          <Link className={styles.tout} to="carnet" relative="path" state={VENU_D_UN_ECRAN}>
            Lire les {pluriel(carnet.total)} ›
          </Link>
        )}
    </section>
  )
}

type Actions = {
  ecrire: Parameters<typeof EcrireAuCarnet>[0]['onEcrire']
  enCours: boolean
  aimer: (mot: number) => void
  effacer: (mot: number) => void
}

function MotDuCarnet({
  mot,
  actions,
  parent = null,
}: {
  mot: Mot
  actions: Actions
  parent?: number | null
}) {
  const [repondre, setRepondre] = useState(false)
  const [effacer, setEffacer] = useState(false)

  return (
    <article className={styles.mot} data-reponse={parent !== null || undefined}>
      <Avatar url={mot.qui.avatar} nom={mot.qui.nom} taille={parent === null ? 'petit' : 'mini'} />
      <div className={styles.corps}>
        <p className={styles.tete}>
          <strong className={styles.qui}>{mot.qui.nom}</strong>
          {mot.venu && <span className={styles.venu}>est venu·e</span>}
          <span className={styles.quand}>· {ilYA(mot.quand)}</span>
        </p>
        <p className={styles.texteMot}>{mot.texte}</p>
        {mot.photos.length > 0 && (
          <div className={styles.photos}>
            {mot.photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        )}
        <div className={styles.actions}>
          {mot.aMoi ? (
            mot.coeurs > 0 && (
              <span className={styles.coeurs}>
                <span className={styles.coeur} aria-hidden="true" />
                {mot.coeurs}
              </span>
            )
          ) : (
            <button
              type="button"
              className={styles.coeurs}
              aria-label={`J’aime ce mot (${String(mot.coeurs)})`}
              aria-pressed={mot.miens > 0}
              onClick={() => {
                actions.aimer(mot.id)
              }}
            >
              <span className={styles.coeur} aria-hidden="true" />
              {mot.coeurs > 0 && mot.coeurs}
            </button>
          )}
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              setRepondre((r) => !r)
            }}
          >
            Répondre
          </button>
          {mot.aMoi &&
            (effacer ? (
              <>
                <button
                  type="button"
                  className={styles.effacer}
                  onClick={() => {
                    actions.effacer(mot.id)
                  }}
                >
                  Effacer ce mot
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    setEffacer(false)
                  }}
                >
                  Garder
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.actionDiscrete}
                onClick={() => {
                  setEffacer(true)
                }}
              >
                Effacer
              </button>
            ))}
        </div>
        {repondre && (
          <EcrireAuCarnet
            parent={parent ?? mot.id}
            indication={`Répondre à ${mot.qui.nom}…`}
            onEcrire={actions.ecrire}
            enCours={actions.enCours}
            erreur={null}
            onEcrit={() => {
              setRepondre(false)
            }}
          />
        )}
        {mot.reponses.map((r) => (
          <MotDuCarnet key={r.id} mot={r} actions={actions} parent={mot.id} />
        ))}
      </div>
    </article>
  )
}
