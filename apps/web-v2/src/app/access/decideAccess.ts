/**
 * QUOI     — décide, à partir de l'état de la session, si la V2 s'ouvre.
 * POURQUOI — fonction pure : toute la logique de la garde tient ici et se teste sans navigateur.
 *            Le hook (useV2Access) récupère l'état, le composant (AccessGate) applique.
 * ATTENTION — une erreur réseau ne renvoie PAS vers la V1 : un compte autorisé hors connexion
 *            doit pouvoir réessayer, pas être éjecté.
 */
export type AccessState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; hasSession: boolean; hasAccess: boolean }

export type AccessDecision = 'wait' | 'allow' | 'leave' | 'retry'

export function decideAccess(state: AccessState): AccessDecision {
  switch (state.status) {
    case 'loading':
      return 'wait'
    case 'error':
      return 'retry'
    case 'ready':
      return state.hasSession && state.hasAccess ? 'allow' : 'leave'
  }
}
