/**
 * QUOI     — si l'invitation « Apparaître sur la carte » a déjà été vue sur cet appareil.
 * POURQUOI — l'invitation elle-même s'en sert pour ne venir qu'une fois, et l'invitation à
 *            installer pour attendre son tour.
 * ATTENTION — gardé sur l'appareil ; s'il ne peut pas l'être (navigation privée), l'invitation
 *            reviendra à la prochaine ouverture, sans plus.
 */
const VUE = 'invitation-position-vue'

export function invitationPositionVue() {
  try {
    return localStorage.getItem(VUE) === '1'
  } catch {
    return false
  }
}

export function marquerInvitationPositionVue() {
  try {
    localStorage.setItem(VUE, '1')
  } catch {
    // Rien à faire : elle reviendra à la prochaine ouverture.
  }
}
