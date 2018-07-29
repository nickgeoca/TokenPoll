pragma solidity ^0.4.15;

import "./../lib/Ownable.sol";
import "./../lib/ERC20.sol";
import "./../lib/SafeMath.sol";

contract Escrow {
  function submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId);
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

             // End state
             , Refund            // Users can withdraw remaining balance

             , UnknownState
             }

  event Vote(address indexed voter, uint indexed round, uint indexed votingRoundNumber, bool vote);
  event RoundResult(uint indexed round, uint indexed votingRoundNumber, bool approvedFunding, uint weightedYesVotes, uint weightedNoVotes, uint yesVoters, uint noVoters, uint fundSize);
  event NewRoundInfo(uint indexed round, uint indexed votingRoundNumber, uint startTime, uint endTime, uint fundSize);

  // =====
  // State
  // =====

    // State variables
  bool public refundFlag;            // keep track of state
  bool public nextRoundApprovedFlag; // "
  bool public uninitializedFlag;     // if contract is un-initialized

  // Round variables
  uint public constant allocationDuration = 2 minutes;
  uint public constant maxTimeBetweenRounds = 180 days;
  uint public constant roundDuration = 5 minutes;

  uint public currentRoundFundSize;
  uint public currentRoundNumber;
  uint public votingRoundNumber;

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
  mapping (address =>                // Address ->
           mapping (uint =>          // RoundNumber ->
                    mapping (uint => // StrikeNumber ->
                             bool))) public hasVoted;
  uint public yesVotes;          
  uint public noVotes;           
  uint public quadraticYesVotes; 
  uint public quadraticNoVotes;  

  // ======================
  // Constructor & fallback
  // ======================

  function TokenPoll (address _escrow) public Ownable() {
    escrow = _escrow;
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
  function initialize(address _icoToken, address _stableCoin, uint _allocStartTime) public inState(State.Uninitialized) onlyOwner {
    require(_allocStartTime > now);
    // todo, look more at error checking

    allocStartTime = _allocStartTime;
    allocEndTime = _allocStartTime.safeAdd(allocationDuration);

    uninitializedFlag = false;
    nextRoundApprovedFlag = true;

    icoCoin = ERC20(_icoToken);
    stableCoin = ERC20(_stableCoin);
    currentRoundNumber = 1;
    votingRoundNumber = 1;
  }

  function setupNextRound(uint startTime, uint fundSize) inState(State.NextRoundApproved) onlyOwner {
    require(startTime <= (now.safeAdd(maxTimeBetweenRounds)));
    require(startTime >= now);
    require(stableCoin.balanceOf(escrow) > fundSize);
    NewRoundInfo(currentRoundNumber, votingRoundNumber, startTime, startTime.safeAdd(roundDuration), fundSize);
    currentRoundStartTime = startTime;
    currentRoundFundSize = fundSize;
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

    require(notYetAllocated);   // Alloc only once
    require(userTokens != 0);   // User has tokens

    // State changes
    userTokenBalance[msg.sender] = userTokens;
    totalVotePower  = totalVotePower.safeAdd(getUserVotePower(msg.sender));
    totalTokenCount = totalTokenCount.safeAdd(userTokens);
    userCount       = userCount.safeAdd(1);
  }

  function castVote(bool vote) public inState(State.InRound) validVoter() {
    require(!getHasVoted(msg.sender, currentRoundNumber, votingRoundNumber));

    hasVoted[msg.sender][currentRoundNumber][votingRoundNumber] = true;

    if (vote) {
      yesVotes = yesVotes.safeAdd(1);
      quadraticYesVotes = quadraticYesVotes.safeAdd(getUserVotePower(msg.sender));
    }
    else {
      noVotes = noVotes.safeAdd(1);
      quadraticNoVotes = quadraticNoVotes.safeAdd(getUserVotePower(msg.sender));
    }

    Vote(msg.sender, currentRoundNumber, votingRoundNumber, vote);
  }

  function userRefund() public inState(State.Refund) {
    require(userTokenBalance[msg.sender] != 0);
    address user = msg.sender;
    uint userTokenCount = userTokenBalance[user];
    uint refundSize = totalRefund.safeMul(userTokenCount) / totalTokenCount;

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

  function getRoundStartTime () view returns (uint) { return currentRoundStartTime; }

  function getRoundEndTime() view returns (uint) { return currentRoundStartTime.safeAdd(roundDuration); }

  // todo change to funding round, strike round
  function getHasVoted(address user, uint _fundingRoundNum, uint _votingRoundNum) view returns (bool) { return hasVoted[user][_fundingRoundNum][_votingRoundNum]; }

  function getState() public view returns (State) {
    uint roundStart = getRoundStartTime();
    uint roundEnd   = getRoundEndTime();

    if (uninitializedFlag)     return State.Uninitialized;
    if (refundFlag)            return State.Refund;
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
  function sqrt(uint256 x) public pure returns (uint) {
    uint z = x.safeAdd(1) / 2;
    uint y = x;
    
    while (z < y) {
      y = z;
      z = (x / z + z) / 2;
    }
    
    return y;
  }

  // ================
  // Private fns
  // ================

  function if_haventCalledNewRoundSoonEnough_then_refund() private inState(State.NextRoundApproved) {
    uint end   = getRoundEndTime();
    uint timeLimit;
    bool isRoundOne = currentRoundNumber == 1;

    if (isRoundOne) 
      timeLimit = allocEndTime.safeAdd(maxTimeBetweenRounds);
    else 
      timeLimit = end.safeAdd(maxTimeBetweenRounds);

    require(timeLimit > now);
    nextRoundApprovedFlag = false;
    putInRefundState();
  }

  // Call through escrow -- "erc20.transfer(to, amount)"
  function escrowTransferTokens(address _to, uint _amount) private {
    bytes memory data = new bytes(4 + 32 + 32);
    uint i;

    // Clear memory
    for (i = 0; i < (4+32+32); i++) data[i] = 0;
    
    // Write to data for wallet - erc20.transfer(to, amount);
    for (i = 0   ; i < 4        ; i++) data[i] = bytes4(0xa9059cbb)[i];
    for (i = 4+12; i < (4+32)   ; i++) data[i] = bytes20(_to)[i - (4+12)];
    for (i = 4+32; i < (4+32+32); i++) data[i] = bytes32(_amount)[i - (4+32)];

    Escrow(escrow).submitTransaction(stableCoin, 0, data);
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
    bool enoughVotes = quadraticYesVotes >= quadraticNoVotes;
    bool threeStrikes = 3 == votingRoundNumber;

    if (threeStrikes) {
      putInRefundState();
    }
    else if (enoughVotes) {
      escrowTransferTokens(getOwner(), currentRoundFundSize);
    }

    // State changes
    RoundResult( currentRoundNumber
               , votingRoundNumber
               , enoughVotes
               , quadraticYesVotes, quadraticNoVotes, yesVotes, noVotes
               , currentRoundFundSize
               );

    if (enoughVotes) {
      votingRoundNumber = 1;
      currentRoundNumber = currentRoundNumber.safeAdd(1);
    }
    else {
      votingRoundNumber = votingRoundNumber.safeAdd(1);
    }

    nextRoundApprovedFlag = true;
    quadraticYesVotes = 0;
    quadraticNoVotes = 0;
    yesVotes = 0;
    noVotes = 0;
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


/*
    function delayedPayment(
        address _scheduler,
        uint    _numBlocks,
        address _recipient
    )  public payable {
        scheduler = SchedulerInterface(_scheduler);
        lockedUntil = block.number + _numBlocks;
        recipient = _recipient;

        scheduledTransaction = scheduler.schedule.value(0.1 ETHER)( // 0.1 ether is to pay for gas, bounty and fee
            this,                   // send to self
            "",                     // and trigger fallback function
            [ 200000             // The amount of gas to be sent with the transaction.
            , 0                  // The amount of wei to be sent.
            , 255                // The size of the execution window.
            , lockedUntil        // The start of the execution window.
            , 20000000000 wei    // The gasprice for the transaction (aka 30 gwei)
            , 20000000000 wei    // The fee included in the transaction.
            , 20000000000 wei    // The bounty that awards the executor of the transaction.
            , 30000000000 wei    // The required amount of wei the claimer must send as deposit.
            ]
        );
    }
*/
