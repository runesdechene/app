import { Migration } from '@mikro-orm/migrations';

export class Migration20250130042322 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "places" alter column "geocaching" type boolean using ("geocaching"::boolean);',
    );
    this.addSql(
      'alter table "places" alter column "bivouac" boolean text using ("bivouac"::boolean);',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "places" alter column "geocaching" type boolean using ("geocaching"::boolean);',
    );
    this.addSql(
      'alter table "places" alter column "bivouac" type varchar(255) using ("bivouac"::varchar(255));',
    );
  }
}
