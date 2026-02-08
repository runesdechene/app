import { Migration } from '@mikro-orm/migrations';

export class Migration20240530082000 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "users" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "email_address" varchar(255) not null, "password" varchar(255) not null, "first_name" varchar(255) not null, "last_name" varchar(255) not null, "birth_date" timestamptz not null, "role" varchar(255) not null, "gender" varchar(255) not null, "rank" varchar(255) not null, constraint "users_pkey" primary key ("id"));');
    this.addSql('alter table "users" add constraint "users_email_address_unique" unique ("email_address");');

    this.addSql('create table "refresh_tokens" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "value" varchar(255) not null, "expires_at" timestamptz not null, "disabled" boolean not null, constraint "refresh_tokens_pkey" primary key ("id"));');
    this.addSql('create index "refresh_tokens_user_id_index" on "refresh_tokens" ("user_id");');
    this.addSql('alter table "refresh_tokens" add constraint "refresh_tokens_value_unique" unique ("value");');

    this.addSql('create table "password_resets" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "code" varchar(255) not null, "expires_at" timestamptz not null, "is_consumed" boolean not null, constraint "password_resets_pkey" primary key ("id"));');
    this.addSql('create index "password_resets_user_id_index" on "password_resets" ("user_id");');

    this.addSql('create table "member_codes" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) null, "code" varchar(255) not null, "is_consumed" boolean not null, constraint "member_codes_pkey" primary key ("id"));');
    this.addSql('create index "member_codes_user_id_index" on "member_codes" ("user_id");');
    this.addSql('alter table "member_codes" add constraint "member_codes_user_id_unique" unique ("user_id");');
    this.addSql('alter table "member_codes" add constraint "member_codes_code_unique" unique ("code");');

    this.addSql('alter table "refresh_tokens" add constraint "refresh_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "password_resets" add constraint "password_resets_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;');

    this.addSql('alter table "member_codes" add constraint "member_codes_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete set null;');
  }

}
