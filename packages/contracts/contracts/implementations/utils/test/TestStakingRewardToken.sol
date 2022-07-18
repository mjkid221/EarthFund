// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StakingRewardToken is ERC20 {
    constructor(uint256 _supply) ERC20("Test Tether USD", "tUSDT") {
        _mint(msg.sender, _supply); // mint total supply the deployer account
    }

    function mint(address _to, uint256 _supply) external {
        _mint(_to, _supply);
    }
}
