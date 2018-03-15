pragma solidity ^0.4.15;

import "./ERC20.sol";

// Voting is quadratic
contract TokenPoll {

  // todo add new state to js
  enum State { Start            // Waits until vote allocation. Can't have Running/Voting before votes are allocated
             , VoteAllocation   // Token balances should be frozen and users allocate votes during this period.
             , Running          // 
             , Voting           // In voting state. Outcome is either State.Running or State.VoteFailed
             , VoteFailed       // If this happens multisig wallet initiates refund
             , Refund           // Users can withdraw remaining balance
             , End }            // 

  // =====
  // State
  // =====  

  mapping (address => uint) public userTokenBalance; // user -> token balance

  uint public totalTokenCount;                       // Count of all tokens registered for vote
  uint public totalVotePower;                        // Total voting power of users

  uint public userCount;

  uint public allocStartTime;
  uint public allocEndTime;

  ERC20 public tokenContract;

  bool refundFlag;
  bool voteFailedFlag;

  uint public totalRefund;

  address public wallet;

  // ======================
  // Constructor & fallback
  // ======================
todo change from wallet to escrow...
  todo escrow.sendMoneyToICOWallet()
  function TokenPoll(address _token, address _wallet, uint _allocStartTime, uint _allocEndTime) public {
    tokenContract = ERC20(_token);
    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;
    wallet = _wallet;
  }

  // fallback
  function () public { require(false); return; }

  // =========
  // Functions
  // =========

  // Users
  function allocVotes() public inState(State.VoteAllocation){
    require(userHasAllocated[msg.sender] == false);

    uint userTokens = tokenContract.balanceOf(msg.sender);

    // Removed code
    // case where user repeats this 1) buys token 2) allocates votes
    // - works if an individual user's balance never goes down
    // totalVotePower  -= getUserVotePower(msg.sender);  
    // totalTokenCount -= userTokenBalance[msg.sender];

    // State changes
    userHasAllocated[msg.sender] = true;
    userTokenBalance[msg.sender] = userTokens;
    totalVotePower  += getUserVotePower(msg.sender);
    totalTokenCount += userTokens;
    userCount += 1;
  }

  function userVote(bool voteFor) {
    require(voted[msg.sender] == false);

    voted[msg.sender] = true;

    if (voteFor)
      yes += 1;
    else
      no += 1;

    todo vote window, vote params (qorem),
      if (voteDecided and QuoremReached) State.Running, sendBalanceTo
  }

  function startRefund() public payable inState(State.VoteFailed) fromAddress(wallet) {
    totalRefund = msg.value;
    refundFlag = true;
  }

  function userRefund() public inState(State.Refund) {
    uint userTokenCount = userTokenBalance[msg.sender];
    uint refundSize = totalRefund * userTokenCount / totalTokenCount;

    // refund
    require(msg.sender.send(refundSize));
  }  

  // =======
  // Getters
  // =======

  function getState() public view returns (State) {
    if (now < allocStartTime) 
      return State.Start;
    if (allocStartTime < now && now < allocEndTime) 
      return State.VoteAllocation;

    if (refundFlag)
      return State.Refund;
    if (now > allocEndTime) 
      return State.Running;

    return State.End;
  }

  function getUserVotePower(address user) public view returns (uint) {
    return sqrt(userTokenBalance[user]);
  }

  // y = floor(sqrt(x))
  function sqrt(uint x) public pure returns (uint) {
    uint z = (x + 1) / 2;
    uint y = x;
    
    while (z < y) {
      y = z;
      z = (x / z + z) / 2;
    }
    
    return y;
  }

  
  // ================
  // Internal/private
  // ================

  // Modifiers
  modifier inState(State s) {
    require(getState() == s);
    _;
  }

  modifier fromAddress(address _wallet) {
    require(wallet == _wallet);
    _;
  }

}
