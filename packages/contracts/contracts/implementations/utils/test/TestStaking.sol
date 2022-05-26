// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

contract TestStaking {
    event Distribution(address indexed daoToken, uint256 amount);

    constructor() {}

    function distributeRewards(address _daoToken, uint256 _amount) external {
        emit Distribution(_daoToken, _amount);
    }
}
