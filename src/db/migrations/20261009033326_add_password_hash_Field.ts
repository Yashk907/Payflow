import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('merchants',(t)=>{
        t.text("password_hash").notNullable();
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('merchants',(t)=>{
        t.dropColumn("password_hash");
    })
}

