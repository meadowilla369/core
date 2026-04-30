import { useEffect, useState } from "react";
import { DemoOrganizerApi, type OrganizerApi } from "./organizer-api";
import type { OrganizerSnapshot } from "./demo-data";

const defaultApi = new DemoOrganizerApi();

export interface OrganizerDataState {
  data: OrganizerSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

export function useOrganizerSnapshot(api: OrganizerApi = defaultApi): OrganizerDataState {
  const [data, setData] = useState<OrganizerSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    setError(null);

    try {
      setData(await api.getSnapshot());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load organizer data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [api]);

  return { data, isLoading, error, refresh };
}
