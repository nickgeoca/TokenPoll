pragma solidity ^0.4.19;

import './../../contracts/TokenPoll.sol';

contract MockTokenPoll is TokenPoll {
  uint256 public blockNumber__;
  uint256 public blockTime__;

  
  function MockTokenPoll(address _token, uint _allocStartTime, uint _allocEndTime) 
    MockTokenPoll(_token, _allocStartTime, _allocEndTime)
  {}


  function getBlockNumber() internal constant returns (uint256) {
    return blockNumber__;
  }

  function setBlockNumber(uint256 _blockNumber) public {
    blockNumber__ = _blockNumber;
  }

  function getBlockTime() internal constant returns (uint256) {
    return blockTime__;
  }

  function setBlockTime(uint256 _blockTime) public {
    blockTime__ = _blockTime;
  }
  
}
