// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IGovernor.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IERC20Singleton.sol";

contract Governor is IGovernor, Ownable, ERC721Holder {
    PublicResolver public override ensResolver;
    ENSRegistry public override ensRegistry;
    IERC721 public override ensRegistrar;
    GnosisSafeProxyFactory public override gnosisFactory;
    address public override gnosisSafeSingleton;
    address public override erc20Singleton;
    uint256 public override tokenSalt = 1;
    uint256 public override ensDomainNFTId;
    bytes32 public override label;

    constructor(ConstructorParams memory _params) {
        require(
            address(_params.ensResolver) != address(0),
            "invalid resolver address"
        );
        require(
            address(_params.ensRegistry) != address(0),
            "invalid registry address"
        );
        require(
            address(_params.ensRegistrar) != address(0),
            "invalid registrar address"
        );
        require(
            address(_params.gnosisFactory) != address(0),
            "invalid factory address"
        );
        require(
            _params.gnosisSafeSingleton != address(0),
            "invalid safe singleton address"
        );
        require(
            _params.erc20Singleton != address(0),
            "invalid token singleton address"
        );
        require(_params.parentDao != address(0), "invalid owner");

        ensResolver = _params.ensResolver;
        ensRegistry = _params.ensRegistry;
        ensRegistrar = _params.ensRegistrar;
        gnosisFactory = _params.gnosisFactory;
        gnosisSafeSingleton = _params.gnosisSafeSingleton;
        erc20Singleton = _params.erc20Singleton;

        transferOwnership(_params.parentDao);
    }

    function addENSDomain(uint256 _domainNFTId, bytes32 _label)
        external
        override
        onlyOwner
    {
        label = _label;
        ensDomainNFTId = _domainNFTId;
        ensRegistrar.safeTransferFrom(
            address(msg.sender),
            address(this),
            _domainNFTId
        );
    }

    function createChildDAO(
        Token calldata _tokenData,
        Safe calldata _safeData,
        Subdomain calldata _subdomain
    ) external override {
        require(ensDomainNFTId > 0, "ENS domain unavailable");

        /// Gnosis multi sig
        address safe = createGnosisSafe(
            _safeData.initializer,
            uint256(keccak256(bytes(_tokenData.tokenName)))
        );

        /// Token
        address token = createERC20Clone(
            _tokenData.tokenName,
            _tokenData.tokenSymbol,
            safe
        );

        /// ENS Subdomain + Snapshot text record
        bytes32 node = createENSSubdomain(
            safe,
            _subdomain.subdomain,
            _subdomain.snapshotKey,
            _subdomain.snapshotValue
        );

        emit ChildDaoCreated(safe, token, node);
    }

    function createGnosisSafe(bytes memory _initializer, uint256 _salt)
        internal
        returns (address safe)
    {
        safe = address(
            gnosisFactory.createProxyWithNonce(
                gnosisSafeSingleton,
                _initializer,
                _salt
            )
        );
    }

    function createERC20Clone(
        bytes memory _name,
        bytes memory _symbol,
        address _safe
    ) internal returns (address token) {
        token = Clones.cloneDeterministic(erc20Singleton, bytes32(tokenSalt++));
        IERC20Singleton(token).initialize(_name, _symbol, _safe);
    }

    function createENSSubdomain(
        address _owner,
        bytes memory _name,
        bytes memory _key,
        bytes memory _value
    ) internal returns (bytes32 node) {
        node = keccak256(_name);
        ensRegistry.setSubnodeRecord(
            node,
            label,
            address(this),
            address(ensResolver),
            3600
        );

        ensResolver.setAddr(node, _owner);
        ensResolver.setText(node, string(_key), string(_value));
        ensRegistry.setSubnodeOwner(node, label, _owner);
    }
}
