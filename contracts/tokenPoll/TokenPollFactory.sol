pragma solidity ^0.4.15;

import "./TokenPoll.sol";
import "./../lib/Ownable.sol";

// Voting is quadratic
contract TokenPollFactory {
  event TokenPollCreated(address indexed sender, address tokenPoll);

  function TokenPollFactory () {}

  function createTokenPoll(address _escrow, address _stableCoin, address _icoToken, uint _roundOneFunding) returns (address) {
    TokenPoll tp = new TokenPoll(_escrow, _stableCoin, _icoToken, _roundOneFunding);
    tp.transferOwnership(msg.sender);
    TokenPollCreated(msg.sender, tp);

    return tp;
  }
}
