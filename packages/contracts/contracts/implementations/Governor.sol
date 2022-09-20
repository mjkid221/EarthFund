// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import "./ERC20Singleton.sol";
import "../interfaces/IClearingHouse.sol";
import "../interfaces/IDonationsRouter.sol";
import "../interfaces/IGovernor.sol";
import "../vendors/IENSRegistrar.sol";
import "../interfaces/IModuleProxyFactory.sol";
import "../vendors/IGnosisSafe.sol";

import "@reality.eth/contracts/development/contracts/IRealityETH.sol";

contract Governor is IGovernor, Ownable, ERC721Holder {
  PublicResolver public override ensResolver;
  ENSRegistry public override ensRegistry;
  IENSRegistrar public override ensRegistrar;
  GnosisSafeProxyFactory public override gnosisFactory;
  address public override gnosisSafeSingleton;
  address public override erc20Singleton;
  uint256 public override ensDomainNFTId;
  IClearingHouse public clearingHouse;
  IDonationsRouter public donationsRouter;

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
    require(
      address(_params.clearingHouse) != address(0),
      "invalid clearing house address"
    );
    require(
      address(_params.donationsRouter) != address(0),
      "invalid donations router address"
    );

    ensResolver = _params.ensResolver;
    ensRegistry = _params.ensRegistry;
    ensRegistrar = _params.ensRegistrar;
    gnosisFactory = _params.gnosisFactory;
    gnosisSafeSingleton = _params.gnosisSafeSingleton;
    erc20Singleton = _params.erc20Singleton;
    clearingHouse = _params.clearingHouse;
    donationsRouter = _params.donationsRouter;

    transferOwnership(_params.parentDao);
  }

  function addENSDomain(uint256 _domainNFTId) external override onlyOwner {
    require(ensDomainNFTId == 0, "ens domain already set");
    ensDomainNFTId = _domainNFTId;
    ensRegistrar.safeTransferFrom(
      address(msg.sender),
      address(this),
      _domainNFTId
    );

    ensRegistrar.reclaim(_domainNFTId, address(this));
  }

  function withdrawENSDomain(address _destination) external override onlyOwner {
    require(ensDomainNFTId > 0, "ens domain not set");
    uint256 _domainNFTId = ensDomainNFTId;
    delete ensDomainNFTId;
    ensRegistrar.safeTransferFrom(address(this), _destination, _domainNFTId);
  }

  function createChildDAO(
    Token calldata _tokenData,
    Safe calldata _safeData,
    Subdomain calldata _subdomain
  ) external override onlyOwner {
    require(ensDomainNFTId > 0, "ENS domain unavailable");

    /// Gnosis multi sig
    address safe = _createGnosisSafe(
      _safeData.safe,
      _safeData.zodiac,
      uint256(keccak256(abi.encodePacked(_subdomain.subdomain, address(this))))
    );

    /// Token
    address token = _createERC20Clone(
      _tokenData.tokenName,
      _tokenData.tokenSymbol
    );

    /// Register the token in the clearing house contract
    clearingHouse.registerChildDao(ERC20Singleton(token));

    // /// ENS Subdomain + Snapshot text record
    bytes32 node = _createENSSubdomain(
      safe,
      _subdomain.subdomain,
      _subdomain.snapshotKey,
      _subdomain.snapshotValue
    );

    emit ChildDaoCreated(safe, token, node);

    try
      donationsRouter.registerCause(
        IDonationsRouter.CauseRegistrationRequest({
          owner: address(safe),
          rewardPercentage: (10**16), // default reward % : (1%
          daoToken: address(token)
        })
      )
    {} catch (bytes memory reason) {
      emit RegisterCauseFailure(reason);
    }
  }

  function _createGnosisSafe(
    SafeCreationParams memory safeData,
    ZodiacParams memory zodiacData,
    uint256 safeDeploymentSalt
  ) internal returns (address safe) {
    // Create safe
    address[] memory initialOwners = new address[](safeData.owners.length + 1);
    uint256 i;
    for (i = 0; i < safeData.owners.length; ++i) {
      initialOwners[i] = safeData.owners[i];
    }
    initialOwners[initialOwners.length - 1] = address(this);
    safe = address(
      gnosisFactory.createProxyWithNonce(
        gnosisSafeSingleton,
        _getSafeInitializer(
          SafeCreationParams({
            owners: initialOwners,
            threshold: 1,
            to: safeData.to,
            data: "",
            fallbackHandler: safeData.fallbackHandler,
            paymentToken: safeData.paymentToken,
            payment: safeData.payment,
            paymentReceiver: safeData.paymentReceiver
          })
        ),
        safeDeploymentSalt
      )
    );

    // Create reality template if needed
    uint256 templateId;
    if (bytes(zodiacData.template).length > 0) {
      // Create new template in the oracle
      templateId = IRealityETH(zodiacData.oracle).createTemplate(
        zodiacData.template
      );
    } else {
      // Use existing template. ID's start at 0;
      templateId = zodiacData.templateId;
    }
    // Deploy zodiac module
    address module = IModuleProxyFactory(zodiacData.zodiacFactory).deployModule(
      zodiacData.moduleMasterCopy,
      _getZodiacInitializer(safe, templateId, zodiacData),
      uint256(keccak256(abi.encode(safeDeploymentSalt)))
    );

    // Enable module on safe
    IGnosisSafe(safe).execTransaction(
      safe,
      0,
      abi.encodeWithSignature("enableModule(address)", module),
      IGnosisSafe.Operation.Call,
      0,
      0,
      tx.gasprice,
      address(0),
      payable(msg.sender),
      _getApprovedHashSignature()
    );
    // Transfer safe control to dao (How to set threshold?)
    // Remove this contract as an owner
    IGnosisSafe(safe).execTransaction(
      safe,
      0,
      abi.encodeWithSignature(
        "removeOwner(address,address,uint256)",
        initialOwners[initialOwners.length - 2],
        initialOwners[initialOwners.length - 1],
        safeData.threshold
      ),
      IGnosisSafe.Operation.Call,
      0,
      0,
      tx.gasprice,
      address(0),
      payable(msg.sender),
      _getApprovedHashSignature()
    );
    emit ZodiacModuleEnabled(safe, module, templateId);
  }

  function _getApprovedHashSignature()
    internal
    view
    returns (bytes memory signature)
  {
    signature = abi.encode(
      uint8(1),
      bytes32(uint256(uint160(address(this)))),
      bytes32(0)
    );
  }

  function _getZodiacInitializer(
    address safe,
    uint256 templateId,
    ZodiacParams memory zodiacData
  ) internal pure returns (bytes memory initializer) {
    initializer = abi.encodeWithSignature(
      "setUp(address,address,address,address,uint32,uint32,uint32,uint256,uint256,address)",
      safe,
      safe,
      safe,
      zodiacData.oracle,
      zodiacData.timeout,
      zodiacData.cooldown,
      zodiacData.expiration,
      zodiacData.bond,
      templateId,
      zodiacData.arbitrator
    );
  }

  function _getSafeInitializer(SafeCreationParams memory safeData)
    internal
    pure
    returns (bytes memory initData)
  {
    initData = abi.encodeWithSignature(
      "setup(address[],uint256,address,bytes,address,address,uint256,address)",
      safeData.owners,
      safeData.threshold,
      safeData.to,
      safeData.data,
      safeData.fallbackHandler,
      safeData.paymentToken,
      safeData.payment,
      safeData.paymentReceiver
    );
  }

  function _createERC20Clone(bytes memory _name, bytes memory _symbol)
    internal
    returns (address token)
  {
    token = Clones.cloneDeterministic(
      erc20Singleton,
      keccak256(abi.encodePacked(_name, _symbol))
    );
    ERC20Singleton(token).initialize(_name, _symbol, address(clearingHouse));
  }

  function _calculateENSNode(bytes32 baseNode, bytes32 childNode)
    internal
    pure
    returns (bytes32 ensNode)
  {
    ensNode = keccak256(abi.encodePacked(baseNode, childNode));
  }

  function _createENSSubdomain(
    address _owner,
    bytes memory _name,
    bytes memory _key,
    bytes memory _value
  ) internal returns (bytes32 childNode) {
    bytes32 labelHash = keccak256(_name);

    bytes32 ensBaseNode = ensRegistrar.baseNode();
    bytes32 parentNode = _calculateENSNode(
      ensBaseNode,
      bytes32(ensDomainNFTId)
    );
    childNode = _calculateENSNode(parentNode, labelHash);

    ensRegistry.setSubnodeRecord(
      parentNode,
      labelHash,
      address(this),
      address(ensResolver),
      3600
    );

    ensResolver.setAddr(childNode, _owner);

    ensResolver.setText(childNode, string(_key), string(_value));
  }
}
