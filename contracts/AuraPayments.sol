// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuraPayments
 * @dev Decentralized Web3 Payment Gateway and Invoice Settlement Engine on Arc Network
 * @notice Built for Arc Network Ecosystem - Powering enterprise invoicing and direct payments
 */
contract AuraPayments {
    address public owner;
    
    // Fee in basis points (e.g., 25 = 0.25%, 0 = zero fee)
    uint256 public feeBasisPoints;
    uint256 public totalPaymentsCount;
    uint256 public totalVolume;

    struct Invoice {
        string invoiceId;
        address payer;
        address recipient;
        uint256 amount;
        uint256 timestamp;
        bool isPaid;
    }

    mapping(string => Invoice) public invoices;
    mapping(address => uint256) public merchantVolume;

    event PaymentProcessed(
        string indexed invoiceId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        uint256 timestamp
    );
    
    event InvoiceCreated(
        string indexed invoiceId,
        address indexed merchant,
        uint256 amount,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
        feeBasisPoints = 0; // 0% fee default for zero-friction payments
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Aura: caller is not the owner");
        _;
    }

    /**
     * @notice Pay an invoice directly using Arc native gas/token (USDC)
     * @param invoiceId Unique identifier for the invoice
     * @param recipient The merchant/vendor receiving the payment
     */
    function payInvoice(string calldata invoiceId, address payable recipient) external payable {
        require(msg.value > 0, "Aura: payment amount must be greater than 0");
        require(recipient != address(0), "Aura: invalid recipient");
        require(!invoices[invoiceId].isPaid, "Aura: invoice already paid");

        uint256 fee = (msg.value * feeBasisPoints) / 10000;
        uint256 netAmount = msg.value - fee;

        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            payer: msg.sender,
            recipient: recipient,
            amount: msg.value,
            timestamp: block.timestamp,
            isPaid: true
        });

        totalPaymentsCount += 1;
        totalVolume += msg.value;
        merchantVolume[recipient] += netAmount;

        (bool success, ) = recipient.call{value: netAmount}("");
        require(success, "Aura: transfer to recipient failed");

        emit PaymentProcessed(invoiceId, msg.sender, recipient, msg.value, fee, block.timestamp);
    }

    /**
     * @notice Quick peer-to-peer or checkout payment
     */
    function processDirectPayment(address payable recipient, string calldata memo) external payable {
        require(msg.value > 0, "Aura: amount must be greater than 0");
        require(recipient != address(0), "Aura: invalid recipient");

        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "Aura: direct payment failed");

        totalPaymentsCount += 1;
        totalVolume += msg.value;

        emit PaymentProcessed(memo, msg.sender, recipient, msg.value, 0, block.timestamp);
    }

    /**
     * @notice Retrieve invoice payment details
     */
    function getInvoice(string calldata invoiceId) external view returns (Invoice memory) {
        return invoices[invoiceId];
    }

    /**
     * @notice Update platform fee (max 1%)
     */
    function setFeeBasisPoints(uint256 _fee) external onlyOwner {
        require(_fee <= 100, "Aura: fee cannot exceed 1%");
        feeBasisPoints = _fee;
    }

    /**
     * @notice Withdraw collected protocol fees
     */
    function withdrawFees(address payable to) external onlyOwner {
        require(to != address(0), "Aura: invalid address");
        uint256 balance = address(this).balance;
        require(balance > 0, "Aura: no fees to withdraw");
        (bool success, ) = to.call{value: balance}("");
        require(success, "Aura: withdrawal failed");
    }

    receive() external payable {}
}
