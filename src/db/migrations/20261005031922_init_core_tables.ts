import type { Knex } from "knex";
//merchant :  id, name, email, webhook\_url, webhook\_secret, status
//api keys id, merchant\_id, key\_prefix, key\_hash, revoked\_at

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("merchants", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("name").notNullable();
    t.text("email").notNullable().unique();
    t.text("webhook_url");
    t.text("webhook_secret");
    t.text("status").notNullable().defaultTo("active");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("api_keys", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("merchant_id").notNullable().references("id").inTable("merchants");
    t.text("key_prefix").notNullable().index();
    t.text("key_hash").notNullable();
    t.timestamp("revoked_at");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("orders",(t)=>{
    t.uuid('id').primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid('merchant_id').notNullable().references("id").inTable("merchants");
    t.bigint('amount').notNullable();
    t.string('currency').notNullable().defaultTo("INR");
    t.text('receipt');
    t.text('status').notNullable().defaultTo('crated');
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw('ALTER TABLE orders ADD CONSTRAINT orders_amount_positive CHECK (amount>0)');

  await knex.schema.createTable('payments',(t)=>{
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("order_id").notNullable().references("id").inTable("orders");
    t.bigint('amount').notNullable();
    t.text('status').notNullable().defaultTo('created');
    t.text('bank_ref');
    t.text('failure_reason');
    t.integer('version').notNullable().defaultTo(0);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  })

  await knex.raw(`ALTER TABLE payments ADD CONSTRAINT payment_status_valid CHECK (status IN  ('created','authorized','unknown','failed','captured','refunded'))`)
  await knex.raw(`ALTER TABLE payments ADD CONSTRAINT orders_amount_positive CHECK (amount>0) `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('payments');
  await knex.schema.dropTable('orders');
  await knex.schema.dropTable('api_keys');
  await knex.schema.dropTable('merchants');
}
