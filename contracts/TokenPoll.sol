pragma solidity >=0.4.15;

import "./Ownable.sol";
import "./ERC20.sol";
import "./SafeMath.sol";


/**
@title TokenPoll
@author Nick Geoca
*/

contract MSW {
  function submitTransaction(address destination, uint value, bytes memory data) public returns (uint transactionId);
}

contract ReentrancyGuard {
  bool private rentrancy_lock = false;

  modifier nonReentrant() {
    require(!rentrancy_lock);
    rentrancy_lock = true;
    _;
    rentrancy_lock = false;
  }
}

contract MSW_Util {
  // Call through msw -- "erc20.transfer(to, amount)"
  function msw_erc20Transfer(address _msw, address _erc20, address _to, uint _amount) internal {
    bytes memory data = new bytes(4 + 32 + 32);
    uint i;

    // Clear memory
    for (i = 0; i < (4+32+32); i++) data[i] = byte(0);
    
    // Write to data for wallet - erc20.transfer(to, amount);
    for (i = 0   ; i < 4        ; i++) data[i] = bytes4(0xa9059cbb)[i];
    for (i = 4+12; i < (4+32)   ; i++) data[i] = bytes20(_to)[i - (4+12)];
    for (i = 4+32; i < (4+32+32); i++) data[i] = bytes32(_amount)[i - (4+32)];

    MSW(_msw).submitTransaction(address(_erc20), 0, data);
  }
}

contract DevRequire {
  function devRequire(bool x, string memory s) internal {
    // require(x, s);
  }
}

contract QuadraticVoting {
  using SafeMath for uint256;

  // **************************************************
  //                  Variables
  // **************************************************
  event Vote(address indexed voter, uint indexed round, uint indexed votingRoundNumber, bool vote);

  mapping (bytes32 => bool) private wasVoteCast; // sha256(user addr, fundRound, voteRound
  mapping (address => uint) private usersVoteUnits;
  uint private totalVoteUnits;       // Count of all tokens registered for vote
  uint private userCount;             // Used for keeping track of quorum
  uint private totalVotePower;        // Total voting power of users
  uint private yesVotes;          
  uint private noVotes;           
  uint private quadraticYesVotes; 
  uint private quadraticNoVotes;  

  // **************************************************
  //                  Functions
  // **************************************************
  function registerVoter(uint amount) internal {
    require(voterHasRegistered() == false, "Only allowed ot register one time");
    require(amount != 0, "Must have a token balance");

    totalVotePower  = totalVotePower.safeAdd(getUserVotePower(msg.sender));
    totalVoteUnits = totalVoteUnits.safeAdd(amount);
    usersVoteUnits[msg.sender] = amount;
    userCount = userCount.safeAdd(1);
  }

  function clearVotingRound() internal {
    quadraticYesVotes = 0;
    quadraticNoVotes = 0;
    yesVotes = 0;
    noVotes = 0;    
  }

  function _castVote(bytes32 x, bool vote) internal {
    require(wasVoteCast[x] == false, "User has voted");

    wasVoteCast[x] = true;
    if (vote) {
      yesVotes = yesVotes.safeAdd(1);
      quadraticYesVotes = quadraticYesVotes.safeAdd(getUserVotePower(msg.sender));
    } else {
      noVotes = noVotes.safeAdd(1);
      quadraticNoVotes = quadraticNoVotes.safeAdd(getUserVotePower(msg.sender));
    }      
  }

  function unregisterVoter(address user) internal {
    userCount -= 1;
    totalVotePower -= sqrt(usersVoteUnits[user]);
    totalVoteUnits -= usersVoteUnits[user];
    delete usersVoteUnits[user];
  }

  // **************************************************
  //                  View functions
  // **************************************************
  function yesVotesIsMoreOrEqual() public view returns (bool) { return quadraticYesVotes >= quadraticNoVotes; }

  function voterHasRegistered() public view returns (bool) { return usersVoteUnits[msg.sender] != 0; }

  function getUserVoteUnits(address user) internal view returns (uint256) { return usersVoteUnits[user]; }
  function getUserVotePower(address user) public view returns (uint) { return sqrt(usersVoteUnits[user]); }

  function _getTotalVoteUnits() internal view returns (uint256) { return totalVoteUnits; }

  function getQuadraticYesVotes() public view returns (uint) { return quadraticYesVotes; }
  function getQuadraticNoVotes() public view returns (uint) { return quadraticNoVotes; }
  function getYesVotes() public view returns (uint) { return yesVotes; }
  function getNoVotes() public view returns (uint) { return noVotes; }
  /*
 uint private totalVoteUnits;       // Count of all tokens registered for vote
  uint private userCount;             // Used for keeping track of quorum
  uint private totalVotePower;        // Total voting power of users
  */

  function _getHasVoted(bytes32 x) internal view returns (bool) { return wasVoteCast[x]; }

  function sqrt(uint256 x) public pure returns (uint) {
    uint z = x.safeAdd(1) / 2;
    uint y = x;
    
    while (z < y) {
      y = z;
      z = (x / z + z) / 2;
    }
    
    return y;
  }
}

contract TokenPoll is Ownable, ReentrancyGuard, MSW_Util, DevRequire, QuadraticVoting {
  using SafeMath for uint256;

  event RoundResult(uint indexed round, uint indexed votingRoundNumber, bool approvedFunding, uint weightedYesVotes, uint weightedNoVotes, uint yesVoters, uint noVoters, uint fundSize);
  event NewRoundInfo(uint indexed round, uint indexed votingRoundNumber, uint startTime, uint endTime, uint fundSize);
  event Transfer(address indexed from, address indexed to, uint indexed quantity);

  // =====
  // State
  // =====

  bool public refundFlag;            // keep track of state

  // Round variables
  uint public constant voterRegistrationDuration = 1 seconds;
  uint public constant maxTimeBetweenRounds = 180 days;
  uint public constant roundDuration = 7 minutes;

  uint public currentRoundFundSize;
  uint public currentRoundNumber;
  uint public votingRoundNumber;

  uint public registrationStartTime;        // Start/end of voting registration
  uint public registrationEndTime;          // "

  uint public currentRoundStartTime; // ...

  // Fund variables
  address projectWallet;
  ERC20 public stableCoin;           // Location of funds
  address public escrow;             // Initiate escrow to send funds to ICO wallet
  uint public totalRefund;           // Total size of refund
  uint roundOneFunding;

  // Voting variables
  ERC20 public icoCoin;              // Voting power is based on token ownership count

  // **************************************************
  //             Constructor & fallback
  // **************************************************

  constructor () public Ownable() {
    currentRoundNumber = 1;
    votingRoundNumber = 1;
  }

  function () external { require(false); return; }

  // **************************************************
  //                  Admin
  // **************************************************

  function transferOwnership(address _newOwner) public { _transferOwnership(_newOwner); } 

  // **************************************************
  //                  Initializers
  // **************************************************

  function initialize(address _icoToken, address _stableCoin, address _escrow) external onlyOwner nonReentrant {
    require(currentRoundNumber == 1, "Must be in round 1");

    icoCoin = ERC20(_icoToken);
    stableCoin = ERC20(_stableCoin);
    escrow = _escrow;
    currentRoundStartTime = registrationEndTime.safeAdd(maxTimeBetweenRounds);  // todo reaccess if this is a good idea
  }

  function initializeVoterRegistration(uint256 startTime) onlyOwner nonReentrant external {
    devRequire(block.timestamp < registrationStartTime, "Vote registration has already started");
    devRequire(startTime > block.timestamp, "Start time is earlier than current time");
    devRequire(startTime < (block.timestamp + 24 weeks), "Start time is after 6 months");

    registrationStartTime = startTime;
    registrationEndTime   = startTime.safeAdd(voterRegistrationDuration);
  }

  function initializeProjectWalletAddress(address _projectWallet) onlyOwner external {
    devRequire(projectWallet == address(0x0), "Wallet address has been previously set");
    projectWallet = _projectWallet;
  }

  function initializeRound1FundingAmount(uint amount) onlyOwner external {
    devRequire(roundOneFunding == 0, "Round one funding has been set already");
    roundOneFunding = amount;
  }

  // **************************************************
  //                  Round functions
  // **************************************************
  
  function pullFundsAndDisburseRound1(address fundsOrigin, uint fundsBalance) onlyOwner nonReentrant external {
    require(escrow == address(0x0), "Escrow address address is empty");
    require(projectWallet == address(0x0), "Project wallet address is empty");

    // Get funds, then send round 1
    require(stableCoin.transferFrom(fundsOrigin, escrow, fundsBalance), "Funds not sent");
    msw_erc20Transfer(escrow, address(stableCoin), projectWallet, roundOneFunding);
    currentRoundNumber = 2;
    emit RoundResult(1, 1, true, 0, 0, 0, 0, fundsBalance);
  }

  function setupNextRound(uint _startTime, uint _fundSize) external onlyOwner nonReentrant {
    currentRoundStartTime.safeAdd(roundDuration);
    devRequire(refundFlag == false, "Failed funding. Refund in progress");
    devRequire(_startTime <= now.safeAdd(maxTimeBetweenRounds), "Start time is too far out");
    devRequire(_startTime >= now, "Start time is less than the current time");
    require(stableCoin.balanceOf(escrow) >= _fundSize, "Need more funds in escrow");
    devRequire(getRoundEndTime() > block.timestamp, "Please setup next round after the current one is finished");

    emit NewRoundInfo(currentRoundNumber, votingRoundNumber, _startTime, _startTime.safeAdd(roundDuration), _fundSize);

    currentRoundStartTime = _startTime;
    currentRoundFundSize = _fundSize;
  }

  function finalizeRound() public nonReentrant {
    devRequire(block.timestamp > getRoundEndTime(), "Round is not finished");
    
    bool enoughVotes = yesVotesIsMoreOrEqual();
    bool threeStrikes = 3 == votingRoundNumber;

    if (threeStrikes) {
      startRefund();
    } else if (enoughVotes) {
      msw_erc20Transfer(escrow, address(stableCoin), projectWallet, roundOneFunding);
    }

    // State changes
    emit RoundResult( currentRoundNumber, votingRoundNumber
                    , enoughVotes, getQuadraticYesVotes(), getQuadraticNoVotes(), getYesVotes(), getNoVotes()
                    , currentRoundFundSize
                    );

    if (enoughVotes) {
      votingRoundNumber = 1;
      currentRoundNumber = currentRoundNumber.safeAdd(1);
    } else {
      votingRoundNumber = votingRoundNumber.safeAdd(1);
    }

    clearVotingRound();
  }

  // **************************************************
  //                  Voter functions
  // **************************************************

  function refundIfPenalized() external nonReentrant {
    bool exceededRoundSetupTime = getRoundEndTime().safeAdd(maxTimeBetweenRounds) > now;
    if (exceededRoundSetupTime) startRefund();
  }
  
  function registerAsVoter() external nonReentrant {
    devRequire(registrationStartTime < block.timestamp && block.timestamp < registrationEndTime, "Registration has not started or is over");
    uint userTokens = icoCoin.balanceOf(msg.sender);
    registerVoter(userTokens);
  }

  function castVote(bool vote) external nonReentrant {
    devRequire(getRoundStartTime() < block.timestamp && block.timestamp < getRoundEndTime(), "Vote must happen during poll");
    devRequire(getUserTokenBalance(msg.sender) != 0, "User is not a registered voter");
    devRequire(!getHasVoted(msg.sender, currentRoundNumber, votingRoundNumber), "User has previously voted");

    castVoteBridge(msg.sender, currentRoundNumber, votingRoundNumber, vote);

    emit Vote(msg.sender, currentRoundNumber, votingRoundNumber, vote);
  }

  function userRefund() external nonReentrant {
    devRequire(refundFlag == true, "Refunding hasn't started");
    devRequire(getUserTokenBalance(msg.sender) != 0, "User is not a registered voter");

    address from = address(this);
    address user = msg.sender;
    uint userTokenCount = getUserTokenBalance(user);
    uint refundSize = totalRefund.safeMul(userTokenCount) / totalTokenCount();

    unregisterVoter(user);
    devRequire(stableCoin.transfer(user, refundSize), "Stable coin did not send funds");

    emit Transfer(from, user, refundSize);
  }

  // =======
  // Getters
  // =======

  function totalTokenCount() public view returns(uint256) { return _getTotalVoteUnits(); }

  function getUserTokenBalance(address user) public view returns (uint) { return getUserVoteUnits(user); }

  function getHasVoted(address user, uint _fundingRoundNum, uint _votingRoundNum) public view returns (bool) {
    bytes memory b = abi.encodePacked(user, _fundingRoundNum, _votingRoundNum);
    bytes32 hash = keccak256(b);
    return _getHasVoted(hash);
  }

  function castVoteBridge(address user, uint _fundingRoundNum, uint _votingRoundNum, bool vote) private {
    bytes memory b = abi.encodePacked(user, _fundingRoundNum, _votingRoundNum);
    bytes32 hash = keccak256(b);
    _castVote(hash, vote);
  }

  function getOwner() public view returns (address) { return _getOwner(); }

  function getUserRefundSize(address user) public view returns (uint) { return refundFlag == false? 0: totalRefund.safeMul(getUserTokenBalance(user)) / totalTokenCount(); }

  function getRoundStartTime() public view returns (uint) { return currentRoundStartTime; }

  function getRoundEndTime() public view returns (uint) { return currentRoundStartTime.safeAdd(roundDuration); }

  // ================
  // Private fns
  // ================

  function startRefund() private {
      totalRefund = stableCoin.balanceOf(escrow);
      msw_erc20Transfer(escrow, address(stableCoin), address(this), totalRefund);
      refundFlag = true;
  }
}
