import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (t) => {
    t.text("methodType").defaultTo("card");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (t) => {
    t.dropColumn("methodType");
  });
}
