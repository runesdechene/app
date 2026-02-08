import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { allEntities } from './src/adapters/for-production/database/all-entities.js';

if (!process.env.DATABASE_URL) {
  // Run these command using ENVFILE=.env.prod pnpm orm:up for example
  const envFile = process.env.ENVFILE ?? '.env';
  console.log('Environment file : ' + envFile);

  dotenv.config({
    path: envFile,
  });
} else {
  console.log('Loading from environment variables');
}

const DATABASE_URL = process.env.DATABASE_URL;
const USE_SSL = process.env.DATABASE_USE_SSL === 'yes';

export default defineConfig({
  clientUrl: DATABASE_URL,
  entities: allEntities,
  extensions: [Migrator],
  migrations: {
    tableName: 'mikro_orm_migrations',
    path: './src/adapters/for-production/database/migrations',
    pathTs: './src/adapters/for-production/database/migrations',
    glob: '*.{js,ts}',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    emit: 'ts',
  },
  debug: true,
  metadataProvider: TsMorphMetadataProvider,
  ...(USE_SSL
    ? {
        driverOptions: {
          connection: {
            ssl: {
              rejectUnauthorized: false,
              ca: fs.readFileSync('./certificate.crt').toString(),
            },
          },
        },
      }
    : {}),
});
