pragma solidity ^0.4.15;

import "./TokenPoll.sol";
import "./../lib/Ownable.sol";

// Voting is quadratic
contract TokenPollFactory {
  event TokenPollCreated(address indexed sender, address tokenPoll);

  function TokenPollFactory () {}

  function createTokenPoll(address escrow) returns (address) {
    TokenPoll tp = new TokenPoll(escrow);
    tp.transferOwnership(msg.sender);
    TokenPollCreated(msg.sender, tp);

    return tp;
  }
}
