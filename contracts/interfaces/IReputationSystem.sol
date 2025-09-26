// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IReputationSystem {
    struct JurorProfile {
        uint256 reputation;
        uint256 totalVotes;
        uint256 correctVotes;
        uint256 lastActivity;
        bool isActive;
        uint256 stakedAmount;
    }
    
    function registerAsJuror() external payable;
    function increaseStake() external payable;
    function updateReputation(address _juror, bool _votedCorrectly) external;
    function slashJuror(address _juror, uint256 _slashPercentage) external;
    function reactivateJuror(address _juror) external;
    function withdrawStake() external;
    
    function getEligibleJurors(uint256 _minReputation, uint256 _count) 
        external 
        view 
        returns (address[] memory);
    
    function getJurorProfile(address _juror) external view returns (JurorProfile memory);
    function isEligibleJuror(address _juror, uint256 _minReputation) external view returns (bool);
    function getActiveJurorsCount() external view returns (uint256);
    function getJurorAccuracy(address _juror) external view returns (uint256);
    
    function addAuthorizedCaller(address _caller) external;
    function removeAuthorizedCaller(address _caller) external;
    function setMinStakeRequired(uint256 _newMinStake) external;
    function getMinStakeRequired() external view returns (uint256);
}