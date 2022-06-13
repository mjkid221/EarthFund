// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DAOToken is ERC20 {
    constructor(uint256 _supply) ERC20("DAO Token", "DAO") {
        _mint(msg.sender, _supply); // mint total supply the deployer account
    }
}
