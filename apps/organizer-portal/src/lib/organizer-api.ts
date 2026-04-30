import { demoOrganizerSnapshot, type OrganizerSnapshot } from "./demo-data";

export interface OrganizerApi {
  getSnapshot(): Promise<OrganizerSnapshot>;
}

export class DemoOrganizerApi implements OrganizerApi {
  async getSnapshot(): Promise<OrganizerSnapshot> {
    return demoOrganizerSnapshot;
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestInit & { organizerId?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (options.organizerId) {
    headers.set("x-organizer-id", options.organizerId);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
