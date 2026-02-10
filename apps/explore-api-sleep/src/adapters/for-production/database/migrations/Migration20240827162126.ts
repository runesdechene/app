import { Migration } from '@mikro-orm/migrations';

export class Migration20240827162126 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "image_media" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "variants" jsonb not null, constraint "image_media_pkey" primary key ("id"));',
    );
    this.addSql(
      'create index "image_media_user_id_index" on "image_media" ("user_id");',
    );

    this.addSql(
      'alter table "image_media" add constraint "image_media_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;',
    );

    this.addSql(
      'alter table "users" add column "profile_image_id" varchar(255) null;',
    );
    this.addSql(
      'alter table "users" add constraint "users_profile_image_id_foreign" foreign key ("profile_image_id") references "image_media" ("id") on update cascade on delete set null;',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "users" drop constraint "users_profile_image_id_foreign";',
    );

    this.addSql('drop table if exists "image_media" cascade;');

    this.addSql('alter table "users" drop column "profile_image_id";');
  }
}
