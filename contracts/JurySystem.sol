// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IReputationSystem.sol";
import "./interfaces/IPollPool.sol";

/**
 * @title JurySystem
 * @dev Sistema de jurados para validar resultados de pools
 */
contract JurySystem is Ownable, ReentrancyGuard {
    
    enum ValidationStatus { Pending, InProgress, Completed, Disputed }
    
    struct Validation {
        uint256 poolId;
        address[] assignedJurors;
        mapping(address => uint256) votes; // juror => option voted
        mapping(address => bool) hasVoted;
        uint256[] optionVotes; // count of votes per option
        uint256 totalVotes;
        uint256 requiredVotes;
        ValidationStatus status;
        uint256 deadline;
        uint256 winningOption;
        bool rewardsDistributed;
    }
    
    // Constants
    uint256 public constant MIN_JURORS = 3;
    uint256 public constant MAX_JURORS = 7;
    uint256 public constant VALIDATION_PERIOD = 24 hours;
    uint256 public constant MIN_REPUTATION_REQUIRED = 75;
    uint256 public constant JUROR_REWARD = 0.01 ether;
    
    mapping(uint256 => Validation) public validations;
    mapping(address => uint256[]) public jurorAssignments;
    
    IReputationSystem public reputationSystem;
    IPollPool public pollPool;
    
    uint256 public totalValidations;
    
    event ValidationInitiated(uint256 indexed poolId, address[] jurors);
    event VoteCast(uint256 indexed poolId, address indexed juror, uint256 option);
    event ValidationCompleted(uint256 indexed poolId, uint256 winningOption);
    event JurorRewarded(address indexed juror, uint256 amount);
    event ValidationDisputed(uint256 indexed poolId);
    event JurorExcludedForConflict(uint256 indexed poolId, address indexed juror);
    
    modifier onlyPollPool() {
        require(msg.sender == address(pollPool), "Solo PollPool");
        _;
    }
    
    constructor(address _reputationSystem, address _pollPool) {
        reputationSystem = IReputationSystem(_reputationSystem);
        pollPool = IPollPool(_pollPool);
    }
    
    /**
     * @dev Iniciar proceso de validación para un pool
     * @param _poolId ID del pool a validar
     */
    function initiateValidation(uint256 _poolId) external onlyPollPool {
        require(validations[_poolId].status == ValidationStatus.Pending, "Validacion ya iniciada");
        
        // Obtener pool info para determinar número de opciones
        (,,,string[] memory options,,,,,,) = pollPool.getPool(_poolId);
        
        // Determinar número de jurados necesarios
        uint256 jurorsNeeded = _calculateJurorsNeeded(options.length);
        
        // Obtener jurados elegibles (más cantidad para filtrar conflictos)
        address[] memory eligibleJurors = reputationSystem.getEligibleJurors(
            MIN_REPUTATION_REQUIRED, 
            jurorsNeeded * 4 // Obtener 4x más para filtrar participantes del pool
        );
        
        // Filtrar jurados que NO participaron en este pool (evitar conflicto de interés)
        address[] memory nonConflictedJurors = _filterNonParticipants(_poolId, eligibleJurors);
        
        require(nonConflictedJurors.length >= jurorsNeeded, "Jurados sin conflicto insuficientes");
        
        // Seleccionar jurados aleatoriamente de los no conflictuados
        address[] memory selectedJurors = _selectRandomJurors(nonConflictedJurors, jurorsNeeded, _poolId);
        
        Validation storage validation = validations[_poolId];
        validation.poolId = _poolId;
        validation.assignedJurors = selectedJurors;
        validation.optionVotes = new uint256[](options.length);
        validation.requiredVotes = jurorsNeeded;
        validation.status = ValidationStatus.InProgress;
        validation.deadline = block.timestamp + VALIDATION_PERIOD;
        
        // Registrar asignaciones
        for (uint256 i = 0; i < selectedJurors.length; i++) {
            jurorAssignments[selectedJurors[i]].push(_poolId);
        }
        
        totalValidations++;
        
        emit ValidationInitiated(_poolId, selectedJurors);
    }    /**
  
   * @dev Votar en una validación
     * @param _poolId ID del pool
     * @param _option Opción votada
     */
    function castVote(uint256 _poolId, uint256 _option) external {
        Validation storage validation = validations[_poolId];
        require(validation.status == ValidationStatus.InProgress, "Validacion no activa");
        require(block.timestamp <= validation.deadline, "Periodo de votacion vencido");
        require(_isAssignedJuror(_poolId, msg.sender), "No asignado como jurado");
        require(!validation.hasVoted[msg.sender], "Ya voto");
        
        // Verificar que la opción es válida
        (,,,string[] memory options,,,,,,) = pollPool.getPool(_poolId);
        require(_option < options.length, "Opcion invalida");
        
        validation.votes[msg.sender] = _option;
        validation.hasVoted[msg.sender] = true;
        validation.optionVotes[_option]++;
        validation.totalVotes++;
        
        emit VoteCast(_poolId, msg.sender, _option);
        
        // Verificar si se completó la votación
        if (validation.totalVotes >= validation.requiredVotes) {
            _completeValidation(_poolId);
        }
    }
    
    /**
     * @dev Completar validación y determinar ganador
     */
    function _completeValidation(uint256 _poolId) internal {
        Validation storage validation = validations[_poolId];
        
        // Encontrar opción ganadora (mayoría simple)
        uint256 winningOption = 0;
        uint256 maxVotes = validation.optionVotes[0];
        
        for (uint256 i = 1; i < validation.optionVotes.length; i++) {
            if (validation.optionVotes[i] > maxVotes) {
                maxVotes = validation.optionVotes[i];
                winningOption = i;
            }
        }
        
        // Verificar si hay empate
        uint256 tiedOptions = 0;
        for (uint256 i = 0; i < validation.optionVotes.length; i++) {
            if (validation.optionVotes[i] == maxVotes) {
                tiedOptions++;
            }
        }
        
        if (tiedOptions > 1) {
            // Manejar empate - asignar jurados adicionales
            validation.status = ValidationStatus.Disputed;
            emit ValidationDisputed(_poolId);
            return;
        }
        
        validation.status = ValidationStatus.Completed;
        validation.winningOption = winningOption;
        
        // Actualizar reputaciones
        _updateJurorReputations(_poolId, winningOption);
        
        // Notificar al PollPool
        pollPool.validatePool(_poolId, winningOption);
        
        emit ValidationCompleted(_poolId, winningOption);
    }
    
    /**
     * @dev Actualizar reputaciones de jurados basado en sus votos
     */
    function _updateJurorReputations(uint256 _poolId, uint256 _winningOption) internal {
        Validation storage validation = validations[_poolId];
        
        for (uint256 i = 0; i < validation.assignedJurors.length; i++) {
            address juror = validation.assignedJurors[i];
            if (validation.hasVoted[juror]) {
                bool votedCorrectly = validation.votes[juror] == _winningOption;
                reputationSystem.updateReputation(juror, votedCorrectly);
            } else {
                // Penalizar por no votar
                reputationSystem.updateReputation(juror, false);
            }
        }
    } 
   /**
     * @dev Distribuir recompensas a jurados que votaron correctamente
     */
    function distributeJurorRewards(uint256 _poolId) external payable nonReentrant {
        Validation storage validation = validations[_poolId];
        require(validation.status == ValidationStatus.Completed, "Validacion no completada");
        require(!validation.rewardsDistributed, "Recompensas ya distribuidas");
        
        uint256 correctVoters = validation.optionVotes[validation.winningOption];
        require(correctVoters > 0, "No hay votantes correctos");
        
        uint256 totalReward = msg.value;
        uint256 rewardPerJuror = totalReward / correctVoters;
        
        for (uint256 i = 0; i < validation.assignedJurors.length; i++) {
            address juror = validation.assignedJurors[i];
            if (validation.hasVoted[juror] && 
                validation.votes[juror] == validation.winningOption) {
                payable(juror).transfer(rewardPerJuror);
                emit JurorRewarded(juror, rewardPerJuror);
            }
        }
        
        validation.rewardsDistributed = true;
    }
    
    /**
     * @dev Resolver empate asignando jurados adicionales
     */
    function resolveTie(uint256 _poolId) external onlyOwner {
        Validation storage validation = validations[_poolId];
        require(validation.status == ValidationStatus.Disputed, "No hay disputa");
        
        // Asignar 2 jurados adicionales sin conflicto de interés
        address[] memory eligibleForTie = reputationSystem.getEligibleJurors(
            MIN_REPUTATION_REQUIRED + 25, // Reputación más alta para resolver empates
            8 // Obtener más para filtrar conflictos
        );
        
        // Filtrar jurados que NO participaron en este pool
        address[] memory nonConflictedForTie = _filterNonParticipants(_poolId, eligibleForTie);
        
        require(nonConflictedForTie.length >= 2, "Jurados sin conflicto insuficientes para resolver empate");
        
        // Seleccionar 2 jurados adicionales aleatoriamente
        address[] memory additionalJurors = _selectRandomJurors(nonConflictedForTie, 2, _poolId + block.timestamp);
        
        // Agregar jurados adicionales
        for (uint256 i = 0; i < additionalJurors.length; i++) {
            validation.assignedJurors.push(additionalJurors[i]);
            jurorAssignments[additionalJurors[i]].push(_poolId);
        }
        
        validation.requiredVotes += 2;
        validation.status = ValidationStatus.InProgress;
        validation.deadline = block.timestamp + (VALIDATION_PERIOD / 2); // Menos tiempo para resolver
    }
    
    /**
     * @dev Forzar completar validación si el tiempo se agotó
     */
    function forceCompleteValidation(uint256 _poolId) external {
        Validation storage validation = validations[_poolId];
        require(validation.status == ValidationStatus.InProgress, "Validacion no activa");
        require(block.timestamp > validation.deadline, "Periodo no vencido");
        require(validation.totalVotes > 0, "No hay votos");
        
        _completeValidation(_poolId);
    }
    
    // Helper functions
    function _calculateJurorsNeeded(uint256 _optionsCount) internal pure returns (uint256) {
        if (_optionsCount <= 2) return MIN_JURORS;
        if (_optionsCount <= 4) return MIN_JURORS + 2;
        return MAX_JURORS;
    }
    
    /**
     * @dev Filtrar jurados que NO participaron en el pool para evitar conflicto de interés
     * @param _poolId ID del pool
     * @param _eligible Array de jurados elegibles
     * @return nonParticipants Array de jurados que NO participaron en el pool
     */
    function _filterNonParticipants(uint256 _poolId, address[] memory _eligible) 
        internal 
        view 
        returns (address[] memory nonParticipants) 
    {
        // Contar cuántos jurados NO participaron
        uint256 nonParticipantCount = 0;
        for (uint256 i = 0; i < _eligible.length; i++) {
            if (!pollPool.hasUserParticipated(_poolId, _eligible[i])) {
                nonParticipantCount++;
            } else {
                // Emitir evento para tracking de conflictos excluidos
                emit JurorExcludedForConflict(_poolId, _eligible[i]);
            }
        }
        
        // Crear array con jurados sin conflicto
        nonParticipants = new address[](nonParticipantCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _eligible.length; i++) {
            if (!pollPool.hasUserParticipated(_poolId, _eligible[i])) {
                nonParticipants[index] = _eligible[i];
                index++;
            }
        }
        
        return nonParticipants;
    }
    
    function _selectRandomJurors(
        address[] memory _eligible, 
        uint256 _needed, 
        uint256 _seed
    ) internal view returns (address[] memory) {
        require(_eligible.length >= _needed, "Jurados insuficientes");
        
        address[] memory selected = new address[](_needed);
        bool[] memory used = new bool[](_eligible.length);
        
        for (uint256 i = 0; i < _needed; i++) {
            uint256 randomIndex;
            do {
                randomIndex = uint256(keccak256(abi.encodePacked(
                    block.timestamp, 
                    block.difficulty, 
                    _seed, 
                    i
                ))) % _eligible.length;
            } while (used[randomIndex]);
            
            used[randomIndex] = true;
            selected[i] = _eligible[randomIndex];
        }
        
        return selected;
    }
    
    function _isAssignedJuror(uint256 _poolId, address _juror) internal view returns (bool) {
        address[] memory assigned = validations[_poolId].assignedJurors;
        for (uint256 i = 0; i < assigned.length; i++) {
            if (assigned[i] == _juror) return true;
        }
        return false;
    }    // V
iew functions
    function getValidation(uint256 _poolId) external view returns (
        uint256 poolId,
        address[] memory assignedJurors,
        uint256[] memory optionVotes,
        uint256 totalVotes,
        uint256 requiredVotes,
        ValidationStatus status,
        uint256 deadline,
        uint256 winningOption
    ) {
        Validation storage validation = validations[_poolId];
        return (
            validation.poolId,
            validation.assignedJurors,
            validation.optionVotes,
            validation.totalVotes,
            validation.requiredVotes,
            validation.status,
            validation.deadline,
            validation.winningOption
        );
    }
    
    function getJurorVote(uint256 _poolId, address _juror) external view returns (uint256, bool) {
        Validation storage validation = validations[_poolId];
        return (validation.votes[_juror], validation.hasVoted[_juror]);
    }
    
    function getJurorAssignments(address _juror) external view returns (uint256[] memory) {
        return jurorAssignments[_juror];
    }
    
    function isJurorAssigned(uint256 _poolId, address _juror) external view returns (bool) {
        return _isAssignedJuror(_poolId, _juror);
    }
    
    /**
     * @dev Verificar si un jurado tiene conflicto de interés con un pool
     * @param _poolId ID del pool
     * @param _juror Dirección del jurado
     * @return hasConflict Si tiene conflicto de interés
     * @return reason Razón del conflicto
     */
    function hasConflictOfInterest(uint256 _poolId, address _juror) 
        external 
        view 
        returns (bool hasConflict, string memory reason) 
    {
        if (pollPool.hasUserParticipated(_poolId, _juror)) {
            return (true, "Jurado participo en el pool");
        }
        
        return (false, "Sin conflicto de interes");
    }
    
    /**
     * @dev Obtener estadísticas de conflictos para un pool
     * @param _poolId ID del pool
     * @return totalEligible Total de jurados elegibles por reputación
     * @return conflicted Jurados con conflicto de interés
     * @return available Jurados disponibles sin conflicto
     */
    function getConflictStats(uint256 _poolId) 
        external 
        view 
        returns (uint256 totalEligible, uint256 conflicted, uint256 available) 
    {
        address[] memory eligible = reputationSystem.getEligibleJurors(MIN_REPUTATION_REQUIRED, 50);
        totalEligible = eligible.length;
        
        for (uint256 i = 0; i < eligible.length; i++) {
            if (pollPool.hasUserParticipated(_poolId, eligible[i])) {
                conflicted++;
            } else {
                available++;
            }
        }
        
        return (totalEligible, conflicted, available);
    }
    
    // Admin functions
    function updatePollPool(address _newPollPool) external onlyOwner {
        pollPool = IPollPool(_newPollPool);
    }
    
    function updateReputationSystem(address _newReputationSystem) external onlyOwner {
        reputationSystem = IReputationSystem(_newReputationSystem);
    }
    
    function emergencyResolve(uint256 _poolId, uint256 _winningOption) external onlyOwner {
        Validation storage validation = validations[_poolId];
        require(validation.status != ValidationStatus.Completed, "Ya completada");
        
        validation.status = ValidationStatus.Completed;
        validation.winningOption = _winningOption;
        
        pollPool.validatePool(_poolId, _winningOption);
        emit ValidationCompleted(_poolId, _winningOption);
    }
}