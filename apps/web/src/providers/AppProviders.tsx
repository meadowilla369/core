import { PropsWithChildren, createContext, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ApiClient } from "@ticket-platform/sdk-client";
import { SonnerToaster, Toaster, TooltipProvider } from "@ticket-platform/shared-ui";
import { webAppConfig } from "../lib/config";

const queryClient = new QueryClient();
const apiClient = new ApiClient({ baseUrl: webAppConfig.apiBaseUrl });

const ApiClientContext = createContext<ApiClient>(apiClient);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientContext.Provider value={apiClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider>
            <Toaster />
            <SonnerToaster />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </ApiClientContext.Provider>
    </QueryClientProvider>
  );
}

export function useApiClient(): ApiClient {
  return useContext(ApiClientContext);
}
