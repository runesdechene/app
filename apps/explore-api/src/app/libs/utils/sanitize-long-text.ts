export const sanitizeLongText = (value: any) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
