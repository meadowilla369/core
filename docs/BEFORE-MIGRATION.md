1. TIẾN ĐỘ CODE SO VỚI REQUIREMENTS.md
   Bảng đánh giá theo module
   Module REQUIREMENTS.md yêu cầu Code thực tế Hoàn thành
   Smart Contracts TicketNFT, Marketplace, Paymaster, GuardianAccount 4 contract + full test suite (29 tests pass) 95%
   Backend - Auth Đăng ký/đăng nhập OTP, session, device tracking auth-service đầy đủ OTP + session + rate limit 85%
   Backend - Payment Momo/VNPAY webhook, idempotency, soft lock payment-orchestrator + webhook verify 75%
   Backend - Marketplace Resale listing, escrow, settlement, limit buy marketplace-service có listing/escrow/settle 70%
   Backend - Ticketing Reservation 15min TTL, purchase flow ticketing-service có reserve + purchase 70%
   Backend - Check-in QR verify, atomic DB check-in, async chain sync checkin-service có QR verify + markAsUsed 65%
   Backend - Refund Cancel policy, refund queue, payout sync refund-service scaffold + logic 60%
   Backend - Recovery 48h hold, key rotation, guardian recovery-service + GuardianAccount contract 65%
   Backend - Dispute 3-tier SLA, auto-resolve rules dispute-service scaffold 40%
   Backend - Notification SMS/email/push event-driven notification-service scaffold 35%
   Backend - KYC Provider-agnostic, fallback kyc-service abstraction layer 40%
   Backend - Contract Sync Indexer đọc on-chain events contract-sync-service có skeleton 35%
   Frontend - Mobile Full buyer app (auth, purchase, resale, check-in, QR) State management + feature modules, không có UI components 35%
   Frontend - Staff Scanner Check-in scanning app Scaffold only 15%
   Frontend - Organizer Portal Dashboard, event CRUD, analytics Scaffold only 15%
   Wallet Logic EOA ẩn, private key, frontend call TX, gas prefund Kiến trúc thiết kế, chưa tích hợp thực tế 25%
   Proof-of-Entry Badge contract, identity system Chưa có contract Badge 10%
   Infra/CI/CD Docker, K8s, Terraform, pipelines CI/CD workflows + scripts + deploy configs 75%
   Database PostgreSQL migrations Migration baselines defined, chưa execute 30%
   Tổng kết tiến độ
   Lớp Ước tính % Ghi chú
   Smart Contracts 90% Production-ready, thiếu Badge contract
   Backend Services 55% Core services thực, nhưng nhiều service còn scaffold
   Frontend 25% State management tốt, thiếu hoàn toàn UI/UX
   Infrastructure 70% CI/CD mạnh, DB chưa live
   TỔNG DỰ ÁN ~50-55% Backbone vững, thiếu frontend + integration thực

2. SO SÁNH REQUIREMENTS-UPDATE.md vs REQUIREMENTS.md
   Những thay đổi CỐT LÕI
   A. Thay đổi kiến trúc nền tảng (~40% khác biệt)
   Khía cạnh REQUIREMENTS.md (cũ) REQUIREMENTS-UPDATE.md (mới) Impact
   Vé NFT (ERC-721) - mỗi vé là 1 NFT Contract Ledger - struct Ticket trong mapping, KHÔNG dùng NFT CRITICAL - Phải viết lại contracts
   Wallet Embedded wallet (Privy/Dynamic MPC) EOA tự tạo - private key lưu local + server, giấu ví hoàn toàn HIGH - Thay đổi toàn bộ wallet architecture
   Gas ERC-4337 Paymaster truyền thống EIP-7702 Delegation + Handler + Paymaster refill per-tx HIGH - Cơ chế gas hoàn toàn khác
   Pháp lý Dùng NFT Không dùng NFT - tránh vấn đề pháp lý tài sản mã hóa STRATEGIC
   Identity Không có Proof-of-Entry - Badge NFT, tiered sale, lịch sử tham dự NEW FEATURE - Chưa có code
   B. Thay đổi logic nghiệp vụ (~30% khác biệt)
   Feature Cũ Mới Impact
   Frontend call TX Backend gọi mint/transfer Frontend trực tiếp gọi TX qua RPC, giảm load backend HIGH - Đảo ngược flow
   Payment Hash Backend issue NFT Backend issue payment hash → frontend gọi TX với hash → contract verify HIGH - Security model khác
   Resale - Limit Buy Chỉ có market buy Thêm Limit Buy (đặt giá hỏi mua, order matching) MEDIUM - Feature mới
   QR Check-in QR per ticket QR per account (per wallet), không cần QR per vé MEDIUM - Đơn giản hơn
   Thanh toán cho seller Số dư tài khoản trong app Yêu cầu rút tiền → nhân viên duyệt → bank transfer MEDIUM - Tránh giữ tiền
   C. Phần giữ nguyên (~30%)
   Đăng ký/đăng nhập OTP qua SDT
   Soft lock vé (Redis/SSE)
   Momo/VNPAY payment gateway
   Event listing + availability
   Check-in atomic DB
   Dispute resolution framework
   Refund flow cơ bản
   Ước tính thay đổi cần thiết
   Component Mức thay đổi Chi tiết
   Smart Contracts VIẾT LẠI 80% Bỏ ERC-721, viết Contract Ledger mới, thêm Badge contract, thêm Handler 7702
   Backend - Payment Sửa 40% Thêm payment hash issuing, bỏ NFT minting logic
   Backend - worker-mint XÓA hoặc đổi 100% Không còn mint NFT, thay bằng verify TX on-chain
   Backend - Marketplace Sửa 50% Không còn NFT escrow, dùng Contract Ledger listing
   Frontend - Mobile Sửa 60% Thêm wallet creation, private key management, TX calling
   Wallet Logic VIẾT MỚI 100% EOA creation, key storage, 7702 delegation, Handler interaction
   Proof-of-Entry VIẾT MỚI 100% Badge contract, check-in→badge pipeline, tiered sale
   Infra Sửa 20% Cập nhật deploy scripts cho contracts mới
   Đề xuất giải pháp
   Chiến lược: Incremental Migration (không rewrite toàn bộ)
   Phase 1 - Contract Layer (ưu tiên cao nhất)

Viết Contract Ledger thay thế TicketNFT
Viết Handler contract cho 7702 delegation
Cập nhật Paymaster cho cơ chế refill mới
Viết Badge contract cho Proof-of-Entry
Giữ lại test infrastructure, viết test mới
Phase 2 - Wallet & TX Logic

Xây dựng module wallet creation (EOA + key management)
Frontend TX signing module
Payment hash verification flow
7702 delegation integration
Phase 3 - Backend Adaptation

Payment orchestrator: thêm payment hash issuing
Bỏ worker-mint, thay bằng contract-sync listener
Marketplace service: adapt cho Contract Ledger
Check-in service: QR per account thay vì per ticket
Phase 4 - New Features

Limit Buy implementation
Proof-of-Entry badge pipeline
Tiered sale mechanics
Withdrawal request system
