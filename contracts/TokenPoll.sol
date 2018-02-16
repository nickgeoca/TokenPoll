pragma solidity ^0.4.15;

import "./ERC20.sol";

// Voting is quadratic
contract TokenPoll {

  // State/Events/Constructor
  mapping (address => uint) public userTokenBalance; // user -> token balance
  uint public totalTokenCount; // Count of all tokens registered for vote
  uint public totalVotePower;  // Total voting power of users

  uint public allocStartTime;
  uint public allocEndTime;
  ERC20 public tokenContract;
  
  function TokenPoll(address _token, uint _allocStartTime, uint _allocEndTime) {
    tokenContract = ERC20(_token);
    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;
  }
  
  // Users
  function allocVotes() public inAllocVoteTimeFrame() {
    uint userTokens = tokenContract.balanceOf(msg.sender);
    uint userVotePower = getUserVotePower(msg.sender);

    // State changes
    userTokenBalance[msg.sender] = userTokens;
    totalTokenCount += userTokens;
    totalVotePower  += userVotePower;
  }

  // Internal/private

  function getUserVotePower(address user) public view returns (uint) {
    return sqrt(userTokenBalance[user]);
  }

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
