import { useState } from "react";
import { Calendar, CalendarClock, History, MapPin, RefreshCw, Tag, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  assembleTx4,
  buildMarketplaceCancelTx,
  type SignedAuthorization
} from "@ticket-platform/sdk-client";
import MobileLayout from "@/components/mobile/MobileLayout";
import TicketCard from "@/components/mobile/TicketCard";
import { pastTicketsFallback, upcomingTicketsFallback } from "@/lib/fallback-data";
import { useMyTickets } from "@/hooks/use-tickets";
import { useApiClient } from "@/providers/AppProviders";
import { formatVnd } from "@/lib/format";
import {
  getSessionUserId,
  getSessionWallet,
  getSessionWalletAddress,
  signSessionAuthorization
} from "@/lib/session";
import { webAppConfig } from "@/lib/config";
import { toast } from "@ticket-platform/shared-ui";
import type { TicketOwnershipView } from "@/lib/ticket-loader";

const tabs = [
  { id: "upcoming", label: "Sắp tới", icon: CalendarClock },
  { id: "past", label: "Đã qua", icon: History }
] as const;

const TicketsPage = () => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("upcoming");
  const { data, isError, isLoading, isFetching, refetch } = useMyTickets();
  const client = useApiClient();
  const qc = useQueryClient();

  const delistMutation = useMutation({
    mutationFn: async (ticket: TicketOwnershipView) => {
      if (!ticket.onChainListingId) throw new Error("Chưa có on-chain listing ID.");
      const wallet = getSessionWallet();
      if (!wallet.privateKey) throw new Error("Private key không có trong session.");

      const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
      const chain = defineChain({
        id: webAppConfig.chainId,
        name: "localchain",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [webAppConfig.rpcUrl] } }
      });
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(webAppConfig.rpcUrl)
      });

      const txDraft = buildMarketplaceCancelTx({
        marketplaceAddress: webAppConfig.marketplaceAddress,
        handlerAddress: webAppConfig.handlerAddress,
        listingId: BigInt(ticket.onChainListingId),
        chainId: BigInt(webAppConfig.chainId),
        nonce: 0n
      });
      const signedAuthorization: SignedAuthorization = await signSessionAuthorization({
        authorization: {
          address: txDraft.authorizationTuple.address,
          chainId: txDraft.authorizationTuple.chainId
        }
      });
      const payload = txDraft.assemble(signedAuthorization);
      const tx = assembleTx4(payload, getSessionWalletAddress() as `0x${string}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await walletClient.sendTransaction({
        account,
        to: tx.to ?? account.address,
        data: tx.data,
        value: tx.value,
        authorizationList: tx.authorizationList,
        chain
      } as any);

      if (ticket.listingId) {
        await client.deleteMarketplaceListing(ticket.listingId, { userId: getSessionUserId() });
      }
    },
    onSuccess: () => {
      toast({ title: "Đã gỡ bán", description: "Vé đang được trả về ví của bạn." });
      void qc.invalidateQueries({ queryKey: ["tickets", "me"] });
    },
    onError: (error) => {
      toast({
        title: "Gỡ bán thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive"
      });
    }
  });
  const upcomingTickets = data?.upcoming ?? (isError ? upcomingTicketsFallback : []);
  const pastTickets = data?.past ?? (isError ? pastTicketsFallback : []);
  const isPartial = data?.status === "partial";

  const tickets = activeTab === "upcoming" ? upcomingTickets : pastTickets;
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? "Sắp tới";

  return (
    <MobileLayout>
      <header className="sticky safe-area-sticky-top z-40 bg-background/95 backdrop-blur-sm">
        <div className="border-b border-foreground/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-medium tracking-tight">Vé Của Tôi</h1>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-foreground/20 transition-colors hover:bg-foreground/10 disabled:opacity-50"
              aria-label="Làm mới danh sách vé"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-foreground/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex min-h-[52px] items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-foreground/40 hover:text-foreground/70"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span className="text-foreground/35">
                {tab.id === "upcoming" ? upcomingTickets.length : pastTickets.length}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
              )}
            </button>
          ))}
        </div>
      </header>

      {(isError || isPartial) && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            {isError
              ? "Ticketing chưa sẵn sàng. Đang dùng vé fallback cho demo."
              : "Một phần ticketing chưa sẵn sàng. Đang hiển thị vé đã sync/local trước."}
          </p>
        </div>
      )}

      <section className="p-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse border border-foreground/10 bg-foreground/5"
            />
          ))
        ) : tickets.length > 0 ? (
          tickets.map((ticket) =>
            ticket.listingStatus === "active" ? (
              <div
                key={ticket.id}
                className="relative block overflow-hidden border border-yellow-500/40 bg-card"
              >
                <div className="absolute left-0 top-0 h-full w-1 bg-yellow-500/70" />

                <div className="border-b border-dashed border-foreground/20 p-4 pl-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/50">
                      {ticket.ticketType}
                    </span>
                    <span className="border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-yellow-300">
                      ĐANG BÁN
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-medium leading-tight tracking-tight">
                    {ticket.eventName}
                  </h3>
                </div>

                <div className="p-4 pl-5 space-y-2">
                  <div className="flex items-center gap-2 text-foreground/65">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono text-xs">
                      {ticket.date} · {ticket.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground/65">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono text-xs">{ticket.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                    <span className="font-mono text-sm font-medium text-yellow-300">
                      {formatVnd(ticket.askPrice ?? 0)}
                    </span>
                    {ticket.originalPrice && (
                      <span className="font-mono text-xs text-foreground/40 line-through">
                        {formatVnd(ticket.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-foreground/10 bg-foreground/5 px-4 py-3 pl-5">
                  <span className="font-mono text-[10px] text-foreground/40">
                    {ticket.onChainListingId
                      ? `On-chain #${ticket.onChainListingId}`
                      : "Chờ xác nhận on-chain..."}
                  </span>
                  <button
                    disabled={delistMutation.isPending || !ticket.onChainListingId}
                    onClick={() => delistMutation.mutate(ticket)}
                    className="flex items-center gap-1.5 border border-red-500/40 px-3 py-1.5 font-mono text-[10px] text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                    GỠ BÁN
                  </button>
                </div>
              </div>
            ) : (
              <TicketCard key={ticket.id} {...ticket} />
            )
          )
        ) : (
          <div className="py-16 text-center">
            <p className="font-mono text-foreground/40">Chưa có vé nào</p>
            <Link
              to="/discover"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center border border-foreground px-6 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background"
            >
              TÌM SỰ KIỆN
            </Link>
          </div>
        )}
      </section>

      {!isLoading && tickets.length > 0 && (
        <div className="p-4 border-t border-foreground/10">
          <span className="font-mono text-xs text-foreground/40">
            {tickets.length} VÉ {activeLabel.toUpperCase()}
          </span>
        </div>
      )}
    </MobileLayout>
  );
};

export default TicketsPage;
