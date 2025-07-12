// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ReviewToken
 * @dev ERC20 minimal senza trasferimenti, con mint e burn con codici sconto
 */
contract ReviewToken {
    string public name = "ReviewToken";
    string public symbol = "RVT";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    // Owner del contratto gestione recensioni
    address public gestioneRecensioni;

    mapping(address => uint256) private balances;

    // Eventi ERC20 base
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Modificatore per funzioni solo gestione recensioni
    modifier onlyGestioneRecensioni() {
        require(msg.sender == gestioneRecensioni, "Solo gestione recensioni puo mintare");
        _;
    }

    // Imposta una volta l'indirizzo gestione recensioni
    function setGestioneRecensioni(address _gestioneRecensioni) external {
        require(gestioneRecensioni == address(0), "Indirizzo gia settato");
        gestioneRecensioni = _gestioneRecensioni;
    }

    // Ritorna il saldo token di un indirizzo
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    // Mint token (solo gestione recensioni)
    function mint(address to, uint256 amount) external onlyGestioneRecensioni {
        require(to != address(0), "Mint a zero address non valido");
        totalSupply += amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
    }

    // Burn token (solo quantità esatta 1 token intero)
    function burn(uint256 amount) external {
        require(amount == 1e18, "Devi bruciare 1 token intero");
        require(balances[msg.sender] >= amount, "Saldo insufficiente per burn");
        balances[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    // Blocca transfer, approve, transferFrom: token non trasferibile
    function transfer(address, uint256) external pure returns (bool) {
        revert("Transfer disabilitato");
    }

    function approve(address, uint256) external pure returns (bool) {
        revert("Approve disabilitato");
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("transferFrom disabilitato");
    }

}