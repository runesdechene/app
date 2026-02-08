import { Migration } from '@mikro-orm/migrations';

export class Migration20240923144224 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "users" add column "biography" varchar(255) not null default \'\';',
    );
  }

  override async down(): Promise<void> {
    this.addSql('alter table "users" drop column "biography";');
  }
}
