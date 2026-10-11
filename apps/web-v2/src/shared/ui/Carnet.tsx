/**
 * QUOI     — un carnet (maquette Figma « Lieu — le carnet de passage (sur la fiche) », validée par
 *            Uriel le 30/09) : le titre et le nombre de mots, écrire, puis les mots — qui, « est
 *            venu·e » s'il a visité le lieu, quand, le texte, les photos, ♥ (un par personne, Uriel
 *            30/09), « Répondre » (un seul niveau), « Effacer » pour le sien.
 * POURQUOI — le même carnet sous la fiche d'un lieu et sous une mise à jour (Uriel, 11/10 : « tout
 *            pareil ») : il reçoit le carnet lu et les actions de qui l'affiche, et ne parle jamais
 *            à la base. Les textes d'en-tête et l'indication du champ viennent de lui aussi.
 */
import type { ReactNode } from 'react'
import { useState } from 'react'
import { aLaTaille } from '@/shared/lib/image'
import type { Carnet as LeCarnet, Mot } from '@/shared/lib/carnet'
import { ilYA } from '@/shared/lib/ilYA'
import { Avatar } from './Avatar'
import { EcrireAuCarnet, type Ecrit } from './EcrireAuCarnet'
import styles from './Carnet.module.css'

const pluriel = (n: number) => `${String(n)} ${n > 1 ? 'mots' : 'mot'}`

export type ActionsDuCarnet = {
  ecrire: (ecrit: Ecrit, options: { onSuccess: () => void }) => void
  enCours: boolean
  erreur: unknown
  aimer: (mot: number) => void
  effacer: (mot: number) => void
}

export function Carnet({
  carnet,
  actions,
  titre,
  chapo,
  indication,
  page = false,
  lireTout,
}: {
  carnet: LeCarnet
  actions: ActionsDuCarnet
  titre: string
  chapo: string
  indication: string
  page?: boolean
  lireTout?: ReactNode
}) {
  return (
    <section className={styles.carnet} aria-label={titre} data-page={page || undefined}>
      <h3 className={styles.titre}>
        {titre}
        {carnet.total > 0 && <span className={styles.compte}>{pluriel(carnet.total)}</span>}
      </h3>
      <p className={styles.chapo}>{chapo}</p>
      <EcrireAuCarnet
        indication={indication}
        onEcrire={actions.ecrire}
        enCours={actions.enCours}
        erreur={actions.erreur}
      />
      <ul className={styles.mots}>
        {carnet.mots.map((m) => (
          <li key={m.id}>
            <MotDuCarnet mot={m} actions={actions} />
          </li>
        ))}
      </ul>
      {lireTout}
    </section>
  )
}

function MotDuCarnet({
  mot,
  actions,
  parent = null,
}: {
  mot: Mot
  actions: ActionsDuCarnet
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
                <img src={aLaTaille(url, 72)} alt="" loading="lazy" decoding="async" />
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
          {mot.peutEffacer &&
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
