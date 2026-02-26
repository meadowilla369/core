export interface SecureStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

export class InMemorySecureStorage implements SecureStorage {
  private readonly data = new Map<string, string>();

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }
}
