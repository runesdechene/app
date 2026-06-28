// Fallback de chargement neutre (aux couleurs de l'app) — utilisé par le
// Suspense racine (le temps qu'un chunk de route arrive) et par l'Error
// Boundary pendant le reload de récupération. Remplace l'ancien `fallback={null}`
// qui faisait passer tout chargement lent pour un écran blanc/crash.

export function AppLoader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.1rem',
        background: '#f8f3e7',
        color: '#5a4632',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          border: '3px solid #d8cbb0',
          borderTopColor: '#5a4632',
          borderRadius: '50%',
          animation: 'app-loader-spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.95rem' }}>{label}</span>
      <style>{'@keyframes app-loader-spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}
