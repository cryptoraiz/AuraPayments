// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Faucet {
    IERC20 public token;
    address public owner;
    uint256 public amountToDispense = 10 * 10**6; // 10 USDC (ajustável)
    uint256 public cooldownTime = 24 hours;

    mapping(address => uint256) public nextRequestAt;

    event TokensDispensed(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Apenas o dono pode fazer isso");
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
        require(msg.sender != address(0), "Endereco invalido");
        require(block.timestamp >= nextRequestAt[msg.sender], "Aguarde o cooldown");
        require(token.balanceOf(address(this)) >= amountToDispense, "Faucet vazio");

        nextRequestAt[msg.sender] = block.timestamp + cooldownTime;
        
        require(token.transfer(msg.sender, amountToDispense), "Falha na transferencia");
        
        emit TokensDispensed(msg.sender, amountToDispense);
    }

    // Sacar fundos de volta se precisar
    function withdraw(uint256 amount) external onlyOwner {
        require(token.transfer(msg.sender, amount), "Falha no saque");
    }
}
