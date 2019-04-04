pragma solidity >=0.4.15;

import "./Ownable.sol";
import "./ERC20.sol";
import "./SafeMath.sol";


/**
@title TokenPoll
@author Nick Geoca
*/

contract ReentrancyGuard {
  bool private rentrancy_lock = false;

  modifier nonReentrant() {
    require(!rentrancy_lock);
    rentrancy_lock = true;
    _;
    rentrancy_lock = false;
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

contract TokenPoll is Ownable, ReentrancyGuard, DevRequire, QuadraticVoting {
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
  uint public constant maxTimeBetweenFundingRounds = 180 days;
  uint public constant maxTimeBetweenVotingRounds = 30 days;
  uint public constant roundDuration = 7 minutes;

  uint public currentRoundFundSize;
  uint public currentRoundNumber;
  uint public votingRoundNumber;
  bool public roundComplete;

  uint public registrationStartTime;        // Start/end of voting registration
  uint public currentRoundStartTime; // This carries special info. If ever 0, then ready to setup the next round

  // Fund variables
  address public projectWallet;
  ERC20 public stableCoin;           // Location of funds
  uint public totalRefund;           // Total size of refund

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

  function initialize(address _icoToken, address _stableCoin) external onlyOwner nonReentrant {
    require(currentRoundNumber == 1, "Must be in round 1");

    icoCoin = ERC20(_icoToken);
    stableCoin = ERC20(_stableCoin);
  }

  function initializeVoterRegistration(uint256 startTime) onlyOwner nonReentrant external {
    devRequire(block.timestamp < registrationStartTime, "Vote registration has already started");
    devRequire(startTime > block.timestamp, "Start time is earlier than current time");
    devRequire(startTime < (block.timestamp + 24 weeks), "Start time is after 6 months");

    registrationStartTime = startTime;
  }

  function initializeProjectWalletAddress(address _projectWallet) onlyOwner external {
    devRequire(projectWallet == address(0x0), "Wallet address has been previously set");
    projectWallet = _projectWallet;
  }

  function initializeRound1FundingAmount(uint amount) onlyOwner external {
    devRequire(currentRoundFundSize == 0, "Round one funding has been set already");
    currentRoundFundSize = amount;
  }

  // **************************************************
  //                  Round functions
  // **************************************************

  function pullFundsAndDisburseRound1(address fundsOrigin, uint fundsBalance) onlyOwner nonReentrant external {
    require(projectWallet != address(0x0), "Project wallet address is empty");
    require(currentRoundNumber == 1, "Round one has passed");

    // Get funds, then send round 1
    require(stableCoin.transferFrom(fundsOrigin, address(this), fundsBalance), "Mismatch on expected funds to receive");
    require(stableCoin.transfer(projectWallet, currentRoundFundSize), "Failed to disburse round 1");
    currentRoundNumber = 2;
    emit RoundResult(1, 1, true, 0, 0, 0, 0, fundsBalance);
    roundComplete = true;
  }

  function setupNextRound(uint _startTime, uint _fundSize) external onlyOwner nonReentrant {
    bool nextRoundIsFundingRound = votingRoundNumber == 1;
    if (nextRoundIsFundingRound) { devRequire(_startTime <= now.safeAdd(maxTimeBetweenFundingRounds), "Start time is too far out for funding round"); }
    else                         { devRequire(_startTime <= now.safeAdd(maxTimeBetweenVotingRounds), "Start time is too far out for voting round");   }
    devRequire(roundComplete == true, "Previous round is not completed");
    devRequire(refundFlag == false, "Failed funding. Refund in progress");
    devRequire(_startTime >= now, "Start time is less than the current time");
    require(stableCoin.balanceOf(address(this)) >= _fundSize, "Need more funds in stash");

    roundComplete = false;
    currentRoundStartTime = _startTime;
    currentRoundFundSize = _fundSize;

    emit NewRoundInfo(currentRoundNumber, votingRoundNumber, _startTime, _startTime.safeAdd(roundDuration), _fundSize);
  }

  function finalizeRound() public nonReentrant {
    devRequire(roundComplete == false, "Round not started");
    devRequire(block.timestamp > getRoundEndTime(), "Round is not finished");

    bool enoughPassVotes = yesVotesIsMoreOrEqual();
    bool threeStrikes = votingRoundNumber >= 3;     // Voting round number starts at 1

    emit RoundResult( currentRoundNumber, votingRoundNumber
                    , enoughPassVotes, getQuadraticYesVotes(), getQuadraticNoVotes(), getYesVotes(), getNoVotes()
                    , currentRoundFundSize
                    );

    votingRoundNumber = votingRoundNumber.safeAdd(1);  
    clearVotingRound();
    roundComplete = true;

    // On 3rd voting round, check if there is enough pass votes first. If not, then refund
    if (enoughPassVotes) {
      votingRoundNumber = 1;
      currentRoundNumber = currentRoundNumber.safeAdd(1);
      stableCoin.transfer(projectWallet, currentRoundFundSize);
    } else if (threeStrikes) {
      startRefund();
    }
  }

  // **************************************************
  //                  Voter functions
  // **************************************************

  function refundIfPenalized() external nonReentrant {
    bool nextRoundIsFundingRound = votingRoundNumber == 1;
    bool nextRoundIsVotingRound = !nextRoundIsFundingRound;
    bool exceededFundingRoundSetupTime = getRoundEndTime().safeAdd(maxTimeBetweenFundingRounds) > now;
    bool exceededVotingRoundSetupTime  = getRoundEndTime().safeAdd(maxTimeBetweenVotingRounds) > now;

    if ( nextRoundIsFundingRound && exceededFundingRoundSetupTime
      || nextRoundIsVotingRound && exceededVotingRoundSetupTime) {
        startRefund();
    }
  }
  
  function registerAsVoter() external nonReentrant {
    devRequire(registrationStartTime < block.timestamp && block.timestamp < getRegistrationEndTime(), "Registration has not started or is over");
    uint userTokens = icoCoin.balanceOf(msg.sender);
    registerVoter(userTokens);
  }

  function castVote(bool vote) external nonReentrant {
    devRequire(isInRound(), "Vote must happen during round");
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

    emit Transfer(from, user, refundSize); //todo, remove this b/c .transfer already does this?
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
  function isInRound() public view returns (bool) { return getRoundStartTime() <= block.timestamp && block.timestamp < getRoundEndTime(); }

  function getRegistrationStartTime() public view returns (uint) { return registrationStartTime; }
  function getRegistrationEndTime() public view returns (uint) { return registrationStartTime.safeAdd(voterRegistrationDuration); }

  // ================
  // Private fns
  // ================

  function startRefund() private {
    totalRefund = stableCoin.balanceOf(address(this));
    refundFlag = true;
  }
}
