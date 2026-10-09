/**
 * QUOI     — gérer une Compagnie (maquette 390:258), pour le Chef et les Officiers : la fiche ; les
 *            noms des rôles au masculin et au féminin (Chef) ; les demandes ; les membres (nommer ou
 *            retirer un officier, retirer un membre) ; « Passer la main à un autre Chef… » (Chef).
 * POURQUOI — une Compagnie s'entretient à plusieurs, mais seul le Chef nomme et passe la main
 *            (Uriel, 05/10) ; la base vérifie chaque geste.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { canauxKey } from '@/shared/lib/cles'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Feuille } from '@/shared/ui/Feuille'
import { changerRole, modifier, repondre, retirer } from '../api/compagnies'
import type { ChampsFiche, FicheCompagnie, Roles } from '../api/lireCompagnies'
import { compagnieKey, useCompagnie } from '../hooks/useCompagnie'
import { compagniesKey } from '../hooks/useCompagnies'
import { messageDeRefus } from '../lib/refus'
import { nomDuRole } from '../lib/roles'
import { ChampsCompagnie } from './ChampsCompagnie'
import styles from './GererCompagnie.module.css'

export function GererCompagnie({ id }: { id: string }) {
  const { fiche, erreur } = useCompagnie(id)
  if (erreur) return <EmptyState>La Compagnie n’a pas pu être chargée</EmptyState>
  if (fiche === undefined) return <div aria-busy="true" />
  if (fiche === null) return <EmptyState>Cette Compagnie n’existe plus.</EmptyState>
  if (fiche.monRole === null || fiche.monRole === 'membre') {
    return <EmptyState>Gérer est réservé au Chef et aux Officiers.</EmptyState>
  }
  return <Gestion fiche={fiche} />
}

function Gestion({ fiche }: { fiche: FicheCompagnie }) {
  const queryClient = useQueryClient()
  const chef = fiche.monRole === 'chef'
  const [valeur, setValeur] = useState<ChampsFiche>({
    nom: fiche.nom,
    devise: fiche.devise ?? '',
    mission: fiche.mission ?? '',
    couleur: fiche.couleur,
    avatar: fiche.avatar,
    privee: fiche.privee,
  })
  const [roles, setRoles] = useState<Roles>(fiche.roles)
  const [passer, setPasser] = useState(false)
  const relire = () => {
    void queryClient.invalidateQueries({ queryKey: compagnieKey(fiche.id) })
    void queryClient.invalidateQueries({ queryKey: compagniesKey })
    void queryClient.invalidateQueries({ queryKey: canauxKey })
  }
  const enregistrer = useMutation({
    mutationFn: () =>
      modifier(fiche.id, {
        ...valeur,
        nom: valeur.nom.trim(),
        devise: valeur.devise.trim(),
        mission: valeur.mission.trim(),
        ...(chef && roles),
      }),
    onSuccess: relire,
  })
  const geste = useMutation({
    mutationFn: (g: () => Promise<void>) => g(),
    onSuccess: relire,
  })

  const membres = fiche.membres.filter((m) => m.role !== 'chef')

  return (
    <div className={styles.ecran}>
      <h2 className={styles.titre}>Gérer la Compagnie</h2>
      <ChampsCompagnie
        valeur={valeur}
        changer={(partiel) => {
          setValeur((avant) => ({ ...avant, ...partiel }))
        }}
      />

      {chef && (
        <section className={styles.section} aria-labelledby="roles">
          <h3 id="roles" className={styles.sousTitre}>
            Les rôles
          </h3>
          <div className={styles.paire}>
            <ChampRole
              libelle="Le Chef, au masculin"
              valeur={roles.chefM}
              changer={(v) => {
                setRoles({ ...roles, chefM: v })
              }}
            />
            <ChampRole
              libelle="Le Chef, au féminin"
              valeur={roles.chefF}
              changer={(v) => {
                setRoles({ ...roles, chefF: v })
              }}
            />
            <ChampRole
              libelle="Les Officiers, au masculin"
              valeur={roles.officierM}
              changer={(v) => {
                setRoles({ ...roles, officierM: v })
              }}
            />
            <ChampRole
              libelle="Les Officiers, au féminin"
              valeur={roles.officierF}
              changer={(v) => {
                setRoles({ ...roles, officierF: v })
              }}
            />
          </div>
        </section>
      )}

      {enregistrer.isError && (
        <p className={styles.refus} role="alert">
          {messageDeRefus(enregistrer.error)}
        </p>
      )}
      <Button
        disabled={valeur.nom.trim().length < 2 || enregistrer.isPending}
        onClick={() => {
          enregistrer.mutate()
        }}
      >
        {enregistrer.isSuccess ? 'Enregistré' : 'Enregistrer'}
      </Button>

      {fiche.demandes.length > 0 && (
        <section className={styles.section} aria-labelledby="demandes">
          <h3 id="demandes" className={styles.sousTitre}>
            Demandes ({fiche.demandes.length})
          </h3>
          <ul className={styles.liste}>
            {fiche.demandes.map((d) => (
              <li key={d.id} className={styles.ligne}>
                <Avatar url={d.avatar} nom={d.nom} taille="petit" />
                <span className={styles.qui}>
                  <span className={styles.nom}>{d.nom}</span>
                  {d.mot && <span className={styles.mot}>« {d.mot} »</span>}
                </span>
                <button
                  type="button"
                  className={styles.discret}
                  disabled={geste.isPending}
                  onClick={() => {
                    geste.mutate(() => repondre(fiche.id, d.id, false))
                  }}
                >
                  Refuser
                </button>
                <button
                  type="button"
                  className={styles.accepter}
                  disabled={geste.isPending}
                  onClick={() => {
                    geste.mutate(() => repondre(fiche.id, d.id, true))
                  }}
                >
                  Accepter
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="membres">
        <h3 id="membres" className={styles.sousTitre}>
          Les membres ({fiche.membres.length})
        </h3>
        <ul className={styles.liste}>
          {membres.map((m) => (
            <li key={m.id} className={styles.ligne}>
              <Avatar url={m.avatar} nom={m.nom} taille="petit" />
              <span className={styles.qui}>
                <span className={styles.nom}>{m.nom}</span>
                <span className={styles.role}>{nomDuRole(fiche.roles, m.role, m.genre)}</span>
              </span>
              {chef && (
                <button
                  type="button"
                  className={styles.lien}
                  aria-label={
                    m.role === 'officier'
                      ? `Retirer le rôle : ${m.nom}`
                      : `Nommer ${fiche.roles.officierM} / ${fiche.roles.officierF} : ${m.nom}`
                  }
                  disabled={geste.isPending}
                  onClick={() => {
                    geste.mutate(() =>
                      changerRole(fiche.id, m.id, m.role === 'officier' ? 'membre' : 'officier'),
                    )
                  }}
                >
                  {m.role === 'officier'
                    ? 'Retirer le rôle'
                    : `Nommer ${fiche.roles.officierM} / ${fiche.roles.officierF}`}
                </button>
              )}
              {(chef || m.role === 'membre') && (
                <button
                  type="button"
                  className={styles.discret}
                  aria-label={`Retirer ${m.nom} de la Compagnie`}
                  disabled={geste.isPending}
                  onClick={() => {
                    geste.mutate(() => retirer(fiche.id, m.id))
                  }}
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {geste.isError && (
        <p className={styles.refus} role="alert">
          {messageDeRefus(geste.error)}
        </p>
      )}

      {chef && membres.length > 0 && (
        <button
          type="button"
          className={styles.passer}
          onClick={() => {
            setPasser(true)
          }}
        >
          Passer la main à un autre Chef…
        </button>
      )}

      {passer && (
        <Feuille
          titre="Passer la main"
          onFermer={() => {
            setPasser(false)
          }}
        >
          <p className={styles.aide}>
            Le membre choisi devient {fiche.roles.chefM} / {fiche.roles.chefF} ; tu restes{' '}
            {fiche.roles.officierM} / {fiche.roles.officierF}.
          </p>
          <ul className={styles.liste}>
            {membres.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={styles.choix}
                  aria-label={`Confier la Compagnie à ${m.nom}`}
                  onClick={() => {
                    geste.mutate(() => changerRole(fiche.id, m.id, 'chef'))
                    setPasser(false)
                  }}
                >
                  <Avatar url={m.avatar} nom={m.nom} taille="petit" />
                  {m.nom}
                </button>
              </li>
            ))}
          </ul>
        </Feuille>
      )}
    </div>
  )
}

function ChampRole({
  libelle,
  valeur,
  changer,
}: {
  libelle: string
  valeur: string
  changer: (v: string) => void
}) {
  return (
    <label className={styles.champRole}>
      <span className={styles.etiquette}>{libelle}</span>
      <input
        className={styles.saisie}
        maxLength={30}
        value={valeur}
        onChange={(e) => {
          changer(e.target.value)
        }}
      />
    </label>
  )
}
