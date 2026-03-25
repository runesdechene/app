import { memo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'

interface PlayerTitle {
  icon: string
  name: string
}

interface OnlinePlayer {
  userId: string
  name: string
  avatarUrl: string | null
  factionColor: string | null
  displayedTitles: PlayerTitle[]
  composedPhrase: string | null
  position: { lng: number; lat: number }
}

interface Props {
  players: Map<string, OnlinePlayer>
  onSelectPlayer: (id: string) => void
}

export const OnlinePlayerMarkers = memo(function OnlinePlayerMarkers({ players, onSelectPlayer }: Props) {
  return (
    <>
      {Array.from(players.values()).map(player => (
        <Marker key={player.userId} longitude={player.position.lng} latitude={player.position.lat} anchor="center">
          <div
            className="other-player-marker"
            style={{
              '--faction-color': player.factionColor ?? '#888',
            } as React.CSSProperties}
            onClick={() => onSelectPlayer(player.userId)}
          >
            {player.avatarUrl ? (
              <img src={player.avatarUrl} alt="" className="other-player-avatar" />
            ) : (
              <div className="other-player-dot" />
            )}
            <span className="other-player-name">{player.name}</span>
            {player.composedPhrase && (
              <span className="other-player-composed">{player.composedPhrase}</span>
            )}
          </div>
        </Marker>
      ))}
    </>
  )
})
