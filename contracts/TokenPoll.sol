pragma solidity ^0.4.15;

import "./Ownable.sol";
import "./ERC20.sol";
import "./SafeMath.sol";


contract Escrow {
  function submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId);
  address public erc20;
}

// https://www.stellar.org/developers/guides/issuing-assets.html
// https://www.stellar.org/blog/tokens-on-stellar/

// todo change initalizier to owner
// todo safe math

// Voting is quadratic
contract TokenPoll is Ownable {
  using SafeMath for uint256;

  enum State { Uninitialized      // Waits token poll is parameterized
             , Initialized        // Waits until vote allocation. Can't have InRound/Voting before votes are allocated
             , VoteAllocation     // Token balances should be frozen and users allocate votes during this period.

             , InRound            // Voting period. Follows VoteAllocation & NextRoundApproved
             , PostRoundDecision
             , NextRoundApproved

             // End states
             , Refund            // Users can withdraw remaining balance
             , Finished          // End of polls

             , UnknownState
             }

  event Vote(address indexed voter, bool vote);

  // =====
  // State
  // =====  

  // State variables
  bool refundFlag;                   // keep track of state
  bool nextRoundApprovedFlag;        // "
  bool initializedFlag;              // if contract is initialized with parameters

  // Round variables
  uint public constant maxTimeBetweenRounds = 180 days;
  uint public constant roundDuration = 1 weeks;
  uint public constant numberOfRounds = 12;
  uint public currentRoundNumber;
  uint public allocStartTime;        // Start/end of voting allocation
  uint public allocEndTime;          // "
  uint public currentRoundStartTime; // ...

  // Fund variables
  ERC20 public stableCoin;           // Location of funds
  address public escrow;             // Initiate escrow to send funds to ICO wallet
  uint public totalRefund;           // Total size of refund

  // Voting variables
  ERC20 public icoCoin;              // Voting power is based on token ownership count
  mapping (address => uint) public userTokenBalance; // user -> token balance
  uint public userCount;             // Used for keeping track of quorum
  uint public totalTokenCount;       // Count of all tokens registered for vote
  uint public totalVotePower;        // Total voting power of users
  mapping (address => mapping (uint => bool)) public voteChoice;
  uint public yesVotes;
  uint public noVotes;
  int public quadraticYesVotes;
  int public quadraticNoVotes;

  // =========
  // Blah
  // =========

  // todo fix this fn
  // Return (start time, end time) of this or upcoming round
  function getThisOrUpcomingRoundStartEnd () returns (uint, uint) {
    return (currentRoundStartTime, currentRoundStartTime.safeAdd(roundDuration));
  }

  function getVoteChoice(address user, uint _roundNum) view returns (bool) { return voteChoice[user][_roundNum]; }

  function getHasVoted(address user, uint _roundNum) view returns (bool) { return voteChoice[user][_roundNum] != 0; }

  // ======================
  // Constructor & fallback
  // ======================

  constructor() public Ownable() {}

  function () public { require(false); return; }

  // Always last a week
  function setNextRound(uint newStartTime) inState(State.NextRoundApproved) onlyOwner {
    uint lastStart;
    uint lastEnd;
    (lastStart, lastEnd) = getThisOrUpcomingRoundStartEnd();

    // They can only do this once
    require(lastEnd < now);

    // Greater than now, less than two weeks out
    require(newStartTime > now);
    require(newStartTime < (now.safeAdd(roundDuration)));
    currentRoundStartTime = newStartTime;
  }

  function if_haventCalledNewRoundFor6Months_then_refund() public inState(State.NextRoundApproved) {
    uint start;
    uint end;
    (start, end) = getThisOrUpcomingRoundStartEnd();
    uint timeLimit = end.safeAdd(maxTimeBetweenRounds);

    require(timeLimit > now);
    require(currentRoundNumber > 0);

    // todo call refund
  }

  // =============
  // ICO Functions
  // =============

  // This is used b/c order of creating contracts:
  //    1 tokenPollAddr = TokenPoll() 
  //    2 escrowAddr    = Escrow(tokenPollAddr)
  //    3                 TokenPoll.initialize(escrowAddress)
  function initialize(address _icoToken, address _stableCoin, address _escrow, uint _allocStartTime, uint _allocEndTime, uint _dailyLimit) public inState(State.Uninitialized) onlyOwner {
    require(_allocStartTime > now);

    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;

    initializedFlag = true;
    nextRoundApprovedFlag = true;

    icoCoin = ERC20(_icoToken);
    stableCoin = ERC20(_stableCoin);
    escrow = _escrow;
  }

  // ===============
  // Voter Functions
  // ===============

  // Users
  function allocVotes() public inState(State.VoteAllocation){
    require(userTokenBalance[msg.sender] == 0);  // user has not allocated before

    uint userTokens = icoCoin.balanceOf(msg.sender);

    // State changes
    userTokenBalance[msg.sender] = userTokens;
    totalVotePower  = totalVotePower.safeAdd(getUserVotePower(msg.sender));
    totalTokenCount = totalTokenCount.safeAdd(userTokens);
    userCount       = userCount.safeAdd(1);
  }
  
  // todo, make sure it is impossible to postpone a next round indefinetly
  // todo vote window, vote params (qorem),
  function castVote(bool vote) public inState(State.InRound) validVoter() {
    require(!getHasVoted(msg.sender, currentRoundNumber));

    voteChoice[msg.sender][currentRoundNumber] = vote;

    if (vote) {
      yesVotes = yesVotes.safeAdd(1);
      quadraticYesVotes = quadraticYesVotes.safeAdd(getUserVotePower(msg.sender));
    }
    else {
      noVotes = noVotes.safeAdd(1);
      quadraticNoVotes = quadraticNoVotes.safeAdd(getUserVotePower(msg.sender));
    }

    Vote(msg.sender, vote);
  }

  function trasitionFromState_NextRoundApproved () public inState(State.NextRoundApproved) {
    uint start;
    uint end;

    (start, end) = getThisOrUpcomingRoundStartEnd();

    require(start < now < end);
    clearVoteTransition();
  }


  // todo - at what point can they start withdrawing?
  // todo - keep or add wallet?
  function transitionFromState_PostRoundDecision () public inState(State.PostRoundDecision) {
    bool notEnoughVotes = quadraticYesVotes < quadraticNoVotes;

    if (notEnoughVotes) {
      // address erc20 = address(Escrow(escrow).erc20);
      // totalRefund = ERC20(erc20).balanceOf(escrow);
      totalRefund = stableCoin.balanceOf(escrow);
      // escrowChangeDailyLimit(totalRefund);
      escrowTransferTokens(address(this), totalRefund);
      refundFlag = true;
    }
    else {
      uint remainingRounds = numberOfRounds.safeSub(currentRoundNumber).safeSub(1);
      approvedFunds = stableCoin.balanceOf(escrow).safeDiv(remainingRounds);
      setVoteTransition();
      currentRoundNumber = currentRoundNumber.safeAdd(1);
      quadraticYesVotes = 0;
      quadraticNoVotes = 0;
      noVotes = 0;
      yesVotes = 0;
      escrowTransferTokens(getOwner(), approvedFunds);
    }
  }

  function userRefund() public inState(State.Refund) {
    address user = msg.sender;
    uint userTokenCount = userTokenBalance[user];

    // Get tokens then clear. Reentrant safe
    require(userTokenCount != 0);
    userTokenBalance[user] = 0;

    // refund
    uint refundSize = totalRefund.safeMul(userTokenCount).safeDiv(totalTokenCount);
    ERC20(address(Escrow(escrow).erc20)).transfer(user, refundSize); // todo is there a better way
  }

  // todo must check if transaction failed or not
  // Call through escrow -- "erc20.transfer(to, amount)"
  function escrowTransferTokens(address _to, uint _amount) private {
    bytes memory data = new bytes(4 + 20 + 32);
    uint i = 0;
    for (; i < 4; i++)  data[i] = bytes4(0x06b091f9)[i];
    for (; i < 24; i++) data[i] = bytes20(_to)[i];
    for (; i < 56; i++) data[i] = bytes32(_amount)[i];

    // change daily limit
    Escrow(escrow).submitTransaction(escrow, 0, data);    
  }

  // =======
  // Getters
  // =======

  function getState() public view returns (State) {
    uint roundStart;
    uint roundEnd;
    (roundStart, roundEnd) = getThisOrUpcomingRoundStartEnd();

    if (!initializedFlag)      return State.Uninitialized;
    if (refundFlag)            return State.Refund;
    if (currentRoundNumber
        > numberOfRounds)      return State.Finished;
    if (now < allocStartTime)  return State.Initialized;
    if (allocStartTime < now 
        && now < allocEndTime) return State.VoteAllocation;
    if (nextRoundApprovedFlag) return State.NextRoundApproved;
    if (roundStart < now
        && now < roundEnd)     return State.InRound;
    if (now > roundEnd)        return State.PostRoundDecision;

    return State.UnknownState;
  }

  function getUserVotePower(address user) public view returns (uint) {
    return sqrt(userTokenBalance[user]);
  }

  // y = floor(sqrt(x))
  function sqrt(uint x) public pure returns (uint) {
    uint z = x.safeAdd(1).safeDiv(2);
    uint y = x;
    
    while (z < y) {
      y = z;
      z = x.safeDiv(z).safeAdd(z).safeDiv(2);
    }
    
    return y;
  }

  function clearVoteTransition () private { nextRoundApprovedFlag = false; }

  function setVoteTransition () private { nextRoundApprovedFlag = true; }
  
  // ================
  // Modifiers
  // ================

  // modifier onlyOwner() ...

  modifier inState(State s) {
    require(getState() == s);
    _;
  }

  modifier fromAddress(address _escrow) {
    require(escrow == _escrow);
    _;
  }

  modifier validVoter() {
    require(userTokenBalance[msg.sender] != 0);
    _;
  }
}

/*
  // Call through escrow -- "erc20.transfer(to, amount)"
  function escrowChangeDailyLimit(uint newLimit) private {
    bytes memory data = new bytes(4 + 32);
    uint i = 0;
    for (; i < 4; i++)  data[i] = bytes4(0xcea08621)[i];
    for (; i < 36; i++) data[i] = bytes32(newLimit)[i];

    // change daily limit
    Escrow(escrow).submitTransaction(escrow, 0, data);    
  }

 */
