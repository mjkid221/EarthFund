// SPDX-License-Identifier: MIT
pragma solidity "0.8.13";

interface IGovernor {
    /// Structs
    struct ChildDAO {
        bytes tokenName;
        bytes tokenSymbol;
        address[] initialSafeOwners;
        bytes subdomain;
    }

    struct SnapShot {
        bytes placeholder;
    }

    /// Events
    event ChildDAOCreated(ChildDAO dao, SnapShot snapshot);
    event TokenCreated(address indexed token, bytes name, bytes symbol);
    event ENSCreated(bytes subdomain);
    event SnapshotSetup();

    /// Functions
    function createChildDAO(
        ChildDAO calldata childDao,
        SnapShot calldata snapShot
    ) external;

    /// Needs admin functions?
}
