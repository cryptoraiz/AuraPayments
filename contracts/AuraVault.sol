// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuraVault
 * @dev Unified Treasury Contract for Faucet and Token Swaps on Arc Testnet
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract AuraVault {
    address public owner;
    address public faucetSigner; // A carteira do nosso Backend
    IERC20 public eurcToken;
    IERC20 public cirbtcToken;
    
    // Taxas de Cambio Fixas para MVP
    // 1 Native USDC (18 decimals) = 0.92 EURC (6 decimals)
    // 1 cirBTC (8 decimals) = 60000 USDC (18 decimals)
    
    event SwapNativeForToken(address indexed user, address tokenOut, uint256 amountIn, uint256 amountOut);
    event SwapTokenForNative(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);
    event FaucetFunded(address indexed user, uint256 amount);

    constructor(address _eurcAddress, address _cirbtcAddress, address _faucetSigner) {
        owner = msg.sender;
        eurcToken = IERC20(_eurcAddress);
        cirbtcToken = IERC20(_cirbtcAddress);
        faucetSigner = _faucetSigner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyFaucetSigner() {
        require(msg.sender == faucetSigner || msg.sender == owner, "Not authorized for Faucet");
        _;
    }

    // ============================================
    // MÓDULO DE SWAP (TROCA) - USDC para EURC
    // ============================================

    function swapNativeForEURC() external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        uint256 eurcDecimalsConversion = msg.value / 1e12; 
        uint256 amountOut = (eurcDecimalsConversion * 92) / 100;
        
        require(eurcToken.balanceOf(address(this)) >= amountOut, "Cofre sem liquidez de EURC");
        bool success = eurcToken.transfer(msg.sender, amountOut);
        require(success, "EURC transfer failed");
        emit SwapNativeForToken(msg.sender, address(eurcToken), msg.value, amountOut);
    }

    function swapEURCForNative(uint256 eurcAmount) external {
        require(eurcAmount > 0, "Amount must be greater than 0");
        uint256 usdcDecimalsConversion = eurcAmount * 1e12;
        uint256 amountOut = (usdcDecimalsConversion * 100) / 92;
        
        require(address(this).balance >= amountOut, "Cofre sem liquidez de USDC");
        bool success = eurcToken.transferFrom(msg.sender, address(this), eurcAmount);
        require(success, "EURC transferFrom failed.");
        (bool nativeSuccess, ) = msg.sender.call{value: amountOut}("");
        require(nativeSuccess, "Native transfer failed");
        emit SwapTokenForNative(msg.sender, address(eurcToken), eurcAmount, amountOut);
    }

    // ============================================
    // MÓDULO DE SWAP (TROCA) - USDC para cirBTC
    // ============================================

    function swapNativeForCirBTC() external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        // USDC (18 dec) to cirBTC (8 dec). Price: 60,000 USDC = 1 cirBTC
        // amountOut = (msg.value / 10^10) / 60000
        uint256 cirbtcDecimalsConversion = msg.value / 1e10; 
        uint256 amountOut = cirbtcDecimalsConversion / 60000;
        
        require(cirbtcToken.balanceOf(address(this)) >= amountOut, "Cofre sem liquidez de cirBTC");
        bool success = cirbtcToken.transfer(msg.sender, amountOut);
        require(success, "cirBTC transfer failed");
        emit SwapNativeForToken(msg.sender, address(cirbtcToken), msg.value, amountOut);
    }

    function swapCirBTCForNative(uint256 btcAmount) external {
        require(btcAmount > 0, "Amount must be greater than 0");
        // cirBTC (8 dec) to USDC (18 dec). Price: 1 cirBTC = 60,000 USDC
        // amountOut = (btcAmount * 10^10) * 60000
        uint256 usdcDecimalsConversion = btcAmount * 1e10;
        uint256 amountOut = usdcDecimalsConversion * 60000;
        
        require(address(this).balance >= amountOut, "Cofre sem liquidez de USDC");
        bool success = cirbtcToken.transferFrom(msg.sender, address(this), btcAmount);
        require(success, "cirBTC transferFrom failed.");
        (bool nativeSuccess, ) = msg.sender.call{value: amountOut}("");
        require(nativeSuccess, "Native transfer failed");
        emit SwapTokenForNative(msg.sender, address(cirbtcToken), btcAmount, amountOut);
    }

    // ============================================
    // MÓDULO DE FAUCET
    // ============================================
    
    function requestFaucet(address to, uint256 amount) external onlyFaucetSigner {
        require(address(this).balance >= amount, "Cofre sem USDC suficiente para o Faucet");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Faucet transfer failed");
        emit FaucetFunded(to, amount);
    }

    // ============================================
    // GERENCIAMENTO DA TESOURARIA (Admin)
    // ============================================

    function withdrawNative(uint256 amount) external onlyOwner {
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdraw failed");
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(msg.sender, amount);
    }

    function setFaucetSigner(address newSigner) external onlyOwner {
        faucetSigner = newSigner;
    }
    
    receive() external payable {}
}
