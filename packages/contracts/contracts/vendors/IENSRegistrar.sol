import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IENSRegistrar is IERC721 {
    function reclaim(uint256 label) external;
}
