pragma solidity ^0.4.15;

import "./TokenPoll.sol";

// Voting is quadratic
contract TokenPollFactory {
  event TokenPollCreated(address indexed sender, address tokenPoll);

  function TokenPollFactory () {}

  function createTokenPoll(address _token, uint _allocStartTime, uint _allocEndTime) {
    TokenPoll tp = new TokenPoll(_token, _allocStartTime, _allocEndTime);

    TokenPollCreated(msg.sender, tp);
  }

}
