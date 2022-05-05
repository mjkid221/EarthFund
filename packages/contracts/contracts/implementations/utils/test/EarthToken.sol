// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract EarthToken is ERC20 {
  constructor(uint256 _supply) ERC20("One Earth", "1EARTH") {
    _mint(msg.sender, _supply); // mint total supply the deployer account
  }
}
