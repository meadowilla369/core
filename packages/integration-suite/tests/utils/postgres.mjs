import { createPostgresPool } from "../../../local-infra/dist/index.js";

function quoteIdentifier(identifier) {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe postgres identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

export async function resetPostgresTables(tables) {
  if (!Array.isArray(tables) || tables.length === 0) {
    return;
  }

  const pool = createPostgresPool(process.env, { max: 1 });

  try {
    const identifiers = tables.map(quoteIdentifier).join(", ");
    await pool.query(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);
  } finally {
    await pool.end();
  }
}
