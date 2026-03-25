interface SaveBarProps {
  hasChanges: boolean
  saving: boolean
  error: string | null
  onSave: () => void
  onCancel: () => void
}

export function SaveBar({ hasChanges, saving, error, onSave, onCancel }: SaveBarProps) {
  if (!hasChanges && !error) return null

  return (
    <div className={`save-bar${error ? ' save-bar-error' : ''}`}>
      <div className="save-bar-content">
        {error ? (
          <span className="save-bar-error-text">{error}</span>
        ) : (
          <span className="save-bar-text">Modifications non sauvegardees</span>
        )}
        <div className="save-bar-actions">
          <button
            className="save-bar-cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            className="save-bar-save"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
