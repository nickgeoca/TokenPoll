pragma solidity ^0.4.15;

import "./ERC20.sol";

// todo change initalizier to owner
// todo safe math

contract Escrow {
  function submitTransaction(address,uint256,bytes) public;
}

contract EscrowERC20WithdrawDailyLimitInterface {
  struct WithdrawT {
    uint dailyLimit;    // User cap
    uint dayLastSpent;  // Last day withdrew from
    uint remainingVar;  // Remaining balance from last withdraw date. Use calcMaxWithdraw()
  }
  
  function calcMaxWithdraw() public constant returns (uint);
  function withdrawTokens(address erc20, address escrow, address to, uint amount) internal;
  function changeEscrowDailyLimit(uint _newLim) internal;
}

contract EscrowERC20WithdrawDailyLimit is EscrowERC20WithdrawDailyLimitInterface {
  // =====
  // State
  // =====

  WithdarwT private withdraw;
  
  // ======
  // Public
  // ======
  function calcMaxWithdraw() public constant returns (uint) {
    uint today = now / 24 hours;

    // If new day, return updated dailyLimit
    if (today > withdraw.dayLastSpent)
      return withdraw.dailyLimit;

    return withdraw.remainingVar;
  }

  // todo. at what point can they start withdrawing?
  // todo keep or add wallet?
  function withdrawTokens(address erc20, address escrow, address to, uint amount) internal {
    updateWithdrawData();
    limit = calcMaxWithdraw();
    require(limit >= amount);

    escrowSendERC20(erc20, escrow, to, amount);
  }

  function changeEscrowDailyLimit(uint _newLim) internal {
    updateWithdrawData();
    uint alreadySpent = withdraw.dailyLimit - calcMaxWithdraw();

    if (alreadySpent > _newLim)
      withdraw.remainingVar = 0;
    else
      withdraw.remainingVar = _newLim - alreadySpent;

    withdraw.dailyLimit = _newLim; 
  }

  // ======
  // Private
  // ======
  function updateWithdrawData() private {
    uint today = now / 24 hours;

    if (today > withdraw.dayLastSpent) {
      withdraw.dayLastSpent = today;
      withdraw.remainingVar = withdraw.dailyLimit;
    }
  }

  function escrowSendERC20 (address erc20, address escrow, address user, uint value) private {
    ERC20(erc20).transfer(user, refundSize);
    bytes4 memory fnSig = bytes4(a9059cbb);   // transfer(address,uint256)
    bytes32 memory newLimit = bytes32(uintNewLimit);
    bytes memory data = new bytes(36);
    
    // Set function signature and new daily limit params
    for (uint i = 0; i < 4; i++)  data[i] = fnSig[i];
    for (uint i = 4; i < 36; i++) data[i] = newLimit[i];
    
    // Call fn through escrow
    Escrow(escrow).submitTransaction(erc20, 0, data);
  }
}

// Voting is quadratic
contract TokenPoll is EscrowERC20WithdrawDailyLimit {

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

  
  // ERC20 Withdraw stuff
  function calcMaxWithdraw() public constant returns (uint);
  function withdrawTokens(address erc20, address escrow, address to, uint amount) internal;
  function changeEscrowDailyLimit(uint _newLim) internal;

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

  function withdraw(address to, uint value) public isController() { withdrawToekns(stableCoin, escrow, to, value); }

  // todo
  // function changeEscrowDailyLimit(uint _newLim) internal;

  // todo vote window, vote params (qorem),
  function castVote(bool vote) {
    require(voted[msg.sender] == false);

    voted[msg.sender] = true;

    if (voteFor)
      yesVotes += 1;
    else
      noVotes += 1;
  }

  function startRefund() public payable inState(State.VoteFailed) fromAddress(escrow) {
    changeEscrowDailyLimit(0);
    totalRefund = stableCoin.balanceOf(escrow);
    refundFlag = true;
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
