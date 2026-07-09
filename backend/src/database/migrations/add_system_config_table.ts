import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建 system_config 表
  await knex.schema.createTable('system_config', (table) => {
    table.string('key', 255).primary();
    table.text('value');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 插入默认的 Claude agents 路径设置
  await knex('system_config').insert({
    key: 'claude_agents_path',
    value: null // 默认为空，需要用户自行设置
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('system_config');
}