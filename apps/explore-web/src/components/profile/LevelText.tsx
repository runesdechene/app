import './LevelText.css'

interface Props {
  level: number
}

export function LevelText({ level }: Props) {
  return <span className="level-text">Niveau {level}</span>
}
