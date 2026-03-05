1. Introduction
   1.1. Purpose
   Tài liệu này mô tả chi tiết các yêu cầu hệ thống của Entr
   1.2. Scope
   Entr bao gồm các thành phần chính:

- Ứng dụng di động (IOS/Android): giao diện cho người mua bán vé
- Hệ thống backend: Tài khoản, API; database; soft lock; cổng thanh toán; yêu cầu rút tiền, hệ thống QR.
- Logic ví: Ví EOA giấu trong background, Private key, Code Frontend, RPC,
- Các Contract Account Abstraction: Paymaster, Handler.
- Các Contract chức năng: hệ thống hàng chờ (queue); chuyển nhượng (display các vé đang rao báo), trao đổi (display các trade offer)
- Contract Ledger lưu giữ thông tin vé.
- Hệ thống Identity (Proof-of-Entry): Contract Badge \*\*\*\*để check thông tin và mint các badge
- Dashboard cho nhà tổ chức: đăng ký sự kiện; quản lý sự kiện (phân tích số liệu bán vé,..)

2. System Overview
   2.1. Cách Entr sử dụng blockchain
   Entr sử dụng blockchain đúng với bản chất cốt lõi của nó: một ledger (sổ cái) dùng để ghi nhận và lưu giữ trạng thái của vé - thay vì dùng database trung tâm.
   Trong Entr, blockchain đóng vai trò là lớp lưu trữ và xác thực trạng thái vé, bao gồm các thông tin cốt lõi như:

- quyền sở hữu vé
- trạng thái vé (đang bán, đã bán, đang giao dịch, đã chuyển nhượng)
- các hành động liên quan đến vé như chuyển nhượng, resale, trade
  Những thay đổi liên quan đến này được ủy quyền (delegate) trực tiếp cho người dùng cập nhật thông qua Account Abstraction, thay vì để backend server chịu trách nhiệm cập nhật và đồng bộ trạng thái vé cho toàn bộ hệ thống.

Trong các nền tảng bán vé Web2, backend server thường phải đồng thời:

- lưu trữ và cập nhật trạng thái vé trong cơ sở dữ liệu
- xác nhận thanh toán
- đảm nhiệm thêm các tác vụ khác như queue, seatmap và quản lý phiên người dùng, vv
  Điều này khiến backend trở thành điểm nghẽn chính khi lượng truy cập tăng đột biến, dễ dẫn đến quá tải hoặc gián đoạn dịch vụ.
  Entr giải quyết vấn đề này bằng cách đưa phần tải nặng nhất – việc cập nhật và duy trì trạng thái vé – cho chính người dùng
  Ta đưa kiến trúc lưu trữ thông tin vé lên một hạ tầng dùng chung và không phụ thuộc vào backend - rồi ủy quyền cho chính người dùng thực hiện các thay đổi trạng thái - từ đó giảm thiểu tối đa áp lực lên hệ thống server trung tâm.
  Đây chính là tính chất của Blockchain mà, decentralization! Ta decentralize load lên hệ thống của mình cho người dùng - bằng cách ủy quyền cho mỗi người (mỗi ví) tự update database vé trên Blockchain! Đây là lí do ta dùng Blockchain kết hợp với Account Abstraction

Phân tách trách nhiệm giữa blockchain và backend
Bằng cách đưa việc quản lý trạng thái vé lên blockchain, Entr “giải phóng” hoàn toàn trách nhiệm cập nhật trạng thái vé cho backend. Điều này cho phép backend tập trung vào các nhiệm vụ khác như:

- xử lý và xác minh thanh toán off-chain
- điều phối luồng nghiệp vụ (trade, resale, checkout,..)
- tích hợp với các hệ thống bên ngoài (payment gateway, CRM, analytics)
  Backend không còn chịu trách nhiệm nắm giữ hoặc thay đổi trạng thái vé, mà chỉ đóng vai trò điều phối và xác minh thanh toán, trong khi blockchain trở thành nguồn sự thật duy nhất (single source of truth) cho dữ liệu vé.
  Tách biệt kiến trúc để mở rộng bền vững
  Việc tách blockchain thành kiến trúc vé và backend thành kiến trúc điều phối cho phép Entr:
- giảm tải đáng kể cho backend trong các thời điểm cao điểm
- tránh backend trở thành điểm nghẽn hoặc điểm lỗi duy nhất
- mở rộng hệ thống một cách độc lập và bền vững

Layer Vai trò
Blockchain Ownership, final state
Backend Soft lock, payment
Frontend UX, Call write tx
Indexer Read-only
Không sử dụng NFT nữa

- Ngoài ra, em cũng thay đổi về vé: Entr sẽ không sử dụng NFT vé nữa, thay vào đó, chúng ta sử dụng Blockchain đúng với mục đích ban đầu của nó - một cuốn sổ lưu giữ thông tin - thông qua các Smart Contract.
- Không sử dụng NFT, ta tránh mọi vấn đề pháp lý có thể phát sinh liên quan đến tài sản mã hóa. Chỉ dùng CÔNG NGHỆ Blockchain.
  Cho mỗi sự kiện, ta tạo 1 contract ledger lưu giữ thông tin vé:
  struct Ticket {
  uint ticketId
  uint256 eventId;
  uint16 tierId;
  address owner;
  bool checkedIn;
  }
  mapping(uint256 => Ticket) public tickets;

- Mỗi khi thay đổi state của vé (mua vé, bán vé, v.v), chính frontend của người dùng sẽ call tx thẳng lên blockchain để map lại owner vé thành ví của người dùng
  [ticketId].owner = msg.sender;
  NOTE: Chúng ta cho phép người dùng tham gia vào việc update state vé. Mặc dù đã giấu logic ví đi, nhưng vẫn cần bảo ví EOA không bị lạm dụng để chỉnh sửa Contract Ledger lung tung. Vậy bằng cách nào? Em sẽ viết chi tiết trong các phần tiếp theo.
  2.2. Hệ thống Proof-of-Entry
  Entr sẽ tạo ra một hệ thống onchain identity cho việc mua vé, lấy tên là Proof-of-Entry
  Vấn đề 1: Cách bán vé hiện nay không công bằng
  Hiện nay, không có cách nào để phân biệt được giữa fan thật (những người thực sự muốn tham gia sự kiện) với kẻ xấu (phe vé, bot, tool, vv)
- Giải pháp tốt nhất hiện nay cho những sự kiện hot chỉ là xếp hàng chờ, mà hàng chờ này hoàn toàn NGẪU NHIÊN ⇒ phụ thuộc vào may rủi.
- Hoàn toàn có thể để lọt những kẻ xấu vào trước mua hết vé trong khi người thực sự muốn đi thì không đến lượt
  Thực trạng
- Mua được vé hay không phụ thuộc hoàn toàn vào may rủi
- Đi 1 concert hay 5 concert → quyền lợi như nhau
- Fan trung thành không được lợi gì từ việc đã đi sự kiện trước đó
  Hệ quả
- Trải nghiệm mua vé gây ức chế
- Người mua cảm thấy “may rủi”
- Những người đi trung thành không được đối xứ thỏa đáng.
  Vấn đề 2: Web2 không có “identity” bền vững
  Thực trạng
- Lịch sử tham gia chỉ giới hạn trong một sự kiện duy nhất
- Event A năm 2026 không biết user đã đi Event A năm 2024, 2025 hay chưa
- Người tổ chức sự kiện không biết được người này thường xuyên đi sự kiện (khách hàng tiềm năng) hay chỉ mua vé xong bán lại (phe vé)
  Hệ quả
- Dữ liệu tham gia không composable, không thể dùng lại cho các sự kiện khác
- Tạo điều kiện cho kẻ xấu
  Chính vì vậy, Entr sử dụng Blockchain với đúng bản chất Immutability của nó - để tạo một hệ thống Identity cho người đi sự kiện.
  Hệ thống identity dựa trên hành vi thực tế, không cần profile hay KYC.
  Người dùng không “khai” mình là fan - họ chứng minh bằng lịch sử tham dự sự kiện, được ghi lại onchain.
  Identity này:
- Không thể giả
- Không thể sửa
- Có thể tái sử dụng cho nhiều event trong tương lai
  Cấu trúc hệ thống Proof-of-Entry
  Như đã nói ở trên, trong Contract Ledger, struct của mỗi vé có bool check-in
  Khi người dùng check-in, trạng thái check-in của vé được chỉnh thành TRUE.
  Từ đó, Contract Badge hoàn toàn có thể kiểm tra state checkin các Contract Ledger xem người nào đủ điều kiện.
- User check-in → trạng thái attendance được ghi vào Event Ledger Contract
  mapping(address => bool) public checkedIn;
- Badge Contract đọc dữ liệu từ các Event Ledger liên quan
- Nếu điều kiện thỏa (ví dụ: 0xABC checked in Concert A 2022+ 2023 + 2024)
  IEventLedger(ledger2022).checkedIn(user) == true
  IEventLedger(ledger2023).checkedIn(user) == true
  IEventLedger(ledger2024).checkedIn(user) == true
  → Mint badge NFT “Top Fan Concert A” vào wallet 0xABC
  Và chính nhờ hệ thống Proof-of-Entry, Entr giới thiệu một giải pháp bán vé công bằng mà không nền tảng Web2 nào có thể copy được
  Đó là mô hình bán vé theo giai đoạn, lấy cảm hứng từ NFT minting theo tier trong giới crypto.
  Ví dụ
- Giai đoạn 1 (10h-10h30) – Top FanChỉ những wallet có NFT*“Top Fan Concert A”* được mua
- Giai đoạn 2 (10h30-11h) – Người thậtChỉ những wallet từng checkin >5 sự kiện khác được mua
- Giai đoạn 3(11h trở đi) – PublicMở cho tất cả
  ⇒ Thứ tự mua vé gắn chặt với lịch sử tham dự, không thể fake, không may rủi
  Entr không chỉ bán vé.
  Entr phân phối vé dựa trên danh dự và lịch sử tham gia của người mua
  Đây là một mô hình bán vé công bằng hơn, ưu ái fan trung thành,
  và là lợi thế cấu trúc mà hạ tầng Web2 không thể sao chép.

3. Functional Requirements
   3.1. Wallet Logic
   Note: Trước đây em nhầm lẫn 7702 và Account Abstraction. Em tưởng 7702 sẽ giúp giấu ví, call tx trong background luôn. Nhưng thực chất ra 7702 chỉ giúp khoản gas sponsorship, tx batching, vv. Ta vẫn cần tự xây dựng logic tạo ví, quản lý private key của riêng mình, và giấu ví ở dưới nền ứng dụng.
   3.1.1. Cơ chế ví

- Mô tả: Logic ví là thành phần quan trọng nhất trong kiến trúc vé của Entr, cho phép Frontend người dùng thực hiện \*\*\*\*việc update state vé trên Contract Ledger, qua đó, góp phần giảm load cho backend và server.
- Ví luôn phải bị giấu đi, không hiện cho người dùng
- Chúng ta sẽ khôn lỏi một chút, ví giấu ví đi nên cảm giác là Backend thực hiện mọi tác vụ update state vé, nhưng thực chất là Frontend người dùng làm như vậy thông qua Account Abstraction ⇒ giảm được load cho backend
  3.1.2. Tạo ví
- Mô tả: Tạo ví EOA, lưu private key trong storage của máy (để frontend có thể call tx).
- Đồng thời cần lưu Private key này lên server của Entr để có gì còn giải quyết sự cố, đồng thời dùng cho lần đăng nhập tiếp theo khi người dùng xóa app tải lại.
  3.1.3. Frontend Call TX
- Mô tả: Frontend lấy Private key và call tx, call trực tiếp qua RPC lên mempool, và lên onchain.
- Do dó, không phải qua backend của Entr, giảm load.
- Như đã nói ở trên, mọi logic ví phải bị giấu đi, không có bất kỳ promp signing hay confirmation nào.
  3.1.4. Gas Sponsorship
- Về cơ bản, Gas Sponsorship của Entr sẽ hoạt động như sau:
- Tạo tài khoản ⇒ Tạo ví ⇒ Backend gửi một lượng vé đến ví (Gas Prefund) ⇒ Lần call tx đầu tiên thì có gas luôn ⇒ Mỗi lần gửi tx, Frontend gắn Delegation 7702 cho contract Handler ⇒ Handler executeBatch() để vừa call contract vé, thay đổi state, vừa call contract Paymaster để Refill gas.
  Note: Tại sao lại cần prefund gas lần đầu?
  Vì lần call tx đầu tiên cần gas đã. Còn khi đã call được tx, mỗi tx đều delegate cho Handler (thông qua 7702), và Handler sẽ call Contract Paymaster trong tx luôn ⇒ Paymaster tự động refill lượng gas đã dùng trong tx đó ⇒ không bao giờ hết gas. Đồng thời, không cần backend trong các lần tiêp theo, cũng không cần Bundler third-party ⇒ giảm load, giảm chi phí hoạt động
  Note: Tại sao lại có 1 contract Executor ở giữa?
  Vì bản chất 1 ví EOA bình thường không có khả năng gọi nhiều TX cùng lúc ⇒ Chỉ có thể call 1 lúc 1 contract. Còn Smart Contract thì có thể dùng batchExecute. ⇒ Delegate cho contract Executor để vừa call contract Ledger thay đổi state, vừa call contract Paymaster refill gas.
  3.2. Tài khoản & Ví
  3.2.1. Đăng ký tài khoản
- Mô tả: Hệ thống phải cho phép người dùng đăng ký bằng số điện thoại hoặc Zalo OTP.
  3.2.2. Tạo ví tự động
- Mô tả: Khi tạo tài khoản, hệ thống phải tự động khởi tạo ví Blockchain và gắn với tài khoản.
  3.2.3. Đăng nhập tài khoản
- Mô tả: Vì người dùng không nhìn thấy và tiếp xúc với ví Blockchain, người dùng có thể đăng nhập bằng phương thức giống như đã đăng ký (SDT/Zalo), chứ không dùng private key.
- Khi đăng nhập, ví gắn với tài khoản phải giống như đã lúc đăng ký. Bằng cách lấy Priavate key đã lưu trong database của Entr.
  3.2.4. Gas Prefund
- Mô tả: Như đã nói đến ở mục 3.1.1, Backend cần call contract Paymaster để gửi một lượng gas nhất định đến ví vừa mới được tạo
  3.3. Mua vé
  3.3.1. Hiển thị các sự kiện
- Mô tả: Người dùng phải thấy các sự kiện đang mở bán và sắp mở bán.
  3.3.2. Hiển thị trạng thái bán vé của sự kiện
- Mô tả: Người dùng phải thấy các vé còn khả dụng và các vé đã được mua trên Seatmap. Indexer cần đọc Ledger Contract xem những vé nào chưa được bán (cho các sự kiện chia ghế) hoặc còn bao nhiêu vé (cho các sự kiện chia thành hạng vé).
- Vé nào đã ghi SOLD onchain: Không hiện
- Vé nào đang bị backend SOFT LOCKED: Không hiện
- Vé nào vẫn ghi AVAILABLE onchain: Hiện
  3.3.3. Thanh toán bằng VND
- Mô tả: Hệ thống phải cho phép mua vé bằng các phương thức thanh toán Web2.
  3.3.4. Soft lock vé
- Mô tả: Vì ta dùng onchain để lưu state vé, Backend cần đảm nhận thêm một vai trò nữa là soft lock vé trong lúc thanh toán để không xảy ra tình trạng Race Condition (A chọn mua được một vé đã bán cho B trong lúc tx update owner của B đang confirm onchain)
- Cụ thể: Từ lúc người mua ấn chọn một ghế nào đó cho đến lúc onchain update state thành SOLD hoặc hết hạn thời gian thanh toán thì unlock vé và cho phép người khác mua
- Giải pháp Soft lock vé cần NHẸ nhất có thể (Redis - SSE maybe?)
- Backend chỉ lock tạm trong lúc thanh toán
- Onchain vẫn ghi state (đã bán, owner) cuối
- Backend không có quyền override onchain
  3.3.5. Backend xác nhận thanh toán
- Mô tả: Backend phải xác nhận thanh toán và issue payment hash cho frontend
- Payment hash này là cần thiết để đảm bảo người dùng không lạm dụng việc gọi tx để update Ledger Contract lung tung. Nếu Payment hash không hợp lệ thì TX sẽ bị Failed, và không có thay đổi đối với Ledger Contract (trạng thái vé không thay đổi).
  3.3.6. Frontend gọi TX
- Mô tả: Frontend dùng private key, gọi tx thẳng lên mempool. Trong đó có payment hash, nonce,vv
  3.3.7. Contract xác nhận
- Mô tả: Contract xác nhận payment hash hợp lệ, map lại owner vé thành ví của người mua.

  3.4. Resale
  Cho vé thứ cấp, ta dùng Blockchain làm Onchain Orderbook và Settlement engine, Backend dùng để Xác nhận thanh toán và Pending order matching

- Blockchain:
- Orderbook (Sổ lệnh): Vé nào được rao bán và giá bao nhiêu
- Settlement: Remap lại owner của vé từ người bán thành ng mua
- Backend:
- Xác nhận thanh toán
- Pending Order Matching: Soft lock vé trong lúc người mua thanh toán (ẩn vé đăng bán, đồng thời không cho phép người bán hủy đăng bán trong lúc người mua thanh toán)
  Resale sẽ chia ra làm hai trường hợp: a. Market buy (mua vé được đăng bán) và b. Limit buy (hỏi mua với giá nào đó)
  3.4a. Market buy
  3.4a.1. Đăng bán vé
- Mô tả: Frontend gửi tx để chỉnh bool listed thành TRUE trên Contract ledger
  3.4a.2. Hiển thị vé trên thị trường
- Mô tả: Indexer đọc các vé đang có state listed = true trong Contract ledger
  3.4a.3. Người mua chọn vé và thanh toán
- Mô tả: Người mua thanh toán. Backend xác nhận thanh toán và dùng private key của backend issue Payment Hash. Frontend gửi tx, trong đó có payment hash.
- Giống như lúc mua vé (3.3.4) - cần có giải pháp soft lock vé trong lúc đang thanh toán (hiện lên state paying ở máy người bán, không cho phép hủy giao dịch; ẩn trên frontend chợ vé; và có timer thanh toán - vd 10-15 phút, sau khi hết timer mà người mua chưa thanh toán thì tự động unlock vé và hiện lại trên thị trường)
  3.4a.3. Chuyển nhượng quyền sở hữu
- Mô tả: Contract dùng public key của backend để xác nhận thanh toán, nếu các parameter cần thiết: nonce, hash chuẩn ⇒ Chấp nhận transaction.
  3.4a.4. Thanh toán cho người mua
- Mô tả: Trước đây ta định có một hệ thống số dư tài khoản, tuy nhiên để tránh vấn đề pháp lý và tránh phải giữ tiền cho khách hàng. Sau khi giao dịch thành công, Backend ngay lập tức tạo và lưu một YÊU CẦU rút tiền vào tài khoản ngân hàng của người bán.
- Yêu cầu này cần được nhân viên Entr duyệt và tất toán.
  3.4b. Limit buy
  Limit buy xảy ra khi người mua muốn mua rẻ hơn giá thị trường, còn người bán muốn bán nhanh nên bán cho lệnh hỏi mua cao nhất
  3.4b.1. Đặt giá muốn hỏi mua
- Mô tả: Người mua nhập giá muốn mua (VD: Vé Resale rẻ nhất được đăng bán là 100.000 VND, người mua chỉ muốn mua với giá 80.000 VND)
  3.4b.2. Frontend gửi tx đặt lệnh lên Contract xử lý resale
- Mô tả: Frontend gửi tx chứa thông tin lệnh mua trên lên Contract
  3.4b.3. Indexer đọc và hiển thị lên app
- Mô tả: Hiển thị các đơn mua, theo thứ tự từ cao đến thấp
- VD:
  Các vé đăng đăng bán 100.000 105.000
  111.000 111.000 120.000
  LỆNH HỎI MUA
  Giá Số lượng
  80.000 1
  70.000 3
  3.4b.4. Người bán đặt lệnh bán cho người trả giá cao nhất
- Mô tả: Người bán muốn bán vé luôn, không muốn phải chờ rao bán vé, nên bán cho lệnh hỏi mua cao nhất
  3.4b.5. Backend soft lock trong lúc chờ người mua phản hồi
- Mô tả: Backend thông báo cho người mua rằng đã giá hỏi mua đã được chấp nhận, yêu cầu thanh toán.
- Đồng thời soft lock vé trong lúc chờ người mua xác nhận giao dịch (60 phút) và tạm ẩn lệnh hỏi mua.
- Trong 60 phút đó người bán có thể hủy giao dịch. Nếu người bán hủy thì lệnh hỏi mua sẽ tự động hiện lại. Nếu người mua đã xác nhận giao dịch (bắt đầu 15 phút thanh toán) thì người mua không còn quyền hủy.
- Còn nếu sau 60 phút người mua không xác nhận giao dịch thì hệ thống tự động hủy giao dịch. Đồng thời HỦY (thay vì hiện lại) lệnh hỏi mua của người mua (do người mua đang không có mặt)
  3.4b.6. Người mua nhận thông báo, vào app bắt đầu thanh toán
- Mô tả: Người mua ấn nút thanh toán, timer 15 phút thanh toán bắt đầu.
- Thanh toán cho Entr chứ không thanh toán thẳng cho người bán
  3.4b.7. Backend xác nhận thanh toán
- Mô tả: Backend xác nhận thanh toán thành công, issue payment hash cho frontend
  3.4b.8. Frontend gọi TX
- Mô tả: Frontend NGƯỜI MUA gọi TX để map lại owner của vé trong contract ledger từ người bán thành người mua.
- Vì cần có payment hash nên frontend người mua hoàn toàn có thể là bên gọi TX.
  NOTE: Flow của Limit buy sẽ khác với flow của Market buy.
  Market buy: Người bán đăng bán ⇒ Người mua chọn mua vé đăng bán sẵn ⇒ Người mua thanh toán (15 phút) ⇒ Xong.
  Còn limit buy thì khác: Người mua đặt giá ⇒ Người bán chấp nhận ⇒ Người mua xác nhận giao dịch (60 phút) ⇒ Người mua thanh toán (15 phút) ⇒ Xong.
  3.5. Check-in sự kiện
  3.5.1. Hệ thống QR
- Mô tả: Nền tảng bán vé Web2 truyền thống: Mỗi vé phải khởi tạo một mã QR riêng, làm tốn chi phí và tài nguyên hạ tầng.
- Mã QR để check-in sự kiện của Entr sẽ được gắn với mỗi tài khoản (với ví) thay vì phải khởi tạo mã QR cho từng vé. Vì quyền sở hữu các vé đã thuộc về ví trên Blockchain, khi check-in sự kiện chỉ cần check onchain xem ví đó có sở hữu vé hay không.
- Để đảm bảo không có việc chụp hay bán lại mã QR tài khoản, mã QR sẽ được làm mới mỗi ? phút.
  3.5.2. Hiển thị vé sở hữu
- Mô tả: Cần cho người dùng biết các vé đang sở hữu bằng cách Query các vé có owner=ví gắn với tài khoản; và hiển thị lên Frontend.
  3.8. Dashboard Ban tổ chức
  3.6.1. Tạo sự kiện
  3.6.2. Live update
- Mô tả: Cần có đầy đủ các stats theo sự kiện, chia theo hạng vé, các insight như unique holder %, listed %,
  3.6.3. Check-in
