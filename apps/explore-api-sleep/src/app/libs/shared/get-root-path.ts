import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

export const getRootPath = () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url));

  const rootPath = [
    path.join(dirname, '..', '..', '..'),
    path.join(dirname, '..', '..', '..', '..'),
  ].find((p) => fs.existsSync(path.join(p, 'package.json')));

  if (!rootPath) {
    throw new Error('Root path not found');
  }

  return rootPath;
};
