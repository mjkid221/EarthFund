// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

interface IGovernor {
    /// Structs
    struct Token {
        bytes tokenName;
        bytes tokenSymbol;
    }

    struct Safe {
        bytes initializer;
        uint256 salt;
    }

    struct Subdomain {
        bytes subdomain;
        // snapshot stuff here
    }

    /// Events
    event ChildDaoCreated(address indexed safe, address indexed token);

    /// Functions

    /// @notice Creates the constituent components of a child dao
    function createChildDAO(
        Token calldata _tokenData,
        Safe calldata _safeData,
        Subdomain calldata _subdomain
    ) external;
}
