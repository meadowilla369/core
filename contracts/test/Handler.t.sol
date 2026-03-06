// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "@openzeppelin/contracts/account/utils/EIP7702Utils.sol";

import "../interfaces/IHandler.sol";
import "../src/Handler.sol";
import "../src/TicketLedger.sol";
import "../src/TicketPaymaster.sol";

contract CounterTarget {
    uint256 public value;

    function increment() external {
        value += 1;
    }
}

contract RevertingTarget {
    function fail() external pure {
        revert("RevertingTarget: fail");
    }
}

contract HandlerTest is Test {
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant NAME_HASH = keccak256(bytes("TicketLedger"));
    bytes32 internal constant VERSION_HASH = keccak256(bytes("1"));
    bytes32 internal constant PURCHASE_TYPEHASH =
        keccak256("Purchase(uint256 eventId,uint256 ticketTypeId,uint256 quantity,bytes32 paymentHash,address buyer)");

    uint256 internal constant ADMIN_PK = 0xA11CE;
    uint256 internal constant USER_PK = 0xB0B;

    address internal admin;
    address payable internal user;

    TicketPaymaster internal paymaster;
    Handler internal handlerImplementation;
    TicketLedger internal ledger;
    CounterTarget internal counter;
    RevertingTarget internal revertingTarget;

    function setUp() public {
        admin = vm.addr(ADMIN_PK);
        user = payable(vm.addr(USER_PK));

        vm.deal(admin, 50 ether);
        vm.deal(user, 1 ether);

        vm.prank(admin);
        paymaster = new TicketPaymaster(admin, 1 ether);

        handlerImplementation = new Handler(address(paymaster));

        vm.prank(admin);
        ledger = new TicketLedger(admin);

        counter = new CounterTarget();
        revertingTarget = new RevertingTarget();

        vm.startPrank(admin);
        paymaster.addHandler(address(handlerImplementation));
        paymaster.addAllowedTarget(address(ledger));
        paymaster.addAllowedTarget(address(counter));
        paymaster.deposit{value: 10 ether}();
        vm.stopPrank();

        _delegateUserToHandler();
    }

    function testExecuteBatch() public {
        vm.txGasPrice(1 gwei);

        bytes32 paymentHash = keccak256("handler-purchase");
        bytes memory signature = _signPurchaseAuthorization(ADMIN_PK, user, 1, 2, 1, paymentHash);

        IHandler.Call[] memory calls = new IHandler.Call[](1);
        calls[0] = IHandler.Call({
            target: address(ledger),
            value: 0,
            data: abi.encodeCall(TicketLedger.purchaseWithSignature, (1, 2, 1, paymentHash, signature))
        });

        uint256 beforeBalance = user.balance;
        uint256 beforeSponsored = paymaster.totalGasSponsored(user);

        vm.prank(user);
        bytes[] memory results = IHandler(user).executeBatch(calls);

        uint256[] memory ticketIds = abi.decode(results[0], (uint256[]));
        assertEq(ticketIds.length, 1);
        assertEq(ledger.ticketCounter(), 1);
        assertGt(paymaster.totalGasSponsored(user), beforeSponsored);
        assertGt(user.balance, beforeBalance);

        (,,, address owner,, bool used,,) = ledger.tickets(ticketIds[0]);
        assertEq(owner, user);
        assertFalse(used);
    }

    function testExecuteBatch_RevertIfTargetNotAllowed() public {
        vm.txGasPrice(1 gwei);

        IHandler.Call[] memory calls = new IHandler.Call[](1);
        calls[0] =
            IHandler.Call({target: address(revertingTarget), value: 0, data: abi.encodeCall(RevertingTarget.fail, ())});

        vm.prank(user);
        vm.expectRevert("Handler: target not allowed");
        IHandler(user).executeBatch(calls);
    }

    function testExecuteBatchBubblesTargetRevert() public {
        vm.txGasPrice(1 gwei);

        vm.prank(admin);
        paymaster.addAllowedTarget(address(revertingTarget));

        IHandler.Call[] memory calls = new IHandler.Call[](1);
        calls[0] =
            IHandler.Call({target: address(revertingTarget), value: 0, data: abi.encodeCall(RevertingTarget.fail, ())});

        vm.prank(user);
        vm.expectRevert("RevertingTarget: fail");
        IHandler(user).executeBatch(calls);
    }

    function testMultipleCallsInSingleBatch() public {
        vm.txGasPrice(1 gwei);

        IHandler.Call[] memory calls = new IHandler.Call[](2);
        calls[0] =
            IHandler.Call({target: address(counter), value: 0, data: abi.encodeCall(CounterTarget.increment, ())});
        calls[1] =
            IHandler.Call({target: address(counter), value: 0, data: abi.encodeCall(CounterTarget.increment, ())});

        vm.prank(user);
        IHandler(user).executeBatch(calls);

        assertEq(counter.value(), 2);
        assertGt(paymaster.totalGasSponsored(user), 0);
    }

    function testSequentialTransactionsWithoutBackendTopUp() public {
        vm.txGasPrice(1 gwei);

        IHandler.Call[] memory calls = new IHandler.Call[](1);
        calls[0] =
            IHandler.Call({target: address(counter), value: 0, data: abi.encodeCall(CounterTarget.increment, ())});

        vm.prank(user);
        IHandler(user).executeBatch(calls);
        uint256 sponsoredAfterFirst = paymaster.totalGasSponsored(user);

        vm.prank(user);
        IHandler(user).executeBatch(calls);

        assertEq(counter.value(), 2);
        assertGt(paymaster.totalGasSponsored(user), sponsoredAfterFirst);
    }

    function testInitialPrefundBootstrap() public {
        uint256 initialPrefund = 0.01 ether;
        vm.deal(user, initialPrefund);
        vm.txGasPrice(1 gwei);

        IHandler.Call[] memory calls = new IHandler.Call[](1);
        calls[0] =
            IHandler.Call({target: address(counter), value: 0, data: abi.encodeCall(CounterTarget.increment, ())});

        vm.prank(user);
        IHandler(user).executeBatch(calls);

        assertEq(counter.value(), 1);
        assertGt(user.balance, initialPrefund);
    }

    function _delegateUserToHandler() internal {
        vm.etch(address(user), abi.encodePacked(bytes3(0xef0100), bytes20(address(handlerImplementation))));
        assertEq(EIP7702Utils.fetchDelegate(user), address(handlerImplementation));
    }

    function _signPurchaseAuthorization(
        uint256 signerPk,
        address recipient,
        uint256 eventId,
        uint256 ticketTypeId,
        uint256 quantity,
        bytes32 paymentHash
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(ledger))
        );
        bytes32 structHash =
            keccak256(abi.encode(PURCHASE_TYPEHASH, eventId, ticketTypeId, quantity, paymentHash, recipient));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
