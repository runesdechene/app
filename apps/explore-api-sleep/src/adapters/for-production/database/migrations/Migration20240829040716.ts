import { Migration } from '@mikro-orm/migrations';

export class Migration20240829040716 extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table "users" alter column "birth_date" type timestamptz using ("birth_date"::timestamptz);');
    this.addSql('alter table "users" alter column "birth_date" drop not null;');
    this.addSql('alter table "users" alter column "gender" type varchar(255) using ("gender"::varchar(255));');
    this.addSql('alter table "users" alter column "gender" drop not null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "users" alter column "birth_date" type timestamptz(6) using ("birth_date"::timestamptz(6));');
    this.addSql('alter table "users" alter column "birth_date" set not null;');
    this.addSql('alter table "users" alter column "gender" type varchar(255) using ("gender"::varchar(255));');
    this.addSql('alter table "users" alter column "gender" set not null;');
  }

}
