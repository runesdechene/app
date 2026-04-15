// Wrapper localStorage avec try/catch — plante sinon en Safari iOS mode privé
// et dans certains contextes sandbox où localStorage jette QuotaExceededError.

export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch (err) {
      console.warn(`[safeStorage] getItem(${key}) failed`, err)
      return null
    }
  },

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch (err) {
      console.warn(`[safeStorage] setItem(${key}) failed`, err)
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (err) {
      console.warn(`[safeStorage] removeItem(${key}) failed`, err)
    }
  },
}
