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

  event RoundResult(uint round, bool approvedFunding, uint weightedYesVotes, uint weightedNoVotes, uint yetVoters, uint noVoters);

  event NewRoundInfo(uint round, uint startTime, uint endTime);

  // =====
  // State
  // =====

  // State variables
  bool refundFlag;                   // keep track of state
  bool nextRoundApprovedFlag;        // "
  bool uninitializedFlag;            // if contract is un-initialized

  // Round variables
  uint public constant maxTimeBetweenRounds = 180 days;
  uint public constant roundDuration = 5 minutes;
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
  mapping (address => mapping (uint => bool)) public hasVoted;
  uint public yesVotes;
  uint public noVotes;
  uint public quadraticYesVotes;
  uint public quadraticNoVotes;

  // ======================
  // Constructor & fallback
  // ======================

  function TokenPoll () public Ownable() {
    uninitializedFlag = true;
  }

  function () public { require(false); return; }

  // =============
  // ICO Functions
  // =============

  function getOwner() public view returns (address) { return _getOwner(); }

  function transferOwnership(address newOwner) public { _transferOwnership(newOwner); } 

  // This is used b/c order of creating contracts:
  //    1 tokenPollAddr = TokenPoll() 
  //    2 escrowAddr    = Escrow(tokenPollAddr)
  //    3                 TokenPoll.initialize(escrowAddress)
  function initialize(address _icoToken, address _stableCoin, address _escrow, uint _allocStartTime, uint _allocEndTime) public inState(State.Uninitialized) onlyOwner {
    require(_allocStartTime > now);

    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;

    uninitializedFlag = false;
    nextRoundApprovedFlag = true;

    icoCoin = ERC20(_icoToken);
    stableCoin = ERC20(_stableCoin);
    escrow = _escrow;
  }

  function setupNextRound(uint newStartTime) inState(State.NextRoundApproved) onlyOwner {
    uint lastEnd   = getRoundEndTime();
    
    require(lastEnd < now);                                // They can only do this once
    require(newStartTime > now);
    // require(newStartTime < (now.safeAdd(roundDuration)));  // 

    NewRoundInfo(currentRoundNumber, newStartTime, newStartTime.safeAdd(roundDuration));

    currentRoundStartTime = newStartTime;
  }

  // must be inState(State.NextRoundApproved)
  function startRound() public { transitionFromState_NextRoundApproved(); }

  // must be inState(State.PostRoundDecision)
  function approveNewRound() public {  transitionFromState_PostRoundDecision(); }

  // ===============
  // Voter Functions
  // ===============

  // Users
  function allocVotes() public inState(State.VoteAllocation) {
    bool notYetAllocated = userTokenBalance[msg.sender] == 0;
    uint userTokens = icoCoin.balanceOf(msg.sender);

    // require(notYetAllocated);   // Alloc only once
    // require(userTokens != 0);   // User has tokens

    // State changes
    userTokenBalance[msg.sender] = userTokens;
    totalVotePower  = totalVotePower.safeAdd(getUserVotePower(msg.sender));
    totalTokenCount = totalTokenCount.safeAdd(userTokens);
    userCount       = userCount.safeAdd(1);
  }

  function castVote(bool vote) public inState(State.InRound) validVoter() {
    require(!getHasVoted(msg.sender, currentRoundNumber));

    hasVoted[msg.sender][currentRoundNumber] = true;
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

  function userRefund() public inState(State.Refund) {
    require(userTokenBalance[msg.sender] != 0);
    address user = msg.sender;
    uint userTokenCount = userTokenBalance[user];
    uint refundSize = totalRefund.safeMul(userTokenCount).safeDiv(totalTokenCount);

    userTokenBalance[user] = 0;
    stableCoin.transfer(user, refundSize);
  }

  // must be inState(State.NextRoundApproved)
  function startRefund_voteFailed() public { transitionFromState_PostRoundDecision(); }

  // must be inState(State.NextRoundApproved) 
  function startRefund_illegalRoundDelay() public {  if_haventCalledNewRoundSoonEnough_then_refund(); }

  // =======
  // Getters
  // =======

  function getRoundStartTime () returns (uint) { return currentRoundStartTime; }

  function getRoundEndTime() returns (uint) { return currentRoundStartTime.safeAdd(roundDuration); }

  function getVoteChoice(address user, uint _roundNum) view returns (bool) { return voteChoice[user][_roundNum]; }

  function getHasVoted(address user, uint _roundNum) view returns (bool) { return hasVoted[user][_roundNum]; }

  function getState() public view returns (State) {
    uint roundStart = getRoundStartTime();
    uint roundEnd   = getRoundEndTime();

    if (uninitializedFlag)     return State.Uninitialized;
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

  function getUserVotePower(address user) public view returns (uint) { return sqrt(userTokenBalance[user]); }

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

  // ================
  // Private fns
  // ================

  function if_haventCalledNewRoundSoonEnough_then_refund() private inState(State.NextRoundApproved) {
    uint end   = getRoundEndTime();
    uint timeLimit;
    bool isRoundZero = currentRoundNumber == 0;

    if (isRoundZero) 
      timeLimit = allocEndTime.safeAdd(maxTimeBetweenRounds);
    else 
      timeLimit = end.safeAdd(maxTimeBetweenRounds);

    require(timeLimit > now);
    nextRoundApprovedFlag = false;
    putInRefundState();
  }

  // Call through escrow -- "erc20.transfer(to, amount)"
  function escrowTransferTokens(address _to, uint _amount) private {
    bytes memory data = new bytes(4 + 20 + 32);
    uint i = 0;
    for (; i < 4; i++)  data[i] = bytes4(0x06b091f9)[i];
    for (; i < 24; i++) data[i] = bytes20(_to)[i];
    for (; i < 56; i++) data[i] = bytes32(_amount)[i];

    Escrow(escrow).submitTransaction(escrow, 0, data);    
  }

  function putInRefundState() private {
    // address erc20 = address(Escrow(escrow).erc20);
    // totalRefund = ERC20(erc20).balanceOf(escrow);
    totalRefund = stableCoin.balanceOf(escrow);
    // escrowChangeDailyLimit(totalRefund);
    escrowTransferTokens(address(this), totalRefund);
    refundFlag = true;
  }

  function transitionFromState_NextRoundApproved () private inState(State.NextRoundApproved) {
    uint start = getRoundStartTime();
    uint end   = getRoundEndTime();

    require(start < now && now < end);
    nextRoundApprovedFlag = false;
  }

  // Sends funds to owner if approved
  // todo, vote params (qorem),
  function transitionFromState_PostRoundDecision () private inState(State.PostRoundDecision) {
    bool notEnoughVotes = quadraticYesVotes < quadraticNoVotes;
    uint remainingRounds = numberOfRounds.safeSub(currentRoundNumber).safeSub(1);
    uint approvedFunds = stableCoin.balanceOf(escrow).safeDiv(remainingRounds);

    RoundResult(currentRoundNumber, !notEnoughVotes, quadraticYesVotes, quadraticNoVotes, yesVotes, noVotes);

    // Check if needs a refund
    if (notEnoughVotes) {
      putInRefundState();
      return;
    }

    // Update state and send funds over
    nextRoundApprovedFlag = true;
    currentRoundNumber = currentRoundNumber.safeAdd(1);
    quadraticYesVotes = 0;
    quadraticNoVotes = 0;
    noVotes = 0;
    yesVotes = 0;
    escrowTransferTokens(getOwner(), approvedFunds);
  }

  // ================
  // Modifiers
  // ================

  // modifier onlyOwner() ...

  modifier inState(State s) {
    require(getState() == s);
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
