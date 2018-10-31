pragma solidity ^0.4.15;

import "./TokenPoll.sol";
import "./Ownable.sol";

// Voting is quadratic
contract TokenPollFactory {
  event TokenPollCreated(address indexed sender, address tokenPoll);

  address public stableCoin;

  function TokenPollFactory (address _stableCoin) {
    stableCoin = _stableCoin;
  }

  function createTokenPoll() {
    TokenPoll tp = new TokenPoll(stableCoin);
    tp.transferOwnership(msg.sender);
    TokenPollCreated(msg.sender, tp);
  }
}
