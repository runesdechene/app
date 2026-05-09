interface Props {
  onClose: () => void
}

// Stub Task 3.1 — implémentation complète en Task 3.2
export function BottomTabbarPlusMenu({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(42, 36, 24, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
      }}
    >
      Menu (+) — Task 3.2
    </div>
  )
}
