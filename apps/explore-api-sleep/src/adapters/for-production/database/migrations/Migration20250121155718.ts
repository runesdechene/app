import { Migration } from '@mikro-orm/migrations';

export class Migration20250121155718 extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table "reviews" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "place_id" varchar(255) not null, "score" int not null, "message" text not null, constraint "reviews_pkey" primary key ("id"));');
    this.addSql('create index "reviews_user_id_index" on "reviews" ("user_id");');
    this.addSql('create index "reviews_place_id_index" on "reviews" ("place_id");');

    this.addSql('create table "reviews_images" ("review_id" varchar(255) not null, "image_media_id" varchar(255) not null, constraint "reviews_images_pkey" primary key ("review_id", "image_media_id"));');

    this.addSql('alter table "reviews" add constraint "reviews_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "reviews" add constraint "reviews_place_id_foreign" foreign key ("place_id") references "places" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "reviews_images" add constraint "reviews_images_review_id_foreign" foreign key ("review_id") references "reviews" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "reviews_images" add constraint "reviews_images_image_media_id_foreign" foreign key ("image_media_id") references "image_media" ("id") on update cascade on delete cascade;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "reviews_images" drop constraint "reviews_images_review_id_foreign";');

    this.addSql('drop table if exists "reviews" cascade;');

    this.addSql('drop table if exists "reviews_images" cascade;');
  }

}
