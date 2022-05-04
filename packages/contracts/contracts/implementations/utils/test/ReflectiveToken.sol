// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract ReflectiveToken is ERC20 {
  constructor(string memory _tokenName, string memory _tokenSymbol)
    ERC20(_tokenName, _tokenSymbol)
  {}

  /*///////////////////////////////////////////////////////////////
                        FAULTY FUNCTIONS
    //////////////////////////////////////////////////////////////*/
  function mint(address account, uint256 amount) external {
    _mint(account, amount + 1);
  }

  function burn(address account, uint256 amount) external {
    _burn(account, amount - 1);
  }

  /*///////////////////////////////////////////////////////////////
                      FAULTY FUNCTION OVERRIDES
    //////////////////////////////////////////////////////////////*/
  function transfer(address to, uint256 amount)
    public
    virtual
    override
    returns (bool)
  {
    super.transfer(to, amount + 1);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    super.transferFrom(from, to, amount + 1);
    return true;
  }
}
