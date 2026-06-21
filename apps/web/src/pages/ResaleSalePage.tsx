import { useState } from "react";
import { ArrowLeft, Info, Minus, Tag, TrendingUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  assembleTx4,
  buildMarketplaceListTx,
  type SignedAuthorization
} from "@ticket-platform/sdk-client";
import MobileLayout from "@/components/mobile/MobileLayout";
import { useMyTickets } from "@/hooks/use-tickets";
import { useApiClient } from "@/providers/AppProviders";
import { toast } from "@ticket-platform/shared-ui";
import {
  getSessionUserId,
  getSessionWallet,
  getSessionWalletAddress,
  signSessionAuthorization
} from "@/lib/session";
import { webAppConfig } from "@/lib/config";

const ResaleSalePage = () => {
  const navigate = useNavigate();
  const client = useApiClient();
  const { data: ticketData, isLoading } = useMyTickets();
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const availableTickets = (ticketData?.tickets ?? []).filter(
    (t) => t.listingStatus === "none" && !t.isUsed
  );

  const selected = availableTickets.find((t) => t.tokenId === selectedTokenId);

  const listMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !price) throw new Error("Chưa chọn vé hoặc chưa đặt giá");

      const askPrice = Number(price);
      if (isNaN(askPrice) || askPrice <= 0) throw new Error("Giá không hợp lệ");

      const userId = getSessionUserId();
      const walletAddress = getSessionWalletAddress();

      // 1. Tạo listing metadata record trên backend
      const listingResponse = await client.createMarketplaceListing(
        {
          tokenId: selected.tokenId,
          eventId: selected.eventId,
          originalPrice: selected.originalPrice ?? askPrice,
          askPrice,
          sellerWalletAddress: walletAddress
        },
        { userId, kycStatus: webAppConfig.defaultKycStatus }
      );

      // 2. Build EIP-7702 batch tx: [transferTicket, listTicket]
      const txDraft = buildMarketplaceListTx({
        ticketLedgerAddress: webAppConfig.ticketLedgerAddress,
        marketplaceAddress: webAppConfig.marketplaceAddress,
        handlerAddress: webAppConfig.handlerAddress,
        tokenId: BigInt(selected.tokenId),
        askPrice: BigInt(askPrice),
        chainId: BigInt(webAppConfig.chainId),
        nonce: 0n
      });

      // 3. Ký EIP-7702 authorization
      const signedAuthorization: SignedAuthorization = await signSessionAuthorization({
        authorization: {
          address: txDraft.authorizationTuple.address,
          chainId: txDraft.authorizationTuple.chainId
        }
      });

      // 4. Assemble type-4 tx
      const payload = txDraft.assemble(signedAuthorization);
      const tx = assembleTx4(payload, walletAddress as `0x${string}`);

      // 5. Broadcast lên chain qua viem walletClient
      const wallet = getSessionWallet();
      if (!wallet.privateKey) {
        throw new Error("Private key không có trong session. Chạy lại onboarding.");
      }

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txHash = await walletClient.sendTransaction({
        account,
        to: tx.to ?? account.address,
        data: tx.data,
        value: tx.value,
        authorizationList: tx.authorizationList,
        chain
      } as any);

      return {
        listingId: listingResponse.data.id,
        txHash
      };
    },
    onSuccess: ({ listingId, txHash }) => {
      toast({
        title: "Đã đăng bán thành công",
        description: `Listing ${listingId} · tx ${String(txHash).slice(0, 10)}...`
      });
      void navigate("/marketplace");
    },
    onError: (error) => {
      toast({
        title: "Đăng bán thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive"
      });
    }
  });

  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky safe-area-sticky-top z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/marketplace"
            className="w-10 h-10 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-medium tracking-tight">Đăng Bán Vé</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Bán vé trên chợ thứ cấp
            </p>
          </div>
        </div>
      </header>

      {/* Step 1: Select Ticket */}
      <section className="p-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ 01 — CHỌN VÉ ]
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-foreground/10" />
            ))}
          </div>
        ) : availableTickets.length === 0 ? (
          <p className="font-mono text-[10px] text-foreground/40 border border-foreground/10 p-4">
            Không có vé nào có thể đăng bán.
          </p>
        ) : (
          <div className="space-y-2">
            {availableTickets.map((ticket) => (
              <button
                key={ticket.tokenId}
                onClick={() => setSelectedTokenId(ticket.tokenId)}
                className={`w-full text-left border p-4 transition-colors ${
                  selectedTokenId === ticket.tokenId
                    ? "border-foreground bg-foreground/5"
                    : "border-foreground/20 hover:border-foreground/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium tracking-tight">{ticket.eventName}</h4>
                    <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                      {ticket.ticketType} · {ticket.seatInfo}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 border flex items-center justify-center ${
                      selectedTokenId === ticket.tokenId
                        ? "border-foreground bg-foreground"
                        : "border-foreground/30"
                    }`}
                  >
                    {selectedTokenId === ticket.tokenId && (
                      <div className="w-2 h-2 bg-background" />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Tag className="w-3 h-3 text-foreground/40" />
                  <span className="font-mono text-[10px] text-foreground/40">
                    Token: {ticket.tokenId}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 2: Set Price */}
      {selected && (
        <section className="px-4 pb-4">
          <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
            [ 02 — ĐẶT GIÁ ]
          </h3>
          <div className="border border-foreground/20 p-4">
            <label className="font-mono text-[10px] text-foreground/50 block mb-2">
              Giá bán (₫)
            </label>
            <div className="flex items-center border border-foreground/20">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent px-4 py-3 text-xl font-medium tracking-tight outline-none placeholder:text-foreground/20"
              />
              <span className="pr-4 font-mono text-sm text-foreground/40">₫</span>
            </div>

            <div className="flex gap-2 mt-3">
              {[
                { label: "Giá gốc", icon: Minus, multiplier: 1 },
                { label: "+10%", icon: TrendingUp, multiplier: 1.1 },
                { label: "+20%", icon: TrendingUp, multiplier: 1.2 }
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() =>
                    setPrice(String(Math.round((selected.originalPrice ?? 0) * btn.multiplier)))
                  }
                  disabled={!selected.originalPrice}
                  className="flex-1 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10 transition-colors disabled:opacity-30"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-foreground/40">Phí nền tảng (5%)</span>
                <span className="font-mono text-[10px] text-foreground/40">
                  {price ? `${Math.round(Number(price) * 0.05).toLocaleString("vi-VN")}₫` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-foreground/40">Bạn nhận được</span>
                <span className="font-mono text-xs font-medium">
                  {price ? `${Math.round(Number(price) * 0.95).toLocaleString("vi-VN")}₫` : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Terms */}
      {selected && price && (
        <section className="px-4 pb-4">
          <div className="border border-foreground/10 p-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-foreground/40 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-mono text-[10px] text-foreground/50">
                Khi đăng bán, vé sẽ được chuyển vào escrow và không thể sử dụng cho đến khi gỡ bán
                hoặc bán thành công.
              </p>
              <button
                onClick={() => setAcceptTerms(!acceptTerms)}
                className="flex items-center gap-2 mt-3"
              >
                <div
                  className={`w-4 h-4 border flex items-center justify-center ${
                    acceptTerms ? "border-foreground bg-foreground" : "border-foreground/30"
                  }`}
                >
                  {acceptTerms && <div className="w-1.5 h-1.5 bg-background" />}
                </div>
                <span className="font-mono text-[10px] text-foreground/60">
                  Tôi đồng ý điều khoản bán lại
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {selected && (
        <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
          <button
            disabled={!price || !acceptTerms || listMutation.isPending}
            onClick={() => listMutation.mutate()}
            className={`w-full py-4 font-medium tracking-tight transition-colors ${
              price && acceptTerms && !listMutation.isPending
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-foreground/20 text-foreground/40 cursor-not-allowed"
            }`}
          >
            {listMutation.isPending ? "ĐANG XỬ LÝ..." : "ĐĂNG BÁN VÉ"}
          </button>
        </div>
      )}
    </MobileLayout>
  );
};

export default ResaleSalePage;
