pragma solidity ^0.4.15;

import "./ERC20.sol";

// Voting is quadratic
contract TokenPoll {

  // State/Events/Constructor
  mapping (address => uint) public userTokenBalance; // user -> token balance
  totalTokenCount public uint; // Count of all tokens registered for vote
  totalVotePower public uint;  // Total voting power of users

  allocStartTime public uint;
  allocEndTime public uint;
  tokenContract public ERC20;

  function TokenPoll(address _token, uint _allocStartTime, uint _allocEndTime) {
    tokenContract = _token;
    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;
  }

  // Users
  function allocVotes() public inAllocVoteTimeFrame() {
    uint userTokens = tokenContract.balanceOf(msg.sender);
    
    // State changes
    userTokenBalance[msg.sender] = userTokens;
    totalTokenCount = totalTokenCount + userTokens;
    totalVotePower = totalVotePower + sqrt(userTokens);
  }

  // Internal/private

  // y = floor(sqrt(x))
  function sqrt(uint x) pure returns (uint) {
    uint z = (x + 1) / 2;
    uint y = x;

    while (z < y) {
        y = z;
        z = (x / z + z) / 2;
    }

    return y;
  }


  // Modifiers
  function getBlockTime() internal view returns  (uint) { return now; }

  modifier inAllocVoteTimeFrame() {
    uint time = getBlockTime();
    require(time > allocStartTime);
    require(time < allocEndTime);
    _;
  }

}
