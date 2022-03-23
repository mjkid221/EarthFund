// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IGovernor.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/Resolver.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";

import "../interfaces/IERC20Singleton.sol";

contract Governor is IGovernor, Ownable {
    Resolver public ENSResolver;
    GnosisSafeProxyFactory public gnosisFactory;
    address public gnosisSafeSingleton;
    address public erc20Singleton;
    uint256 public tokenSalt;

    /// Needs resolver, registrar?, gnosis factory,
    constructor(
        Resolver _ENSResolver,
        GnosisSafeProxyFactory _gnosisFactory,
        address _gnosisSafeSingleton,
        address _erc20Singleton
    ) {
        require(
            address(_ENSResolver) != address(0),
            "invalid resolver address"
        );
        require(
            address(_gnosisFactory) != address(0),
            "invalid factory address"
        );
        require(
            _gnosisSafeSingleton != address(0),
            "invalid safe singleton address"
        );
        require(
            _erc20Singleton != address(0),
            "invalid token singleton address"
        );

        ENSResolver = _ENSResolver;
        gnosisFactory = _gnosisFactory;
        gnosisSafeSingleton = _gnosisSafeSingleton;
        erc20Singleton = _erc20Singleton;
    }

    function createChildDAO(
        Token calldata _tokenData,
        Safe calldata _safeData,
        Subdomain calldata _subdomain
    ) external override {
        /// Gnosis multi sig
        address safe = createGnosisSafe(_safeData.initializer, _safeData.salt);

        /// Token
        address token = createERC20Clone(
            _tokenData.tokenName,
            _tokenData.tokenSymbol,
            safe
        );

        /// ENS
        createENSSubdomain(_subdomain.subdomain);

        /// Snapshot
        enableSnapshot();

        emit ChildDaoCreated(safe, token);
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
        uint256 salt = tokenSalt++;
        token = Clones.cloneDeterministic(erc20Singleton, bytes32(salt));
        IERC20Singleton(token).initialize(_name, _symbol, _safe);
    }

    function createENSSubdomain(bytes memory name) internal {}

    function enableSnapshot() internal {}
}
