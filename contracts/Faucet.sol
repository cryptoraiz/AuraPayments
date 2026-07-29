// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Faucet {
    IERC20 public token;
    address public owner;
    uint256 public amountToDispense = 100 * 10**6; // 100 USDC (adjustable)
    uint256 public cooldownTime = 24 hours;

    mapping(address => uint256) public nextRequestAt;

    event TokensDispensed(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor(address _tokenAddress) {
        token = IERC20(_tokenAddress);
        owner = msg.sender;
    }

    function setAmountToDispense(uint256 _amount) external onlyOwner {
        amountToDispense = _amount;
    }

    function setCooldownTime(uint256 _seconds) external onlyOwner {
        cooldownTime = _seconds;
    }

    function requestTokens() external {
        require(msg.sender != address(0), "Invalid address");
        require(block.timestamp >= nextRequestAt[msg.sender], "Cooldown active");
        require(token.balanceOf(address(this)) >= amountToDispense, "Faucet empty");

        nextRequestAt[msg.sender] = block.timestamp + cooldownTime;
        
        require(token.transfer(msg.sender, amountToDispense), "Transfer failed");
        
        emit TokensDispensed(msg.sender, amountToDispense);
    }

    // Withdraw funds back if needed
    function withdraw(uint256 amount) external onlyOwner {
        require(token.transfer(msg.sender, amount), "Withdraw failed");
    }
}
