pragma solidity ^0.4.15;

import "./Ownable.sol";
import "./ERC20.sol";
import "./SafeMath.sol";

/**
@title TokenPoll
@author Nick Geoca
*/

contract Escrow {
  function submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId);
}

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
  event Transfer(address indexed from, address indexed to, uint indexed quantity);

  // =====
  // State
  // =====

  // State variables
  bool public refundFlag;            // keep track of state
  bool public nextRoundApprovedFlag; // "
  bool public uninitializedFlag;     // if contract is un-initialized

  // Round variables
  uint public constant allocationDuration = 1 seconds;
  uint public constant maxTimeBetweenRounds = 180 days;
  uint public constant roundDuration = 7 minutes;

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

  constructor (address _stableCoin) public Ownable() {
    stableCoin = ERC20(_stableCoin);
    uninitializedFlag = true;
  }

  function () public { require(false); return; }

  // =============
  // ICO Functions
  // =============

  function getOwner() public view returns (address) { return _getOwner(); }

  /**
     @notice Change owner of token poll
     @param _newOwner New owner of token poll
  */
  function transferOwnership(address _newOwner) public { _transferOwnership(_newOwner); } 

  // This is used b/c order of creating contracts:
  //    1 tokenPollAddr = TokenPoll() 
  //    2 escrowAddr    = Escrow(tokenPollAddr)
  //    3                 TokenPoll.initialize(escrowAddress)

  /// @notice Initialize the token poll. This also sets the voter allocation time period.
  /// @dev Start allocation one week from now- initialize(0x123.., 0x321, 0x222, current unix time (seconds) + 1 week);
  /// @param _icoToken The ICO's ERC20 token. Get the voters from this contract
  /// @param _escrow The escrow address. This is a multisig wallet address
  /// @param _allocStartTime Start of allocation period. Typically a week. Unix time stamp in seconds.
  function initialize(address _icoToken, address _escrow, uint _allocStartTime) public inState(State.Uninitialized) onlyOwner {
    // require(_allocStartTime > now);

    // todo, look more at error checking. Like time limit on allocation start

    allocStartTime = _allocStartTime;
    allocEndTime = _allocStartTime + allocationDuration;

    uninitializedFlag = false;
    nextRoundApprovedFlag = true;

    icoCoin = ERC20(_icoToken);
    escrow = _escrow;
    currentRoundNumber = 2;
    votingRoundNumber = 1;
    currentRoundStartTime = allocEndTime.safeAdd(maxTimeBetweenRounds);  // todo reaccess if this is a good idea
  }

  /// @notice Sets up the next round to vote on approving ICO funding. Must be in state NextRoundApproved
  /// @dev start one week from now with one unit of erc20 funding - setupNextRound(now + 1 week, 1 * 10**stableCoin.decimals());
  /// @param _startTime Start of the voting period. Typically a week before closed. Unix time stamp in seconds. After this time, startRound must be called to start the round.
  /// @param _fundSize Amount of funding attempting to release. This is a big number to web3. There are typically decimal places in ERC20 tokens too.
  function setupNextRound(uint _startTime, uint _fundSize) public inState(State.NextRoundApproved) onlyOwner {
    require(_startTime <= (now.safeAdd(maxTimeBetweenRounds)));
    // require(_startTime >= now);
    require(stableCoin.balanceOf(escrow) >= _fundSize);
    emit NewRoundInfo(currentRoundNumber, votingRoundNumber, _startTime, _startTime.safeAdd(roundDuration), _fundSize);
    currentRoundStartTime = _startTime;
    currentRoundFundSize = _fundSize;
  }

  /// @notice Starts the round. Must be manually called to start the round. (called after round _startTime. see setupNextRound).
  function startRound() public { transitionFromState_NextRoundApproved(); }

  /// @notice After round is over, this tallies votes and either refunds users or funds the ICO.
  function approveNewRound() public {  transitionFromState_PostRoundDecision(); }

  // ===============
  // Voter Functions
  // ===============

  /// @notice Each user calls this to allocate their votes. Must be in allocation time-period/state (see initialize)
  function allocVotes() public { // {inState(State.VoteAllocation) {
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

  /// @notice Each user calls this to vote on ICO funding or get a refund. Must be in InRound state (see setupNextRound)
  /// @param _vote Vote true to fund the ICO. False to get a refund.
  function castVote(bool _vote) public inState(State.InRound) validVoter() {
    require(!getHasVoted(msg.sender, currentRoundNumber, votingRoundNumber));

    hasVoted[msg.sender][currentRoundNumber][votingRoundNumber] = true;

    if (_vote) {
      yesVotes = yesVotes.safeAdd(1);
      quadraticYesVotes = quadraticYesVotes.safeAdd(getUserVotePower(msg.sender));
    }
    else {
      noVotes = noVotes.safeAdd(1);
      quadraticNoVotes = quadraticNoVotes.safeAdd(getUserVotePower(msg.sender));
    }

    emit Vote(msg.sender, currentRoundNumber, votingRoundNumber, _vote);
  }

  /// @notice Each user calls this to get a refund. This happens after users successfully voted to refund. Must be in Refund state.
  function userRefund() public inState(State.Refund) {
    require(userTokenBalance[msg.sender] != 0);
    address user = msg.sender;
    uint userTokenCount = userTokenBalance[user];
    uint refundSize = totalRefund.safeMul(userTokenCount) / totalTokenCount;

    userTokenBalance[user] = 0;
    require(stableCoin.transfer(user, refundSize));
    address from = address(this);
    emit Transfer(from, user, refundSize);
  }

  /// @notice This starts the refund after a refund was voted for. It only needs to be called once, then the refund starts. Must be in PostRoundDecision state.
  function startRefund_voteFailed() public { transitionFromState_PostRoundDecision(); }

  /// @notice This starts the refund if there was no funding for too long a time. It only needs to be called once to be put in refund state. Must be in NextRoundApproved state. 
  function startRefund_illegalRoundDelay() public {  if_haventCalledNewRoundSoonEnough_then_refund(); }

  // =======
  // Getters
  // =======

  /// @notice Gets user's refund size. Assumes they were not refunded yet
  function getUserRefundSize (address user) public inState(State.Refund) view returns (uint) { return totalRefund.safeMul(userTokenBalance[user]) / totalTokenCount; }

  /// @notice Gets the current round start time
  function getRoundStartTime () public view returns (uint) { return currentRoundStartTime; }

  /// @notice Gets the current round end time
  function getRoundEndTime() public view returns (uint) { return currentRoundStartTime.safeAdd(roundDuration); }

  /// @notice Gets if the user has voted, for given funding-round and voting-round number
  function getHasVoted(address user, uint _fundingRoundNum, uint _votingRoundNum) public view returns (bool) { return hasVoted[user][_fundingRoundNum][_votingRoundNum]; }

  /// @notice Gets the current state 
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

  /// @notice Gets user vote power. Based on square root of vote allocation
  function getUserVotePower(address user) public view returns (uint) { return sqrt(userTokenBalance[user]); }

  /// @notice y = floor(sqrt(x))
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
    uint timeLimit = end.safeAdd(maxTimeBetweenRounds);

    require(timeLimit > now);
    nextRoundApprovedFlag = false;
    putInRefundState();
  }

  // Call through escrow -- "erc20.transfer(to, amount)"
  function escrowTransferTokens(address _to, uint _amount) private {
    bytes memory data = new bytes(4 + 32 + 32);
    uint i;

    // Clear memory
    for (i = 0; i < (4+32+32); i++) data[i] = byte(0);
    
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
    emit RoundResult( currentRoundNumber
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
