import { memo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'

export interface TerritoryLabel {
  lon: number; lat: number
  emblemLon: number; emblemLat: number
  territoryId: number
  factionTitle: string; players: string; placesCount: number
  hourlyRate: number; totalFortification: number
  tagColor: string; pattern: string
  territoryTitle: string; customName: string | null
  anchorPlaceId: string; placeIds: string[]
  topContributorId: string; topContributorName: string
}

interface FortifiedPlace {
  id: string
  lon: number
  lat: number
  level: number
}

interface Props {
  labels: TerritoryLabel[]
  fortifiedPlaces: FortifiedPlace[]
  hoveredTerritoryId: number | null
  onTerritoryClick?: (label: TerritoryLabel) => void
}

export const TerritoryMarkers = memo(function TerritoryMarkers({
  labels, fortifiedPlaces, hoveredTerritoryId,
}: Props) {
  return (
    <>
      {/* Blasons flottants au centroïde de chaque territoire */}
      {labels.map((label, i) => (
        label.pattern ? (
          <Marker
            key={`emblem-${i}`}
            longitude={label.emblemLon}
            latitude={label.emblemLat}
            anchor="center"
          >
            <div className="territory-emblem-wrap">
              <div
                className="territory-emblem"
                style={{ '--emblem-color': label.tagColor } as React.CSSProperties}
              >
                <img src={label.pattern} alt="" className="territory-emblem-img" />
              </div>
              {label.hourlyRate > 0 && (
                <span className="territory-emblem-rate" style={{ color: label.tagColor }}>
                  +{label.hourlyRate % 1 === 0 ? label.hourlyRate : label.hourlyRate.toFixed(1)}/h
                </span>
              )}
              {label.customName && (
                <span className="territory-emblem-title" style={{ color: label.tagColor }}>
                  {label.customName}
                </span>
              )}
            </div>
          </Marker>
        ) : null
      ))}

      {/* Badge fortification sur les lieux fortifiés */}
      {fortifiedPlaces.map(p => (
        <Marker key={`fort-${p.id}`} longitude={p.lon} latitude={p.lat} anchor="center">
          <div className="place-fort-badge">{p.level}</div>
        </Marker>
      ))}

      {/* Labels texte au survol (point le plus au nord) */}
      {labels.map((label, i) => (
        label.players ? (
          <Marker
            key={`label-${i}`}
            longitude={label.lon}
            latitude={label.lat}
            anchor="bottom"
          >
            <div
              className={`territory-label${hoveredTerritoryId === label.territoryId ? ' visible' : ''}`}
              style={{ '--label-color': label.tagColor } as React.CSSProperties}
            >
              <div className="territory-label-title">
                {label.customName || label.factionTitle}
              </div>
              <div className="territory-label-count">{label.placesCount} lieu{label.placesCount > 1 ? 'x' : ''} controle{label.placesCount > 1 ? 's' : ''}</div>
            </div>
          </Marker>
        ) : null
      ))}
    </>
  )
})
