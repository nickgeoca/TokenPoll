pragma solidity ^0.4.15;

import "./TokenPoll.sol";

// Voting is quadratic
contract TokenPollFactory {
  event TokenPollCreated(address indexed sender, address tokenPoll);

  function TokenPollFactory () {}

  function createTokenPoll() {
    TokenPoll tp = new TokenPoll(msg.sender);
    TokenPollCreated(msg.sender, tp);
  }
}
