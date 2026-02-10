export const cap = (text: string, max: number) =>
  text.length > max ? `${text.substring(0, max)}...` : text
