pragma solidity ^0.4.15;

import "./ERC20.sol";

// Voting is quadratic
contract TokenPoll {

  enum State { Uninitialized    // Waits token poll is parameterized
             , Initialized      // Waits until vote allocation. Can't have Running/Voting before votes are allocated
             , VoteAllocation   // Token balances should be frozen and users allocate votes during this period.
             , Running          // After vote allocation but not voting
             , Voting           // In voting state. Outcome is either State.Running or State.VoteFailed
             , VoteFailed       // If this happens multisig escrow initiates refund

             // Outcomes  
             , Successful       // End of polls
             , Refunding        // Users can withdraw remaining balance
             }

  // =====
  // State
  // =====  

  mapping (address => uint) public userTokenBalance; // user -> token balance

  address initializer;               // Owner function.. used to initialize
  bool refundFlag;                   // keep track of state
  bool voteFailedFlag;               // "
  bool initialized;                  // if contract is initialized with parameters

  ERC20 public tokenContract;        // Voting power is based on token ownership count
  ERC20 public stableCoin;           // 

  uint public totalRefund;           // Total size of refund

  address public escrow;             // Initiate escrow to send funds to ICO wallet

  uint public allocStartTime;        // Start/end of voting allocation
  uint public allocEndTime;          // "

  uint public userCount;             // Used for keeping track of quorum
  uint public totalTokenCount;       // Count of all tokens registered for vote
  uint public totalVotePower;        // Total voting power of users
  mapping (address => bool) voted;   // User has voted
  uint public yesVotes;              // 
  uint public noVotes;               // 

  // ======================
  // Constructor & fallback
  // ======================

  function TokenPoll(address _initializer) public { initializer = _initializer; }

  function initialize(address _token, address _stableCoin, address _escrow, uint _allocStartTime, uint _allocEndTime) public inState(State.Uninitialized) {
    require(msg.sender == initializer);
    require(_allocStartTime > now);

    initialized = true;
    tokenContract = ERC20(_token);
    stableCoin = ERC20(_stableCoin);
    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;
    escrow = _escrow;
  }

  // fallback
  function () public { require(false); return; }

  // =========
  // Functions
  // =========

  // Users
  function allocVotes() public inState(State.VoteAllocation){
    require(userTokenBalance[msg.sender] == 0);  // user has not allocated before

    uint userTokens = tokenContract.balanceOf(msg.sender);

    // Removed code
    // case where user repeats this 1) buys token 2) allocates votes
    // - works if an individual user's balance never goes down
    // totalVotePower  -= getUserVotePower(msg.sender);  
    // totalTokenCount -= userTokenBalance[msg.sender];

    // State changes
    userTokenBalance[msg.sender] = userTokens;
    totalVotePower  += getUserVotePower(msg.sender);
    totalTokenCount += userTokens;
    userCount += 1;
  }

  // todo vote window, vote params (qorem),
  function castVote(bool vote) {
    require(voted[msg.sender] == false);

    voted[msg.sender] = true;

    if (voteFor)
      yesVotes += 1;
    else
      noVotes += 1;
  }
  
LOOK OVER THESE
>>>>>>
  
  // function getEscrowFundsForRefund();
  // function raiseEscrowDailyLimit();

  // ????? function escrowWithdraw() public 

  function startRefund() public payable inState(State.VoteFailed) fromAddress(escrow) {
  escrow.reduceDailyLimitToZero()

    //escrow.sendAllCashOver() todo
    totalRefund = stableCoin.balanceOf(escrow);
    refundFlag = true;
  }
^^^^^
LOOK OVER THESE  

  function userRefund() public inState(State.Refunding) {
    address user = msg.sender;
    uint userTokenCount = userTokenBalance[user];

    // Get tokens then clear. Reentrant safe
    require(userTokenCount != 0);
    userTokenBalance[user] = 0;

    // refund
    uint refundSize = totalRefund * userTokenCount / totalTokenCount;

    escrow.execute() stableCoin.transfer(user, refundSize);
      
  }

  //  function voteSuccessful() {}
  //     if (voteDecided and QuoremReached) State.Running, sendBalanceTo

  // =======
  // Getters
  // =======

  function getState() public view returns (State) {
    if (!initialized)          return State.Uninitialized;
    if (now < allocStartTime)  return State.Initialized;

    if (allocStartTime < now 
        && now < allocEndTime) return State.VoteAllocation;

    if (refundFlag)            return State.Refunding;
    if (now > allocEndTime)    return State.Running;

    else                       return State.Successful;
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

  // This must be private
  function untrustedSendEth(address a, uint v) private { require(a.send(v)); } // untrusted external call

  // Modifiers
  modifier inState(State s) {
    require(getState() == s);
    _;
  }

  modifier fromAddress(address _escrow) {
    require(escrow == _escrow);
    _;
  }

}
