import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Shield,
  Sparkles,
  Ticket
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  assembleTx4,
  buildPurchaseTx,
  MockEOASigner,
  type ContractSyncedTokenData,
  type PaymentHashData,
  type PaymentIntentData,
  type WalletRegistrationData
} from "@ticket-platform/sdk-client";
import MobileLayout from "@/components/mobile/MobileLayout";
import { eventDetailFallback } from "@/lib/fallback-data";
import { formatMediumEventDate, formatTime, formatVnd } from "@/lib/format";
import { webAppConfig } from "@/lib/config";
import {
  extractPurchasedTokenId,
  sendLocalchainTransaction,
  waitForTransactionReceipt
} from "@/lib/localchain";
import { getSessionUserId, getSessionWalletAddress } from "@/lib/session";
import { useApiClient } from "@/providers/AppProviders";
import { toast } from "@ticket-platform/shared-ui";

interface PreparedPrimaryState {
  paymentHash: PaymentHashData;
  webhook: Record<string, unknown>;
  txDraft: ReturnType<typeof buildPurchaseTx>;
}

interface SignedPrimaryState {
  signedAuthorization: Awaited<ReturnType<MockEOASigner["signAuthorization"]>>;
  tx: ReturnType<typeof assembleTx4>;
}

interface BroadcastedPrimaryState {
  transactionHash: `0x${string}`;
  tokenId: string;
  syncedToken: ContractSyncedTokenData;
}

async function createDemoWebhookSignature(input: {
  timestamp: string;
  nonce: string;
  rawBody: string;
  secret: string;
}): Promise<string> {
  const material = `${input.timestamp}.${input.nonce}.${input.rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(material));
  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

const fallbackTicketType = {
  id: "tt_demo_primary",
  name: "GA",
  price: 900000,
  quantity: 100,
  soldCount: 18
};

const PrimaryPurchasePage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const client = useApiClient();
  const initialTierIndex = Math.max(0, Number(searchParams.get("tier") ?? "0") || 0);
  const [quantity, setQuantity] = useState("1");
  const [authorizationNonce, setAuthorizationNonce] = useState("0");
  const [onChainEventId, setOnChainEventId] = useState("1");
  const [onChainTicketTypeId, setOnChainTicketTypeId] = useState(String(initialTierIndex + 1));
  const [walletBootstrap, setWalletBootstrap] = useState<WalletRegistrationData | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentData | null>(null);
  const [prepared, setPrepared] = useState<PreparedPrimaryState | null>(null);
  const [signed, setSigned] = useState<SignedPrimaryState | null>(null);
  const [broadcasted, setBroadcasted] = useState<BroadcastedPrimaryState | null>(null);

  const { data, isError, isLoading } = useQuery({
    queryKey: ["events", "raw-detail", id],
    enabled: Boolean(id),
    queryFn: async () => (await client.getEvent(id as string)).data
  });

  const event = data;
  const selectedTier =
    event?.ticketTypes[initialTierIndex] ?? event?.ticketTypes[0] ?? fallbackTicketType;

  useEffect(() => {
    setOnChainTicketTypeId(String(initialTierIndex + 1));
  }, [initialTierIndex]);

  const quantityValue = Math.max(1, Number(quantity) || 1);
  const subtotal = selectedTier.price * quantityValue;
  const feePreview = useMemo(() => {
    const platformFee = Math.floor(subtotal * 0.05);
    const blockchainFee = 15000;
    return {
      platformFee,
      blockchainFee,
      total: subtotal + platformFee + blockchainFee
    };
  }, [subtotal]);

  const displayEvent = event
    ? {
        name: event.title,
        date: formatMediumEventDate(event.startAt),
        time: formatTime(event.startAt),
        location: `${event.venue}, ${event.city}`
      }
    : {
        name: eventDetailFallback.name,
        date: eventDetailFallback.date,
        time: eventDetailFallback.time,
        location: eventDetailFallback.location
      };

  const preparePurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error("Missing event id");
      }

      const parsedEventId = Number(onChainEventId);
      const parsedTicketTypeId = Number(onChainTicketTypeId);
      if (!Number.isInteger(parsedEventId) || parsedEventId <= 0) {
        throw new Error("On-chain event ID phải là số nguyên dương");
      }
      if (!Number.isInteger(parsedTicketTypeId) || parsedTicketTypeId <= 0) {
        throw new Error("On-chain ticket type ID phải là số nguyên dương");
      }

      const now = Date.now();
      const orderId = `ord_primary_${id}_${now}`;
      const reservationId = `res_primary_${id}_${now}`;
      const ticketIds = Array.from(
        { length: quantityValue },
        (_, index) => `${reservationId}:${index + 1}`
      );

      const wallet = await client.registerPaymentWallet(
        { walletAddress: getSessionWalletAddress() },
        { userId: getSessionUserId() }
      );
      const payment = await client.createPaymentIntent(
        {
          orderId,
          reservationId,
          amount: subtotal,
          currency: "VND",
          gateway: "momo",
          eventId: parsedEventId,
          ticketTypeId: parsedTicketTypeId,
          quantity: quantityValue,
          ticketIds,
          buyerWalletAddress: getSessionWalletAddress()
        },
        {
          userId: getSessionUserId(),
          idempotencyKey: `primary:init:${orderId}`
        }
      );

      return {
        wallet: wallet.data,
        payment: payment.data
      };
    },
    onSuccess: ({ wallet, payment }) => {
      setWalletBootstrap(wallet);
      setPaymentIntent(payment);
      setPrepared(null);
      setSigned(null);
      setBroadcasted(null);
      toast({
        title: "Đã khởi tạo primary purchase",
        description: "Wallet đã register và payment intent đã được tạo."
      });
    },
    onError: (error) => {
      toast({
        title: "Khởi tạo flow thất bại",
        description: error instanceof Error ? error.message : "Không thể tạo payment intent",
        variant: "destructive"
      });
    }
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentIntent) {
        throw new Error("Payment intent chưa được tạo");
      }

      const webhookBody = {
        eventId: `evt_${paymentIntent.orderId}`,
        orderId: paymentIntent.orderId,
        paymentId: paymentIntent.paymentId,
        status: "success",
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        gatewayTransactionId: `momo_txn_${paymentIntent.orderId}`
      };
      const rawBody = JSON.stringify(webhookBody);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = `nonce_${paymentIntent.orderId}`;
      const signature = await createDemoWebhookSignature({
        timestamp,
        nonce,
        rawBody,
        secret: webAppConfig.demoMomoWebhookSecret
      });

      const webhook = await client.submitPaymentWebhook("momo", webhookBody, {
        signature,
        timestamp,
        nonce
      });
      const paymentHash = await client.getPaymentHash(paymentIntent.orderId);

      if (
        paymentHash.data.status !== "ready" ||
        !paymentHash.data.paymentHash ||
        !paymentHash.data.signature ||
        !paymentHash.data.domain ||
        paymentHash.data.eventId === null ||
        paymentHash.data.ticketTypeId === null ||
        paymentHash.data.quantity === null
      ) {
        throw new Error("Payment đã confirm nhưng payment hash chưa sẵn sàng");
      }

      const txDraft = buildPurchaseTx({
        ticketLedgerAddress: paymentHash.data.domain.verifyingContract,
        handlerAddress: webAppConfig.handlerAddress,
        eventId: BigInt(paymentHash.data.eventId),
        ticketTypeId: BigInt(paymentHash.data.ticketTypeId),
        quantity: BigInt(paymentHash.data.quantity),
        paymentHash: paymentHash.data.paymentHash,
        signature: paymentHash.data.signature,
        chainId: BigInt(paymentHash.data.domain.chainId),
        nonce: BigInt(Number(authorizationNonce))
      });

      return {
        webhook: webhook.data,
        paymentHash: paymentHash.data,
        txDraft
      };
    },
    onSuccess: ({ webhook, paymentHash, txDraft }) => {
      setPrepared({ webhook, paymentHash, txDraft });
      setSigned(null);
      setBroadcasted(null);
      toast({
        title: "Đã xác nhận thanh toán demo",
        description: "Webhook MoMo giả lập đã chạy và FE đã build purchase tx draft."
      });
    },
    onError: (error) => {
      toast({
        title: "Confirm payment thất bại",
        description: error instanceof Error ? error.message : "Không thể confirm payment demo",
        variant: "destructive"
      });
    }
  });

  const signPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!prepared) {
        throw new Error("Purchase tx chưa được prepare");
      }

      const signer = new MockEOASigner(getSessionWalletAddress() as `0x${string}`);
      const signedAuthorization = await signer.signAuthorization(
        prepared.txDraft.authorizationTuple,
        prepared.txDraft.authorizationHash
      );
      const payload = prepared.txDraft.assemble(signedAuthorization);
      const tx = assembleTx4(payload, signer.address);

      return {
        signedAuthorization,
        tx
      };
    },
    onSuccess: (result) => {
      setSigned(result);
      setBroadcasted(null);
      toast({
        title: "Đã assemble primary tx",
        description: "FE đã ký authorization hash bằng MockEOASigner và assemble type-4 tx."
      });
    },
    onError: (error) => {
      toast({
        title: "Ký tx thất bại",
        description: error instanceof Error ? error.message : "Không thể assemble tx",
        variant: "destructive"
      });
    }
  });

  const broadcastPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!prepared) {
        throw new Error("Purchase tx chưa được prepare");
      }

      const transactionHash = await sendLocalchainTransaction({
        rpcUrl: webAppConfig.rpcUrl,
        from: getSessionWalletAddress() as `0x${string}`,
        to: prepared.txDraft.calls[0].target,
        data: prepared.txDraft.businessCalldata
      });

      const receipt = await waitForTransactionReceipt({
        rpcUrl: webAppConfig.rpcUrl,
        transactionHash
      });
      const tokenId = extractPurchasedTokenId(
        receipt,
        prepared.paymentHash.domain?.verifyingContract ?? prepared.txDraft.calls[0].target
      );

      if (!tokenId) {
        throw new Error("Không đọc được tokenId từ receipt TicketPurchased");
      }

      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          const token = await client.getSyncedToken(tokenId);
          if (
            token.data.ownerWalletAddress?.toLowerCase() === getSessionWalletAddress().toLowerCase()
          ) {
            return {
              transactionHash,
              tokenId,
              syncedToken: token.data
            };
          }
        } catch {
          // Poll until contract-sync catches up.
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }

      throw new Error("Đã broadcast nhưng contract-sync-service chưa xác nhận owner mới");
    },
    onSuccess: (result) => {
      setBroadcasted(result);
      toast({
        title: "Primary purchase đã hoàn tất",
        description: `Tx ${result.transactionHash.slice(0, 10)}... đã được broadcast và sync token #${result.tokenId}.`
      });
    },
    onError: (error) => {
      toast({
        title: "Broadcast purchase thất bại",
        description: error instanceof Error ? error.message : "Không thể broadcast purchase",
        variant: "destructive"
      });
    }
  });

  const copyJson = async (value: unknown, label: string) => {
    await navigator.clipboard.writeText(
      JSON.stringify(value, (_, entry) => (typeof entry === "bigint" ? entry.toString() : entry), 2)
    );
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
            to={`/event/${id ?? ""}`}
            className="w-10 h-10 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-medium tracking-tight">Primary Purchase</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Event #{id ?? "unknown"}
            </p>
          </div>
        </div>
      </header>

      {isError && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            event-service chưa phản hồi. Page vẫn cho chạy demo flow với fallback tier.
          </p>
        </div>
      )}

      <section className="p-4">
        <div className="border border-foreground/20 overflow-hidden">
          <div className="aspect-[3/1] bg-muted/30 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="px-2 py-0.5 bg-foreground/10 backdrop-blur-sm border border-foreground/20 font-mono text-[8px] tracking-widest uppercase">
                {selectedTier.name}
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
                { label: "Tier", value: selectedTier.name },
                { label: "Qty", value: String(quantityValue) }
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
          [ CHI TIẾT GIÁ ]
        </h3>
        <div className="border border-foreground/20 divide-y divide-foreground/10">
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Đơn giá</span>
            <span className="font-mono text-xs">{formatVnd(selectedTier.price)}</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Số lượng</span>
            <span className="font-mono text-xs">{quantityValue}</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Tạm tính</span>
            <span className="font-mono text-xs">{formatVnd(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Phí nền tảng</span>
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
          [ PRIMARY FLOW ]
        </h3>
        <div className="border border-foreground/20 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[10px] text-foreground/50 block mb-2">
                On-chain event ID
              </span>
              <input
                value={onChainEventId}
                onChange={(event) => setOnChainEventId(event.target.value)}
                className="w-full bg-transparent border border-foreground/20 px-3 py-2 font-mono text-xs outline-none"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] text-foreground/50 block mb-2">
                On-chain ticket type ID
              </span>
              <input
                value={onChainTicketTypeId}
                onChange={(event) => setOnChainTicketTypeId(event.target.value)}
                className="w-full bg-transparent border border-foreground/20 px-3 py-2 font-mono text-xs outline-none"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] text-foreground/50 block mb-2">Quantity</span>
              <input
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
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
              <span className="text-xs font-medium text-green-600">Demo flow wired end-to-end</span>
              <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                FE sẽ register wallet, tạo payment intent, giả lập webhook MoMo dev, lấy
                `paymentHash/signature`, build tx draft, rồi broadcast trực tiếp lên local Anvil để
                contract-sync-service xác nhận owner mới.
              </p>
            </div>
          </div>

          <div className="border border-foreground/10 p-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-foreground/40 mt-0.5 flex-shrink-0" />
            <p className="font-mono text-[10px] text-foreground/40">
              `event-service` hiện chưa map sang on-chain numeric ids. Hai input phía trên đang là
              bridge tạm thời để flow primary không bị nghẽn.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-6 space-y-4">
        <div className="border border-foreground/20 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
              [ TRẠNG THÁI ]
            </h3>
            <div className="flex items-center gap-1.5 px-2 py-1 border border-foreground/10">
              <Clock className="w-3 h-3 text-foreground/40" />
              <span className="font-mono text-[9px] text-foreground/40">
                {isLoading ? "loading event" : "buyer demo"}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              {walletBootstrap ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Ticket className="w-4 h-4 text-foreground/40" />
              )}
              <span>
                Wallet bootstrap: {walletBootstrap ? walletBootstrap.walletAddress : "chưa chạy"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {paymentIntent ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Ticket className="w-4 h-4 text-foreground/40" />
              )}
              <span>Payment intent: {paymentIntent ? paymentIntent.orderId : "chưa tạo"}</span>
            </div>
            <div className="flex items-center gap-2">
              {prepared ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Ticket className="w-4 h-4 text-foreground/40" />
              )}
              <span>
                Payment hash:{" "}
                {prepared?.paymentHash.paymentHash ?? "chưa có / chưa confirm webhook"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {signed ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Ticket className="w-4 h-4 text-foreground/40" />
              )}
              <span>Type-4 tx: {signed ? signed.tx.to : "chưa assemble"}</span>
            </div>
            <div className="flex items-center gap-2">
              {broadcasted ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Ticket className="w-4 h-4 text-foreground/40" />
              )}
              <span>
                On-chain purchase: {broadcasted ? broadcasted.transactionHash : "chưa broadcast"}
              </span>
            </div>
          </div>
        </div>

        {paymentIntent && (
          <div className="border border-foreground/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                [ PAYMENT INTENT ]
              </h3>
              <button
                onClick={() => copyJson(paymentIntent, "Payment intent")}
                className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
              >
                <Copy className="w-3 h-3 inline-block mr-1" />
                COPY
              </button>
            </div>
            <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
              {JSON.stringify(paymentIntent, null, 2)}
            </pre>
          </div>
        )}

        {prepared && (
          <>
            <div className="border border-foreground/20 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                  [ PAYMENT HASH ]
                </h3>
                <button
                  onClick={() => copyJson(prepared.paymentHash, "Payment hash payload")}
                  className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
                >
                  <Copy className="w-3 h-3 inline-block mr-1" />
                  COPY
                </button>
              </div>
              <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
                {JSON.stringify(prepared.paymentHash, null, 2)}
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
                        calls: prepared.txDraft.calls
                      },
                      "Primary contract draft"
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
                    calls: prepared.txDraft.calls
                  },
                  (_, value) => (typeof value === "bigint" ? value.toString() : value),
                  2
                )}
              </pre>
            </div>
          </>
        )}

        {signed && (
          <div className="border border-foreground/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                  [ SIGNED TX ]
                </h3>
              </div>
              <button
                onClick={() => copyJson(signed, "Signed primary tx")}
                className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
              >
                <Copy className="w-3 h-3 inline-block mr-1" />
                COPY
              </button>
            </div>
            <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
              {JSON.stringify(
                signed,
                (_, value) => (typeof value === "bigint" ? value.toString() : value),
                2
              )}
            </pre>
          </div>
        )}

        {broadcasted && (
          <div className="border border-foreground/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                  [ ON-CHAIN RESULT ]
                </h3>
              </div>
              <button
                onClick={() => copyJson(broadcasted, "Primary on-chain result")}
                className="px-3 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10"
              >
                <Copy className="w-3 h-3 inline-block mr-1" />
                COPY
              </button>
            </div>
            <pre className="overflow-x-auto text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
              {JSON.stringify(broadcasted, null, 2)}
            </pre>
          </div>
        )}
      </section>

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
            isLoading ||
            preparePurchaseMutation.isPending ||
            confirmPaymentMutation.isPending ||
            signPurchaseMutation.isPending ||
            broadcastPurchaseMutation.isPending ||
            !id
          }
          onClick={() => {
            if (!paymentIntent) {
              preparePurchaseMutation.mutate();
              return;
            }
            if (!prepared) {
              confirmPaymentMutation.mutate();
              return;
            }
            if (!signed) {
              signPurchaseMutation.mutate();
              return;
            }
            if (!broadcasted) {
              broadcastPurchaseMutation.mutate();
            }
          }}
          className="w-full py-4 bg-foreground text-background font-medium tracking-tight hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {preparePurchaseMutation.isPending
            ? "ĐANG KHỞI TẠO..."
            : confirmPaymentMutation.isPending
              ? "ĐANG GIẢ LẬP THANH TOÁN..."
              : signPurchaseMutation.isPending
                ? "ĐANG KÝ TX..."
                : broadcastPurchaseMutation.isPending
                  ? "ĐANG BROADCAST LÊN LOCALCHAIN..."
                  : !paymentIntent
                    ? "BẮT ĐẦU PRIMARY PURCHASE"
                    : !prepared
                      ? "GIẢ LẬP WEBHOOK & LẤY PAYMENT HASH"
                      : !signed
                        ? "KÝ & ASSEMBLE TYPE-4 TX"
                        : !broadcasted
                          ? "BROADCAST PURCHASE LÊN LOCALCHAIN"
                          : "PURCHASE ĐÃ SYNC XONG"}
        </button>
      </div>
    </MobileLayout>
  );
};

export default PrimaryPurchasePage;
