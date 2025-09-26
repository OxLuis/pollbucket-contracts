// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IJurySystem {
    enum ValidationStatus { Pending, InProgress, Completed, Disputed }
    
    function initiateValidation(uint256 _poolId) external;
    function castVote(uint256 _poolId, uint256 _option) external;
    function distributeJurorRewards(uint256 _poolId) external payable;
    function resolveTie(uint256 _poolId) external;
    function forceCompleteValidation(uint256 _poolId) external;
    
    function getValidation(uint256 _poolId) external view returns (
        uint256 poolId,
        address[] memory assignedJurors,
        uint256[] memory optionVotes,
        uint256 totalVotes,
        uint256 requiredVotes,
        ValidationStatus status,
        uint256 deadline,
        uint256 winningOption
    );
    
    function getJurorVote(uint256 _poolId, address _juror) external view returns (uint256, bool);
    function getJurorAssignments(address _juror) external view returns (uint256[] memory);
    function isJurorAssigned(uint256 _poolId, address _juror) external view returns (bool);
}