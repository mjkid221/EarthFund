// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../vendors/IENSRegistrar.sol";

interface IGovernor {
    /// Structs
    struct ConstructorParams {
        PublicResolver ensResolver;
        ENSRegistry ensRegistry;
        IENSRegistrar ensRegistrar;
        GnosisSafeProxyFactory gnosisFactory;
        address gnosisSafeSingleton;
        address erc20Singleton;
        address parentDao;
    }
    struct Token {
        bytes tokenName;
        bytes tokenSymbol;
    }

    struct Safe {
        bytes initializer;
    }

    struct Subdomain {
        bytes subdomain;
        bytes snapshotKey;
        bytes snapshotValue;
    }

    /// Events
    event ChildDaoCreated(
        address indexed safe,
        address indexed token,
        bytes32 node
    );

    /// Functions

    /// @notice Creates the constituent components of a child dao
    /// @param _tokenData The details of the ERC20 token to create
    /// @param _safeData The details of the Gnosis safe to create
    /// @param _subdomain The details of the ens subdomain to create
    function createChildDAO(
        Token calldata _tokenData,
        Safe calldata _safeData,
        Subdomain calldata _subdomain
    ) external;

    /// @notice Transfers an ENS NFT into the contract for use with subdomains
    /// @param _domainNFTId The ENS NFT to transfer in
    function addENSDomain(uint256 _domainNFTId) external;

    /// @notice Autogenerated getters
    function ensResolver() external view returns (PublicResolver);

    function ensRegistry() external view returns (ENSRegistry);

    function ensRegistrar() external view returns (IENSRegistrar);

    function gnosisFactory() external view returns (GnosisSafeProxyFactory);

    function gnosisSafeSingleton() external view returns (address);

    function erc20Singleton() external view returns (address);

    function tokenSalt() external view returns (uint256);

    function ensDomainNFTId() external view returns (uint256);
}
