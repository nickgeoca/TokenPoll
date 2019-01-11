pragma solidity >=0.4.15;

import "./TokenPoll.sol";
import "./Ownable.sol";

// Voting is quadratic
contract TokenPollFactory {
  event TokenPollCreated(address indexed sender, address tokenPoll);

  constructor() public {}

  function createTokenPoll() public returns (address) {
    TokenPoll tp = new TokenPoll();
    tp.transferOwnership(msg.sender);
    emit TokenPollCreated(msg.sender, address(tp));
    return address(tp);
  }
}
