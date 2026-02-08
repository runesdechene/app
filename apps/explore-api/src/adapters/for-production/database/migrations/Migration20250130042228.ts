import { Migration } from '@mikro-orm/migrations';

export class Migration20250130042228 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "users" add column "instagram_id" varchar(255) null, add column "website_url" varchar(255) null;',
    );

    this.addSql(
      'alter table "places" add column "accessibility" varchar(255) null, add column "best_season" varchar(255) null, add column "geocaching" boolean null, add column "bivouac" varchar(255) null;',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "users" drop column "instagram_id", drop column "website_url";',
    );

    this.addSql(
      'alter table "places" drop column "accessibility", drop column "best_season", drop column "geocaching", drop column "bivouac";',
    );
  }
}
