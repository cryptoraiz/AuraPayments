// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title UniversalMockToken
 * @dev Contrato universal para deploy rápido de moedas de teste (WETH, WBTC, LINK, etc)
 * Ele permite definir o nome, símbolo e decimais diretamente no botão de Deploy do Remix,
 * além de cunhar (mintar) 10.000 tokens iniciais automaticamente para o criador.
 */
contract UniversalMockToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Construtor: Preencha isso na tela do Remix antes de clicar em Deploy
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        
        // Mint inicial de 10.000 tokens para a carteira que fez o deploy
        mint(msg.sender, 10_000 * 10**decimals);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Saldo insuficiente");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value, "Saldo insuficiente");
        require(allowance[from][msg.sender] >= value, "Sem permissao (allowance)");
        
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        
        emit Transfer(from, to, value);
        return true;
    }

    // Faucet integrado: Qualquer um pode se dar mais tokens se o saldo acabar
    function mint(address to, uint256 amount) public {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
