/**
 * QUOI     — le lecteur du récit d'un Fragment (maquette 101:187) : le bouton lecture, « Écoute son
 *            récit », une ligne dessous, la progression qu'on peut tirer, le temps écoulé et la durée.
 * POURQUOI — l'élément `<audio>` du navigateur fait tout le travail ; ce composant n'en est que l'habit.
 *            La progression est un curseur (`input range`) : elle se règle aussi au clavier.
 */
import { useRef, useState } from 'react'
import lecture from '@/assets/ui/lecture.svg'
import pause from '@/assets/ui/pause.svg'
import { duree } from '../lib/duree'
import styles from './LecteurAudio.module.css'

export function LecteurAudio({ src, ligne }: { src: string; ligne: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [enLecture, setEnLecture] = useState(false)
  const [temps, setTemps] = useState(0)
  const [total, setTotal] = useState(0)

  const basculer = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) void a.play()
    else a.pause()
  }

  return (
    <div className={styles.lecteur}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => {
          setEnLecture(true)
        }}
        onPause={() => {
          setEnLecture(false)
        }}
        onLoadedMetadata={(e) => {
          setTotal(e.currentTarget.duration)
        }}
        onTimeUpdate={(e) => {
          setTemps(e.currentTarget.currentTime)
        }}
      />
      <button type="button" className={styles.bouton} onClick={basculer} aria-label={enLecture ? 'Mettre en pause' : 'Écouter son récit'}>
        <img src={enLecture ? pause : lecture} alt="" width={54} height={54} />
      </button>
      <div className={styles.piste}>
        <p className={styles.titre}>Écoute son récit</p>
        <p className={styles.ligne}>{ligne}</p>
        <input
          type="range"
          className={styles.progression}
          aria-label="Progression du récit"
          min={0}
          max={total || 1}
          step={1}
          value={temps}
          style={{ '--mesure': String(total ? temps / total : 0) }}
          onChange={(e) => {
            const a = audio.current
            if (a) a.currentTime = Number(e.target.value)
          }}
        />
        <p className={styles.temps}>
          <span>{duree(temps)}</span>
          <span>{duree(total)}</span>
        </p>
      </div>
    </div>
  )
}
