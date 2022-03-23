// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

interface IERC20Singleton {
    function initialize(
        bytes calldata _name,
        bytes calldata _symbol,
        address _owner
    ) external;
}
