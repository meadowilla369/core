import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Shield,
  Sparkles,
  User
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assembleTx4,
  buildMarketplaceBuyTx,
  MockEOASigner,
  type MarketplaceBroadcastData,
  type MarketplaceBuyHashData
} from "@ticket-platform/sdk-client";
import MobileLayout from "@/components/mobile/MobileLayout";
import { useMarketplaceListing } from "@/hooks/use-marketplace-listing";
import { eventDetailFallback } from "@/lib/fallback-data";
import { formatMediumEventDate, formatTime, formatVnd } from "@/lib/format";
import { webAppConfig } from "@/lib/config";
import { getSessionUserId, getSessionWalletAddress } from "@/lib/session";
import { useApiClient } from "@/providers/AppProviders";
import { toast } from "@ticket-platform/shared-ui";

interface PreparedBuyState {
  backend: MarketplaceBuyHashData;
  txDraft: ReturnType<typeof buildMarketplaceBuyTx>;
}

interface BroadcastedBuyState {
  signedAuthorization: Awaited<ReturnType<MockEOASigner["signAuthorization"]>>;
  tx: ReturnType<typeof assembleTx4>;
  backend: MarketplaceBroadcastData;
}

const fallbackListing = {
  id: "l1",
  sellerUserId: "user_8x2k",
  sellerWalletAddress: "0x2222222222222222222222222222222222222222",
  tokenId: "ticket_1",
  askPrice: 4200000,
  originalPrice: 3500000,
  status: "active",
  createdAt: new Date().toISOString()
};

const ResalePurchasePage = () => {
  const { ticketId } = useParams();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { data, isError, isLoading } = useMarketplaceListing(ticketId);
  const [onChainListingId, setOnChainListingId] = useState("1");
  const [authorizationNonce, setAuthorizationNonce] = useState("0");
  const [prepared, setPrepared] = useState<PreparedBuyState | null>(null);
  const [broadcasted, setBroadcasted] = useState<BroadcastedBuyState | null>(null);

  const listing = data?.listing ?? fallbackListing;
  const event = data?.event;
  const displayEvent = event
    ? {
        name: event.title,
        date: formatMediumEventDate(event.startAt),
        time: formatTime(event.startAt),
        location: `${event.venue}, ${event.city}`,
        tier:
          event.ticketTypes.find((item) => item.id === listing.tokenId)?.name ??
          event.ticketTypes[0]?.name ??
          "Resale"
      }
    : {
        name: eventDetailFallback.name,
        date: eventDetailFallback.date,
        time: eventDetailFallback.time,
        location: eventDetailFallback.location,
        tier: "VIP"
      };

  const feePreview = useMemo(() => {
    const platformFee = Math.floor(listing.askPrice * 0.05);
    const blockchainFee = 15000;
    return {
      platformFee,
      blockchainFee,
      total: listing.askPrice + platformFee + blockchainFee
    };
  }, [listing.askPrice]);

  const prepareBuyMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) {
        throw new Error("Missing listing id");
      }

      const response = await client.initiateMarketplaceBuy(
        ticketId,
        {
          orderId: `ord_web_${ticketId}_${Date.now()}`,
          amount: listing.askPrice,
          buyerWalletAddress: getSessionWalletAddress(),
          onChainListingId: Number(onChainListingId)
        },
        { userId: getSessionUserId() }
      );

      const txDraft = buildMarketplaceBuyTx({
        marketplaceAddress: response.data.domain.verifyingContract,
        handlerAddress: webAppConfig.handlerAddress,
        listingId: BigInt(Number(onChainListingId)),
        paymentHash: response.data.paymentHash,
        signature: response.data.signature,
        chainId: BigInt(response.data.domain.chainId),
        nonce: BigInt(Number(authorizationNonce))
      });

      return {
        backend: response.data,
        txDraft
      };
    },
    onSuccess: (result) => {
      setPrepared(result);
      setBroadcasted(null);
      toast({
        title: "Đã chuẩn bị lệnh mua on-chain",
        description: "Backend đã cấp paymentHash/signature và FE đã build calldata batch."
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Không thể chuẩn bị lệnh mua";
      toast({
        title: "Chuẩn bị thất bại",
        description: message,
        variant: "destructive"
      });
    }
  });

  const broadcastBuyMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId || !prepared) {
        throw new Error("Buy flow has not been prepared");
      }

      const signer = new MockEOASigner(getSessionWalletAddress() as `0x${string}`);
      const signedAuthorization = await signer.signAuthorization(
        prepared.txDraft.authorizationTuple,
        prepared.txDraft.authorizationHash
      );
      const payload = prepared.txDraft.assemble(signedAuthorization);
      const tx = assembleTx4(payload, signer.address);
      const response = await client.broadcastMarketplaceBuy(
        ticketId,
        {
          authorizationHash: prepared.txDraft.authorizationHash,
          signedAuthorization,
          tx: {
            to: tx.to,
            data: tx.data,
            chainId: tx.chainId
          },
          paymentId: `pay_${prepared.backend.orderId}`,
          gateway: "momo",
          gatewayReference: `gw_web_${prepared.backend.orderId}`
        },
        {
          userId: getSessionUserId(),
          idempotencyKey: `broadcast:${prepared.backend.orderId}`
        }
      );

      return {
        signedAuthorization,
        tx,
        backend: response.data
      };
    },
    onSuccess: async (result) => {
      setBroadcasted(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets", "me"] }),
        queryClient.invalidateQueries({ queryKey: ["profile", "summary"] })
      ]);
      toast({
        title:
          result.backend.sync.status === "confirmed"
            ? "Đã broadcast và sync xong"
            : "Đã broadcast, sync đang degraded",
        description:
          result.backend.sync.status === "confirmed"
            ? "Listing đã completed, contract-sync đã phản ánh owner mới và UI đang refetch."
            : (result.backend.sync.error ??
              "Broadcast xong nhưng contract-sync chưa xác nhận hoàn toàn.")
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Không thể ký và broadcast";
      toast({
        title: "Broadcast thất bại",
        description: message,
        variant: "destructive"
      });
    }
  });

  const copyJson = async (value: unknown, label: string) => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    toast({
      title: "Đã copy",
      description: `${label} đã được copy vào clipboard`
    });
  };

  return (
    <MobileLayout>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/marketplace"
            className="w-10 h-10 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-medium tracking-tight">Mua Vé Resale</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Listing #{ticketId ?? listing.id}
            </p>
          </div>
        </div>
      </header>

      {isError && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            Không đọc được listing thật. Bạn vẫn xem được UI, nhưng chưa nên kiểm tra flow này khi
            backend chưa có listing tương ứng.
          </p>
        </div>
      )}

      <section className="p-4">
        <div className="border border-foreground/20 overflow-hidden">
          <div className="aspect-[3/1] bg-muted/30 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="px-2 py-0.5 bg-foreground/10 backdrop-blur-sm border border-foreground/20 font-mono text-[8px] tracking-widest uppercase">
                {displayEvent.tier}
              </span>
            </div>
          </div>

          <div className="p-4">
            <h2 className="text-xl font-medium tracking-tight">{displayEvent.name}</h2>
            <p className="font-mono text-xs text-foreground/50 mt-1">
              {displayEvent.date} · {displayEvent.location}
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label: "Giờ", value: displayEvent.time },
                { label: "Token", value: listing.tokenId },
                { label: "DB ID", value: listing.id }
              ].map((item) => (
                <div key={item.label} className="border border-foreground/10 p-2.5 text-center">
                  <span className="font-mono text-[9px] text-foreground/40 block">
                    {item.label}
                  </span>
                  <span className="text-sm font-medium tracking-tight block mt-0.5 break-all">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ NGƯỜI BÁN ]
        </h3>
        <div className="border border-foreground/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted border border-foreground/20 flex items-center justify-center">
                <User className="w-4 h-4 text-foreground/50" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm">{listing.sellerUserId}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
                <p className="font-mono text-[10px] text-foreground/50 break-all">
                  {listing.sellerWalletAddress}
                </p>
              </div>
            </div>
            <span className="font-mono text-[9px] text-foreground/40">
              {new Date(listing.createdAt).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>
      </section>

      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ CHI TIẾT GIÁ ]
        </h3>
        <div className="border border-foreground/20 divide-y divide-foreground/10">
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Giá gốc</span>
            <span className="font-mono text-xs text-foreground/40 line-through">
              {formatVnd(listing.originalPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Giá bán lại</span>
            <span className="font-mono text-xs font-medium">{formatVnd(listing.askPrice)}</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Phí nền tảng (5%)</span>
            <span className="font-mono text-xs">{formatVnd(feePreview.platformFee)}</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Phí blockchain</span>
            <span className="font-mono text-xs">{formatVnd(feePreview.blockchainFee)}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-foreground/5">
            <span className="font-mono text-sm font-medium">Tổng cộng</span>
            <span className="text-lg font-medium tracking-tight">
              {formatVnd(feePreview.total)}
            </span>
          </div>
        </div>
      </section>

      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ PREPARE FLOW ]
        </h3>
        <div className="border border-foreground/20 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[10px] text-foreground/50 block mb-2">
                On-chain listing ID
              </span>
              <input
                value={onChainListingId}
                onChange={(event) => setOnChainListingId(event.target.value)}
                className="w-full bg-transparent border border-foreground/20 px-3 py-2 font-mono text-xs outline-none"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] text-foreground/50 block mb-2">
                Authorization nonce
              </span>
              <input
                value={authorizationNonce}
                onChange={(event) => setAuthorizationNonce(event.target.value)}
                className="w-full bg-transparent border border-foreground/20 px-3 py-2 font-mono text-xs outline-none"
              />
            </label>
          </div>

          <div className="border border-green-600/30 bg-green-600/5 p-3 flex items-start gap-3">
            <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs font-medium text-green-600">FE to BE to Contract Draft</span>
              <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                Nút dưới sẽ gọi `marketplace-service initiate-buy`, nhận `paymentHash/signature`,
                rồi build calldata `MarketplaceV2.buyWithSignature()` và `Handler.executeBatch()`.
              </p>
            </div>
          </div>

          <div className="border border-foreground/10 p-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-foreground/40 mt-0.5 flex-shrink-0" />
            <p className="font-mono text-[10px] text-foreground/40">
              `onChainListingId` phải khớp listing id trên contract `MarketplaceV2`. Database
              listing id hiện không tự map sang on-chain id.
            </p>
          </div>
        </div>
      </section>

      {prepared && (
        <section className="px-4 pb-6 space-y-4">
          <div className="border border-foreground/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                  [ BACKEND PAYLOAD ]
                </h3>
              </div>
              <button
                onClick={() => copyJson(prepared.backend, "Backend payload")}
                className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
              >
                <Copy className="w-3 h-3 inline-block mr-1" />
                COPY
              </button>
            </div>
            <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
              {JSON.stringify(prepared.backend, null, 2)}
            </pre>
          </div>

          <div className="border border-foreground/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                [ CONTRACT TX DRAFT ]
              </h3>
              <button
                onClick={() =>
                  copyJson(
                    {
                      authorizationTuple: prepared.txDraft.authorizationTuple,
                      authorizationHash: prepared.txDraft.authorizationHash,
                      businessCalldata: prepared.txDraft.businessCalldata,
                      executeBatchCalldata: prepared.txDraft.executeBatchCalldata,
                      calls: prepared.txDraft.calls
                    },
                    "Contract draft"
                  )
                }
                className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
              >
                <Copy className="w-3 h-3 inline-block mr-1" />
                COPY
              </button>
            </div>
            <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
              {JSON.stringify(
                {
                  authorizationTuple: prepared.txDraft.authorizationTuple,
                  authorizationHash: prepared.txDraft.authorizationHash,
                  businessCalldata: prepared.txDraft.businessCalldata,
                  executeBatchCalldata: prepared.txDraft.executeBatchCalldata,
                  calls: prepared.txDraft.calls
                },
                (_, value) => (typeof value === "bigint" ? value.toString() : value),
                2
              )}
            </pre>
          </div>

          <div className="border border-foreground/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                [ WALLET SIGN ]
              </h3>
              {broadcasted && (
                <button
                  onClick={() => copyJson(broadcasted.signedAuthorization, "Wallet signature")}
                  className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
                >
                  <Copy className="w-3 h-3 inline-block mr-1" />
                  COPY
                </button>
              )}
            </div>
            <p className="font-mono text-[10px] text-foreground/40 mb-3">
              Sau khi prepare, FE dùng `MockEOASigner` để ký `authorizationHash`, assemble type-4
              request rồi gọi `broadcast-buy` để backend finalize listing và đẩy event sang
              contract-sync.
            </p>
            {broadcasted ? (
              <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
                {JSON.stringify(broadcasted.signedAuthorization, null, 2)}
              </pre>
            ) : (
              <div className="border border-dashed border-foreground/20 p-3 font-mono text-[10px] text-foreground/40">
                Chưa ký. Nhấn “KÝ & BROADCAST” để chạy hết phần wallet + backend orchestration.
              </div>
            )}
          </div>

          {broadcasted && (
            <div className="border border-foreground/20 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                  [ BROADCAST & SYNC ]
                </h3>
                <button
                  onClick={() => copyJson(broadcasted.backend, "Broadcast result")}
                  className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
                >
                  <Copy className="w-3 h-3 inline-block mr-1" />
                  COPY
                </button>
              </div>

              <div
                className={`p-3 border ${
                  broadcasted.backend.sync.status === "confirmed"
                    ? "border-green-600/30 bg-green-600/5"
                    : "border-yellow-500/30 bg-yellow-500/10"
                }`}
              >
                <p className="font-mono text-[10px]">
                  TX hash: <span className="break-all">{broadcasted.backend.tx.hash}</span>
                </p>
                <p className="font-mono text-[10px] mt-1">
                  Sync status: {broadcasted.backend.sync.status}
                </p>
                {broadcasted.backend.sync.token && (
                  <p className="font-mono text-[10px] mt-1">
                    Owner synced: {broadcasted.backend.sync.token.ownerWalletAddress}
                  </p>
                )}
                {broadcasted.backend.sync.error && (
                  <p className="font-mono text-[10px] mt-1 text-yellow-200">
                    {broadcasted.backend.sync.error}
                  </p>
                )}
              </div>

              <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
                {JSON.stringify(broadcasted.backend, null, 2)}
              </pre>
            </div>
          )}
        </section>
      )}

      <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-foreground/40" />
            <span className="font-mono text-[10px] text-foreground/40">
              Buyer wallet: {getSessionWalletAddress().slice(0, 8)}...
            </span>
          </div>
          <span className="text-lg font-medium tracking-tight">{formatVnd(feePreview.total)}</span>
        </div>
        <button
          disabled={
            prepareBuyMutation.isPending ||
            broadcastBuyMutation.isPending ||
            isLoading ||
            !ticketId ||
            listing.status !== "active"
          }
          onClick={() => {
            if (prepared) {
              broadcastBuyMutation.mutate();
              return;
            }
            prepareBuyMutation.mutate();
          }}
          className="w-full py-4 bg-foreground text-background font-medium tracking-tight hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {listing.status !== "active"
            ? "LISTING ĐÃ KHÔNG CÒN ACTIVE"
            : prepareBuyMutation.isPending
              ? "ĐANG CHUẨN BỊ..."
              : broadcastBuyMutation.isPending
                ? "ĐANG KÝ & BROADCAST..."
                : prepared
                  ? "KÝ & BROADCAST"
                  : "CHUẨN BỊ LỆNH MUA ON-CHAIN"}
        </button>
      </div>
    </MobileLayout>
  );
};

export default ResalePurchasePage;
