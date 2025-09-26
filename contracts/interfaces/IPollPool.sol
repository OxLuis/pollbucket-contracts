// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPollPool {
    enum PoolStatus { Open, Closed, Validated, Cancelled }
    
    struct Pool {
        uint256 id;
        address creator;
        string question;
        string[] options;
        uint256 openTime;
        uint256 closeTime;
        uint256 totalStake;
        uint256 creatorCommission;
        PoolStatus status;
        uint256 winningOption;
        bool rewardsDistributed;
        uint256 maxParticipants;
        uint256 currentParticipants;
        uint256 fixedBetAmount;
    }
    
    struct Bet {
        address bettor;
        uint256 amount;
        uint256 option;
        uint256 timestamp;
    }
    
    function createPool(
        string memory _question,
        string[] memory _options,
        uint256 _closeTime,
        uint256 _maxParticipants,
        uint256 _fixedBetAmount
    ) external payable;
    
    function placeBet(uint256 _poolId, uint256 _option) external payable;
    function closePool(uint256 _poolId) external;
    function validatePool(uint256 _poolId, uint256 _winningOption) external;
    function distributeRewards(uint256 _poolId) external;
    
    function getPool(uint256 _poolId) external view returns (Pool memory);
    function getPoolBets(uint256 _poolId) external view returns (Bet[] memory);
    function getUserPools(address _user) external view returns (uint256[] memory);
    function getUserBets(address _user, uint256 _poolId) external view returns (uint256[] memory);
    function hasUserParticipated(uint256 _poolId, address _user) external view returns (bool);
    function getPoolParticipantCount(uint256 _poolId) external view returns (uint256, uint256);
    
    // Funciones de identificación y búsqueda
    function getAllPoolIds() external view returns (uint256[] memory);
    function getPoolsByStatus(PoolStatus _status) external view returns (uint256[] memory);
    function getPoolsByCreator(address _creator) external view returns (uint256[] memory);
    function getTotalPoolsCount() external view returns (uint256);
    function getActivePoolsCount() external view returns (uint256);
    function getPoolFixedBetAmount(uint256 _poolId) external view returns (uint256);
    function getPoolsByIdRange(uint256 _startId, uint256 _endId) external view returns (uint256[] memory);
    function getRecentPools(uint256 _count) external view returns (uint256[] memory);
    
    // Funciones de información completa del pool
    function getPoolInfo(uint256 _poolId) external view returns (
        uint256 totalAvax,
        uint256 currentParticipants,
        uint256 maxParticipants,
        uint256 daysRemaining,
        uint256 hoursRemaining,
        uint256 minutesRemaining,
        PoolStatus status,
        uint256 fixedBetAmount
    );
    
    function getPoolTimeRemaining(uint256 _poolId) external view returns (
        uint256 secondsRemaining,
        bool isExpired
    );
    
    function canJoinPool(uint256 _poolId) external view returns (
        bool canJoin,
        string memory reason
    );
    
    function getPoolStats(uint256 _poolId) external view returns (
        uint256 totalAvax,
        uint256 participantCount,
        uint256 participantPercentage,
        bool isActive,
        bool isFull,
        uint256 avgBetAmount
    );
}