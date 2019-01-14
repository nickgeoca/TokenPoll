pragma solidity >=0.4.15;

import "./TokenPoll.sol";
import "./Ownable.sol";

// Voting is quadratic
contract TokenPollFactory {
  event TokenPollCreated(address indexed owner, address tokenPoll);

  constructor() public {}

  function createTokenPoll() public returns (address owner, address tokenPoll) {
    TokenPoll tp = new TokenPoll();
    tp.transferOwnership(msg.sender);

    owner = msg.sender;
    tokenPoll = address(tp);

    emit TokenPollCreated(owner, tokenPoll);
    return (owner, tokenPoll);
  }
}
