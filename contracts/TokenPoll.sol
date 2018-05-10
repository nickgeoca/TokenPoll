pragma solidity ^0.4.15;

import "./Ownable.sol";
import "./ERC20.sol";


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

  event Vote(address indexed voter, bool vote);

  // =====
  // State
  // =====  

  mapping (address => uint) public userTokenBalance; // user -> token balance

  bool refundFlag;                   // keep track of state
  bool voteFailedFlag;               // "
  bool initialized;                  // if contract is initialized with parameters

  ERC20 public icoCoin;              // Voting power is based on token ownership count
  ERC20 public stableCoin;           // 

  uint public totalRefund;           // Total size of refund

  address public escrow;             // Initiate escrow to send funds to ICO wallet

  uint public allocStartTime;        // Start/end of voting allocation
  uint public allocEndTime;          // "

  uint public userCount;             // Used for keeping track of quorum
  uint public totalTokenCount;       // Count of all tokens registered for vote
  uint public totalVotePower;        // Total voting power of users

  mapping (address => uint) public hasVoted;
  // mapping (address => uint) public voteStance;

  uint public yesVotes;              // 
  uint public noVotes;               // 

  // ======================
  // Constructor & fallback
  // ======================

  constructor() public Ownable() {}

  function () public { require(false); return; }

  // =============
  // ICO Functions
  // =============

  // This is used b/c order of creating contracts:
  //    1 tokenPollAddr = TokenPoll() 
  //    2 escrowAddr    = Escrow(tokenPollAddr)
  //    3                 TokenPoll.initialize(escrowAddress)
  function initialize(address _icoToken, address _stableCoin, address _escrow, uint _allocStartTime, uint _allocEndTime, uint _dailyLimit) public inState(State.Uninitialized) onlyOwner {
    require(_allocStartTime > now);

    initialized = true;
    icoCoin = ERC20(_icoToken);
    stableCoin = ERC20(_stableCoin);
    allocStartTime = _allocStartTime;
    allocEndTime = _allocEndTime;
    escrow = _escrow;
    escrowChangeDailyLimit(_dailyLimit);
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
    totalVotePower  += getUserVotePower(msg.sender);
    totalTokenCount += userTokens;
    userCount       += 1;
  }

  // todo vote window, vote params (qorem),
  function castVote(bool vote) public {
    bool userNotVoted = ((hasVoted[msg.sender] >> 0) & 1) == 0;

    require(userNotVoted);

    hasVoted[msg.sender]   |= 1 << 0;
    // voteStance[msg.sender] |= (vote ? 1 : 0) << 0;

    if (vote)
      yesVotes += 1;
    else
      noVotes += 1;

    Vote(msg.sender, vote);
  }

  function userRefund() public inState(State.Refunding) {
    address user = msg.sender;
    uint userTokenCount = userTokenBalance[user];

    // Get tokens then clear. Reentrant safe
    require(userTokenCount != 0);
    userTokenBalance[user] = 0;

    // refund
    uint refundSize = totalRefund * userTokenCount / totalTokenCount;
    ERC20(address(Escrow(escrow).erc20)).transfer(user, refundSize); // todo is there a better way
  }

  // todo - at what point can they start withdrawing?
  // todo - keep or add wallet?

  function startRefund() public inState(State.VoteFailed) {
    address erc20 = address(Escrow(escrow).erc20);
    totalRefund = ERC20(erc20).balanceOf(escrow);
    escrowChangeDailyLimit(totalRefund);
    escrowTransferTokens(address(this), totalRefund);
    refundFlag = true;
  }

  // Call through escrow -- "erc20.transfer(to, amount)"
  function escrowChangeDailyLimit(uint newLimit) private {
    bytes memory data = new bytes(4 + 32);
    uint i = 0;
    for (; i < 4; i++)  data[i] = bytes4(0xcea08621)[i];
    for (; i < 36; i++) data[i] = bytes32(newLimit)[i];

    // change daily limit
    Escrow(escrow).submitTransaction(escrow, 0, data);    
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

  // modifier onlyOwner() ...

  modifier inState(State s) {
    require(getState() == s);
    _;
  }

  modifier fromAddress(address _escrow) {
    require(escrow == _escrow);
    _;
  }

}
