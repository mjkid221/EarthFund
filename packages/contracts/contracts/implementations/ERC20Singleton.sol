// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IERC20Singleton.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract ERC20Singleton is
    IERC20Singleton,
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable
{
    constructor() initializer {
        __ERC20_init("BASE", "BASE");
        __Ownable_init();
        transferOwnership(address(1));
    }

    function initialize(
        bytes calldata _name,
        bytes calldata _symbol,
        address _owner
    ) external initializer {
        __ERC20_init(string(_name), string(_symbol));
        __Ownable_init();
        transferOwnership(_owner);
    }

    function mint(address account, uint256 amount) external override onlyOwner {
        _mint(account, amount);
    }
}
