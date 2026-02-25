export interface ApiClientConfig {
  baseUrl: string;
  accessToken?: string;
}

export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}
