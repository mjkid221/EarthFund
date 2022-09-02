// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./ERC20Singleton.sol";
import "./Governor.sol";
import "./DonationsRouter.sol";
import "./StakingRewards.sol";
import "../interfaces/IClearingHouse.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ClearingHouse is IClearingHouse, Ownable, Pausable {
  using SafeERC20 for ERC20;
  /*///////////////////////////////////////////////////////////////
                            STATE
  //////////////////////////////////////////////////////////////*/

  mapping(ERC20Singleton => CauseInformation) public causeInformation;

  ERC20 public immutable earthToken;

  Governor public governor;

  DonationsRouter public donationsRouter;

  StakingRewards public staking;

  uint256 public override maxSupply;

  uint256 public override maxSwap;

  constructor(
    ERC20 _earthToken,
    StakingRewards _staking,
    uint256 _maxSupply,
    uint256 _maxSwap,
    address _owner
  ) {
    require(address(_earthToken) != address(0), "invalid earth token address");

    require(address(_staking) != address(0), "invalid staking address");

    earthToken = _earthToken;

    staking = _staking;

    if (_maxSupply > 0) {
      maxSupply = _maxSupply;
    }

    if (_maxSwap > 0) {
      maxSwap = _maxSwap;
    }

    _transferOwnership(_owner);
  }

  /*///////////////////////////////////////////////////////////////
                          MODIFIERS
  //////////////////////////////////////////////////////////////*/

  modifier isGovernorSet() {
    require(address(governor) != address(0), "governor not set");
    _;
  }

  modifier isGovernor() {
    require(msg.sender == address(governor), "caller is not the governor");
    _;
  }

  modifier isDonationsRouterSet() {
    require(
      address(donationsRouter) != address(0),
      "donations router is not set"
    );
    _;
  }

  modifier isChildDaoRegistered(ERC20Singleton _childDaoToken) {
    require(
      causeInformation[_childDaoToken].childDaoRegistry,
      "invalid child dao address"
    );
    _;
  }

  modifier checkInvariants(ERC20Singleton _childDaoToken, uint256 _amount) {
    require(
      _childDaoToken.totalSupply() + _amount <= maxSupply,
      "exceeds max supply"
    );
    if (msg.sender != owner()) {
      require(_amount <= maxSwap, "exceeds max swap per tx");
    }
    _;
  }

  /*///////////////////////////////////////////////////////////////
                          SUPPLY LOGIC
  //////////////////////////////////////////////////////////////*/

  function setMaxSupply(uint256 _maxSupply)
    external
    override
    whenNotPaused
    onlyOwner
  {
    maxSupply = _maxSupply;
    emit MaxSupplySet(_maxSupply);
  }

  function setMaxSwap(uint256 _maxSwap)
    external
    override
    whenNotPaused
    onlyOwner
  {
    maxSwap = _maxSwap;
    emit MaxSwapSet(_maxSwap);
  }

  /*///////////////////////////////////////////////////////////////
                          REGISTER LOGIC
  //////////////////////////////////////////////////////////////*/

  function addGovernor(Governor _governor) external whenNotPaused onlyOwner {
    governor = _governor;
  }

  function addDonationsRouter(DonationsRouter _donationsRouter)
    external
    whenNotPaused
    onlyOwner
  {
    donationsRouter = _donationsRouter;
  }

  function registerChildDao(ERC20Singleton _childDaoToken, bool _autoStaking)
    external
    whenNotPaused
    isGovernorSet
    isGovernor
  {
    require(
      address(_childDaoToken) != address(earthToken),
      "cannot register 1Earth token"
    );

    require(
      _childDaoToken.owner() == address(this),
      "token not owned by contract"
    );

    require(
      causeInformation[_childDaoToken].childDaoRegistry == false,
      "child dao already registered"
    );

    _childDaoToken.approve(address(staking), type(uint256).max);

    causeInformation[_childDaoToken].childDaoRegistry = true;
    if (_autoStaking) causeInformation[_childDaoToken].autoStaking = true;

    emit ChildDaoRegistered(address(_childDaoToken));
  }

  /*///////////////////////////////////////////////////////////////
                          STAKING LOGIC
    //////////////////////////////////////////////////////////////*/

  function setAutoStake(ERC20Singleton _token, bool _state)
    external
    isDonationsRouterSet
  {
    // Only have to retrieve the owner variable
    (address owner, , , ) = donationsRouter.causeRecords(
      causeInformation[_token].causeId
    );
    require(msg.sender == owner, "sender not owner");
    causeInformation[_token].autoStaking = _state;
  }

  function setStaking(StakingRewards _staking) external onlyOwner {
    require(address(_staking) != address(0), "invalid staking address");

    staking = _staking;
  }

  /*///////////////////////////////////////////////////////////////
                            SWAP LOGIC
   //////////////////////////////////////////////////////////////*/

  function swapEarthForChildDao(ERC20Singleton _childDaoToken, uint256 _amount)
    external
    whenNotPaused
    isChildDaoRegistered(_childDaoToken)
    checkInvariants(_childDaoToken, _amount)
  {
    require(
      earthToken.balanceOf(msg.sender) >= _amount,
      "not enough 1Earth tokens"
    );

    // transfer 1Earth from msg sender to this contract
    uint256 earthBalanceBefore = earthToken.balanceOf(address(this));

    earthToken.safeTransferFrom(msg.sender, address(this), _amount);

    require(
      earthBalanceBefore + _amount == earthToken.balanceOf(address(this)),
      "1Earth token transfer failed"
    );

    ERC20Singleton childDaoToken = _childDaoToken;

    uint256 childDaoTotalSupplyBefore = childDaoToken.totalSupply();

    if (causeInformation[_childDaoToken].autoStaking) {
      // mint child dao tokens to this contract
      childDaoToken.mint(address(this), _amount);

      staking.stakeOnBehalf(msg.sender, address(_childDaoToken), _amount);
    } else {
      // mint child dao tokens to the msg sender
      childDaoToken.mint(msg.sender, _amount);
    }

    require(
      childDaoTotalSupplyBefore + _amount == childDaoToken.totalSupply(),
      "child dao token mint error"
    );

    emit TokensSwapped(
      address(earthToken),
      address(childDaoToken),
      _amount,
      causeInformation[childDaoToken].autoStaking
    );
  }

  function swapChildDaoForEarth(ERC20Singleton _childDaoToken, uint256 _amount)
    external
    whenNotPaused
    isChildDaoRegistered(_childDaoToken)
    checkInvariants(_childDaoToken, _amount)
  {
    ERC20Singleton childDaoToken = _childDaoToken;

    require(
      childDaoToken.balanceOf(msg.sender) >= _amount,
      "not enough child dao tokens"
    );

    // transfer 1Earth from this contract to the msg sender
    uint256 earthBalanceBefore = earthToken.balanceOf(address(this));

    earthToken.safeTransfer(msg.sender, _amount);

    require(
      earthBalanceBefore - _amount == earthToken.balanceOf(address(this)),
      "1Earth token transfer failed"
    );

    // burn msg sender's child dao tokens
    uint256 childDaoTotalSupplyBefore = childDaoToken.totalSupply();

    childDaoToken.burn(msg.sender, _amount);

    require(
      childDaoTotalSupplyBefore - _amount == childDaoToken.totalSupply(),
      "child dao token burn error"
    );

    emit TokensSwapped(
      address(childDaoToken),
      address(earthToken),
      _amount,
      false
    );
  }

  function swapChildDaoForChildDao(
    ERC20Singleton _fromChildDaoToken,
    ERC20Singleton _toChildDaoToken,
    uint256 _amount
  )
    external
    whenNotPaused
    isChildDaoRegistered(_fromChildDaoToken)
    isChildDaoRegistered(_toChildDaoToken)
    checkInvariants(_toChildDaoToken, _amount)
  {
    require(
      _fromChildDaoToken != _toChildDaoToken,
      "cannot swap the same token"
    );

    ERC20Singleton fromChildDaoToken = _fromChildDaoToken;

    ERC20Singleton toChildDaoToken = _toChildDaoToken;

    require(
      fromChildDaoToken.balanceOf(msg.sender) >= _amount,
      "not enough child dao tokens"
    );

    // burn msg sender's from child dao tokens
    uint256 fromChildDaoBalanceBefore = fromChildDaoToken.balanceOf(msg.sender);

    fromChildDaoToken.burn(msg.sender, _amount);

    require(
      fromChildDaoBalanceBefore - _amount ==
        fromChildDaoToken.balanceOf(msg.sender),
      "child dao token burn error"
    );

    // mint to child dao tokens to the msg sender
    uint256 toChildDaoBalanceBefore = toChildDaoToken.balanceOf(msg.sender);

    toChildDaoToken.mint(msg.sender, _amount);

    require(
      toChildDaoBalanceBefore + _amount ==
        toChildDaoToken.balanceOf(msg.sender),
      "child dao token mint error"
    );

    emit TokensSwapped(
      address(fromChildDaoToken),
      address(toChildDaoToken),
      _amount,
      causeInformation[toChildDaoToken].autoStaking
    );
  }

  /*///////////////////////////////////////////////////////////////
                            PAUSE LOGIC
    //////////////////////////////////////////////////////////////*/

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }
}
