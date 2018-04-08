pragma solidity ^0.4.15;

import "./ERC20.sol";

// todo change initalizier to owner
// todo safe math

contract Escrow {
  function submitTransaction(address,uint256,bytes) public;
}

contract EscrowERC20WithdrawDailyLimitInterface {

  struct WithdrawT {
    uint dailyLimit;             // User cap
    uint dayLastSpent;           // Last day withdrew from
    uint cumulativeSpentLastDay; // Cumulative balance from last withdraw date
  }
  
  // "erc20.transfer(to, amount)"
  function _withdrawTokens(address erc20, address escrow, address to, uint amount) internal;

  function calcMaxWithdraw() public constant returns (uint);

  function _changeEscrowDailyLimit(uint _newLim) internal;
}

contract EscrowERC20WithdrawWithDailyLimit is EscrowERC20WithdrawWithDailyLimitInterface {

  WithdarwT private withdraw;
  
  // ======
  // Public
  // ======

  function remainingWithdraw() public constant returns (uint) {
    uint today = now / 24 hours;
    bool haveNotWithdrawnToday = today > withdraw.dayLastSpent;

    // If new day, then they have max dailyLimit
    if (haveNotWithdrawnToday)
      return withdraw.dailyLimit;

    return (withdraw.cumulativeSpentLastDay > withdraw.dailyLimit)
           ? 0                                                       // Happens if decrease dailyLimit on same day
           : withdraw.dailyLimit - withdraw.cumulativeSpentLastDay;  // maxSpending - runningSpending
  }

  // todo. at what point can they start withdrawing?
  // todo keep or add wallet?
  function _withdrawTokens(address erc20, address escrow, address _to, uint _amount) internal {
    deductDailyWithdraw(amount);

    // transfer(address,uint256)
    bytes memory data = new bytes(4 + 20 + 32);
    uint i = 0;
    for (; i < 4; i++)  data[i] = bytes4(0xa9059cbb)[i];
    for (; i < 24; i++) data[i] = bytes20(_to)[i];
    for (; i < 56; i++) data[i] = bytes32(_amount)[i];
    
    // Call through escrow -- "erc20.transfer(to, amount)"
    Escrow(escrow).submitTransaction(erc20, 0, data);    
  }

  // Clears daily limit for the day.
  function _changeEscrowDailyLimit(uint _newLim) internal { withdraw.dailyLimit = _newLim; }

  // =======
  // Private
  // =======

  function deductDailyWithdraw(uint amount) private {
    // Update if latest day
    uint today = now / 24 hours;
    if (today > withdraw.dayLastSpent) {
      withdraw.cumulativeSpentLastDay = 0;
      withdraw.dayLastSpent = now / 24 hours; // today
    }

    // Make sure don't go over
    uint remaining = (withdraw.dailyLimit - withdraw.cumulativeSpentLastDay);
    require(remaining >= amount); 

    // Deduct balance
    withdraw.cumulativeSpentLastDay += amount;
  }
}

// Voting is quadratic
contract TokenPoll is EscrowERC20WithdrawWithDailyLimit {

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

  function () public { require(false); return; }

  // =============
  // ICO Functions
  // =============

  // ERC20 Withdraw stuff
  function withdrawTokens(address to, uint value) public isController() { _withdrawTokens(stableCoin, escrow, to, value); }

  function initialize(address _token, address _stableCoin, address _escrow, uint _allocStartTime, uint _allocEndTime, uint _dailyLimit) public inState(State.Uninitialized) {
    require(msg.sender == initializer);
    require(_allocStartTime > now);

    initialized = true;
    tokenContract = ERC20(_token);
    stableCoin = ERC20(_stableCoin);
    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;
    escrow = _escrow;
    _changeEscrowDailyLimit(_dailyLimit);
  }

  // ==============
  // User Functions
  // ==============
  
  // Users
  function allocVotes() public inState(State.VoteAllocation){
    require(userTokenBalance[msg.sender] == 0);  // user has not allocated before

    uint userTokens = tokenContract.balanceOf(msg.sender);

    // State changes
    userTokenBalance[msg.sender] = userTokens;
    totalVotePower  += getUserVotePower(msg.sender);
    totalTokenCount += userTokens;
    userCount += 1;
  }

  // todo vote window, vote params (qorem),
  function castVote(bool vote) public {
    require(voted[msg.sender] == false);

    voted[msg.sender] = true;

    if (voteFor)
      yesVotes += 1;
    else
      noVotes += 1;
  }

  function userRefund() public inState(State.Refunding) {
    address user = msg.sender;
    uint userTokenCount = userTokenBalance[user];

    // Get tokens then clear. Reentrant safe
    require(userTokenCount != 0);
    userTokenBalance[user] = 0;

    // refund
    uint refundSize = totalRefund * userTokenCount / totalTokenCount;
    escrowSendStableCoins(user, refundSize);
  }

  function startRefund() public payable inState(State.VoteFailed) {
    _changeEscrowDailyLimit(0);
    totalRefund = stableCoin.balanceOf(escrow);
    refundFlag = true;
  }

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
  // Modifiers
  // ================

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
