// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

interface IENSController {
    event NameRegistered(
        string name,
        bytes32 indexed label,
        address indexed owner,
        uint256 cost,
        uint256 expires
    );
    event NameRenewed(
        string name,
        bytes32 indexed label,
        uint256 cost,
        uint256 expires
    );
    event NewPriceOracle(address indexed oracle);

    function available(string memory name) external returns (bool);

    function makeCommitment(
        string memory name,
        address owner,
        bytes32 secret
    ) external pure returns (bytes32);

    function commit(bytes32 commitment) external;

    function registerWithConfig(
        string memory name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        address addr
    ) external payable;

    function register(
        string calldata name,
        address owner,
        uint256 duration,
        bytes32 secret
    ) external payable;

    function renew(string calldata name, uint256 duration) external payable;

    function rentPrice(string memory name, uint256 duration)
        external
        view
        returns (uint256);
}
