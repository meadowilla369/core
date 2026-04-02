import { S3Client } from "@aws-sdk/client-s3";
import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";
import { createClient, type RedisClientType } from "redis";

export interface PostgresRuntimeConfig {
  connectionString: string;
  max: number;
}

export interface RedisRuntimeConfig {
  url: string;
}

export interface MinioRuntimeConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function buildPostgresConnectionString(env: NodeJS.ProcessEnv): string {
  const explicit = env.DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const host = env.POSTGRES_HOST?.trim() || "127.0.0.1";
  const port = env.POSTGRES_PORT?.trim() || "5432";
  const database = env.POSTGRES_DB?.trim() || "ticket_platform";
  const user = env.POSTGRES_USER?.trim() || "ticket_platform";
  const password = env.POSTGRES_PASSWORD?.trim() || "ticket_platform";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function createPostgresPool(
  env: NodeJS.ProcessEnv,
  overrides: Partial<PoolConfig> = {}
): Pool {
  return new Pool({
    connectionString: buildPostgresConnectionString(env),
    max: parseNumber(env.POSTGRES_POOL_MAX, 10),
    ...overrides
  });
}

export async function withPostgresClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withPostgresTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withPostgresClient(pool, async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function queryOne<T extends QueryResultRow>(
  client: Pool | PoolClient,
  text: string,
  values: unknown[] = []
): Promise<T | null> {
  const result = await client.query<T>(text, values);
  return result.rows[0] ?? null;
}

export async function queryMany<T extends QueryResultRow>(
  client: Pool | PoolClient,
  text: string,
  values: unknown[] = []
): Promise<T[]> {
  const result = await client.query<T>(text, values);
  return result.rows;
}

export function buildRedisUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.REDIS_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const host = env.REDIS_HOST?.trim() || "127.0.0.1";
  const port = env.REDIS_PORT?.trim() || "6379";
  return `redis://${host}:${port}`;
}

export function createRedisClientFromEnv(env: NodeJS.ProcessEnv): RedisClientType {
  return createClient({
    url: buildRedisUrl(env)
  });
}

export function buildMinioConfig(env: NodeJS.ProcessEnv): MinioRuntimeConfig {
  return {
    endpoint:
      env.MINIO_ENDPOINT?.trim() || `http://127.0.0.1:${env.MINIO_API_PORT?.trim() || "9000"}`,
    region: env.MINIO_REGION?.trim() || "us-east-1",
    accessKeyId: env.MINIO_ROOT_USER?.trim() || "minioadmin",
    secretAccessKey: env.MINIO_ROOT_PASSWORD?.trim() || "minioadmin",
    forcePathStyle: parseBoolean(env.MINIO_FORCE_PATH_STYLE, true)
  };
}

export function createMinioS3Client(env: NodeJS.ProcessEnv): S3Client {
  const config = buildMinioConfig(env);
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}
