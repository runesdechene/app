import { Migration } from '@mikro-orm/migrations';

export class Migration20240530124630 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index "member_codes_code_index" on "member_codes" ("code");');
  }

  async down(): Promise<void> {
    this.addSql('drop index "member_codes_code_index";');
  }

}
