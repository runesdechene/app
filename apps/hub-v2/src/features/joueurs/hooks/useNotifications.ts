/**
 * QUOI     — la lecture du tableau de bord des notifications.
 */
import { useQuery } from '@tanstack/react-query'
import { lireNotificationsDuHub } from '../api/notifications'

export function useNotifications() {
  return useQuery({ queryKey: ['hub-notifications'], queryFn: lireNotificationsDuHub })
}
