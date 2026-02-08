import { Migration } from '@mikro-orm/migrations';

export class Migration20240910044803 extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table "place_types" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "parent_id" varchar(255) null, "title" varchar(255) not null, "form_description" varchar(255) not null, "long_description" varchar(255) not null, "images" jsonb not null, "color" varchar(255) not null, "order" int not null, constraint "place_types_pkey" primary key ("id"));');
    this.addSql('create index "place_types_parent_id_index" on "place_types" ("parent_id");');

    this.addSql('create table "places" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "author_id" varchar(255) not null, "place_type_id" varchar(255) not null, "title" varchar(255) not null, "text" text not null, "address" varchar(255) not null, "latitude" real not null, "longitude" real not null, "private" boolean not null, "masked" boolean not null, "images" jsonb not null, constraint "places_pkey" primary key ("id"));');
    this.addSql('create index "places_author_id_index" on "places" ("author_id");');
    this.addSql('create index "places_place_type_id_index" on "places" ("place_type_id");');

    this.addSql('create table "places_viewed" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "place_id" varchar(255) not null, constraint "places_viewed_pkey" primary key ("id"));');
    this.addSql('create index "places_viewed_user_id_index" on "places_viewed" ("user_id");');
    this.addSql('create index "places_viewed_place_id_index" on "places_viewed" ("place_id");');

    this.addSql('create table "places_liked" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "place_id" varchar(255) not null, constraint "places_liked_pkey" primary key ("id"));');
    this.addSql('create index "places_liked_user_id_index" on "places_liked" ("user_id");');
    this.addSql('create index "places_liked_place_id_index" on "places_liked" ("place_id");');

    this.addSql('create table "places_explored" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "place_id" varchar(255) not null, constraint "places_explored_pkey" primary key ("id"));');
    this.addSql('create index "places_explored_user_id_index" on "places_explored" ("user_id");');
    this.addSql('create index "places_explored_place_id_index" on "places_explored" ("place_id");');

    this.addSql('create table "places_bookmarked" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "place_id" varchar(255) not null, constraint "places_bookmarked_pkey" primary key ("id"));');
    this.addSql('create index "places_bookmarked_user_id_index" on "places_bookmarked" ("user_id");');
    this.addSql('create index "places_bookmarked_place_id_index" on "places_bookmarked" ("place_id");');

    this.addSql('alter table "place_types" add constraint "place_types_parent_id_foreign" foreign key ("parent_id") references "place_types" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "places" add constraint "places_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "places" add constraint "places_place_type_id_foreign" foreign key ("place_type_id") references "place_types" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "places_viewed" add constraint "places_viewed_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "places_viewed" add constraint "places_viewed_place_id_foreign" foreign key ("place_id") references "places" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "places_liked" add constraint "places_liked_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "places_liked" add constraint "places_liked_place_id_foreign" foreign key ("place_id") references "places" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "places_explored" add constraint "places_explored_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "places_explored" add constraint "places_explored_place_id_foreign" foreign key ("place_id") references "places" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "places_bookmarked" add constraint "places_bookmarked_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "places_bookmarked" add constraint "places_bookmarked_place_id_foreign" foreign key ("place_id") references "places" ("id") on update cascade on delete cascade;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "place_types" drop constraint "place_types_parent_id_foreign";');

    this.addSql('alter table "places" drop constraint "places_place_type_id_foreign";');

    this.addSql('alter table "places_viewed" drop constraint "places_viewed_place_id_foreign";');

    this.addSql('alter table "places_liked" drop constraint "places_liked_place_id_foreign";');

    this.addSql('alter table "places_explored" drop constraint "places_explored_place_id_foreign";');

    this.addSql('alter table "places_bookmarked" drop constraint "places_bookmarked_place_id_foreign";');

    this.addSql('drop table if exists "place_types" cascade;');

    this.addSql('drop table if exists "places" cascade;');

    this.addSql('drop table if exists "places_viewed" cascade;');

    this.addSql('drop table if exists "places_liked" cascade;');

    this.addSql('drop table if exists "places_explored" cascade;');

    this.addSql('drop table if exists "places_bookmarked" cascade;');
  }

}
