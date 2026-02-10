import { Migration } from '@mikro-orm/migrations';

export class Migration20240829042913 extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table "users" alter column "password" type varchar(255) using ("password"::varchar(255));');
    this.addSql('alter table "users" alter column "password" drop not null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "users" alter column "password" type varchar(255) using ("password"::varchar(255));');
    this.addSql('alter table "users" alter column "password" set not null;');
  }

}
