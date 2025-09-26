// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationSystem
 * @dev Sistema de reputación para jurados de la plataforma
 */
contract ReputationSystem is Ownable {
    
    struct JurorProfile {
        uint256 reputation;
        uint256 totalVotes;
        uint256 correctVotes;
        uint256 lastActivity;
        bool isActive;
        uint256 stakedAmount;
    }
    
    // Constants
    uint256 public constant INITIAL_REPUTATION = 100;
    uint256 public constant MIN_REPUTATION = 50;
    uint256 public constant MAX_REPUTATION = 1000;
    uint256 public constant REPUTATION_GAIN = 10;
    uint256 public constant REPUTATION_LOSS = 15;
    uint256 public constant MIN_STAKE_REQUIRED = 0.05 ether;
    
    mapping(address => JurorProfile) public jurors;
    mapping(address => bool) public authorizedCallers;
    
    address[] public activeJurors;
    
    event JurorRegistered(address indexed juror, uint256 stakedAmount);
    event ReputationUpdated(address indexed juror, uint256 newReputation, bool increased);
    event JurorSlashed(address indexed juror, uint256 slashedAmount);
    event JurorSuspended(address indexed juror);
    event JurorReactivated(address indexed juror);
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "No autorizado");
        _;
    }
    
    constructor() {
        // El owner es automáticamente un caller autorizado
        authorizedCallers[msg.sender] = true;
    }
    
    /**
     * @dev Registrar como jurado con stake inicial
     */
    function registerAsJuror() external payable {
        require(msg.value >= MIN_STAKE_REQUIRED, "Stake insuficiente");
        require(!jurors[msg.sender].isActive, "Ya registrado como jurado");
        
        jurors[msg.sender] = JurorProfile({
            reputation: INITIAL_REPUTATION,
            totalVotes: 0,
            correctVotes: 0,
            lastActivity: block.timestamp,
            isActive: true,
            stakedAmount: msg.value
        });
        
        activeJurors.push(msg.sender);
        
        emit JurorRegistered(msg.sender, msg.value);
    }
    
    /**
     * @dev Aumentar stake de jurado existente
     */
    function increaseStake() external payable {
        require(jurors[msg.sender].isActive, "No es jurado activo");
        require(msg.value > 0, "Debe enviar AVAX");
        
        jurors[msg.sender].stakedAmount += msg.value;
    }  
  /**
     * @dev Actualizar reputación después de una votación
     * @param _juror Dirección del jurado
     * @param _votedCorrectly Si votó correctamente
     */
    function updateReputation(address _juror, bool _votedCorrectly) external onlyAuthorized {
        require(jurors[_juror].isActive, "Jurado no activo");
        
        JurorProfile storage profile = jurors[_juror];
        profile.totalVotes++;
        profile.lastActivity = block.timestamp;
        
        if (_votedCorrectly) {
            profile.correctVotes++;
            if (profile.reputation < MAX_REPUTATION) {
                profile.reputation += REPUTATION_GAIN;
                if (profile.reputation > MAX_REPUTATION) {
                    profile.reputation = MAX_REPUTATION;
                }
            }
            emit ReputationUpdated(_juror, profile.reputation, true);
        } else {
            if (profile.reputation > REPUTATION_LOSS) {
                profile.reputation -= REPUTATION_LOSS;
            } else {
                profile.reputation = 0;
            }
            
            // Suspender si la reputación cae por debajo del mínimo
            if (profile.reputation < MIN_REPUTATION) {
                _suspendJuror(_juror);
            }
            
            emit ReputationUpdated(_juror, profile.reputation, false);
        }
    }
    
    /**
     * @dev Aplicar slashing por comportamiento malicioso
     * @param _juror Dirección del jurado
     * @param _slashPercentage Porcentaje a slashear (en basis points)
     */
    function slashJuror(address _juror, uint256 _slashPercentage) external onlyAuthorized {
        require(jurors[_juror].isActive, "Jurado no activo");
        require(_slashPercentage <= 10000, "Porcentaje invalido");
        
        JurorProfile storage profile = jurors[_juror];
        uint256 slashAmount = (profile.stakedAmount * _slashPercentage) / 10000;
        
        profile.stakedAmount -= slashAmount;
        profile.reputation = profile.reputation / 2; // Reducir reputación a la mitad
        
        // Transferir fondos slasheados al owner
        payable(owner()).transfer(slashAmount);
        
        // Suspender si el stake es muy bajo
        if (profile.stakedAmount < MIN_STAKE_REQUIRED) {
            _suspendJuror(_juror);
        }
        
        emit JurorSlashed(_juror, slashAmount);
    }
    
    /**
     * @dev Suspender jurado
     */
    function _suspendJuror(address _juror) internal {
        jurors[_juror].isActive = false;
        
        // Remover de la lista de jurados activos
        for (uint256 i = 0; i < activeJurors.length; i++) {
            if (activeJurors[i] == _juror) {
                activeJurors[i] = activeJurors[activeJurors.length - 1];
                activeJurors.pop();
                break;
            }
        }
        
        emit JurorSuspended(_juror);
    }
    
    /**
     * @dev Reactivar jurado (solo owner)
     */
    function reactivateJuror(address _juror) external onlyOwner {
        require(!jurors[_juror].isActive, "Jurado ya activo");
        require(jurors[_juror].stakedAmount >= MIN_STAKE_REQUIRED, "Stake insuficiente");
        require(jurors[_juror].reputation >= MIN_REPUTATION, "Reputacion insuficiente");
        
        jurors[_juror].isActive = true;
        activeJurors.push(_juror);
        
        emit JurorReactivated(_juror);
    }  
  /**
     * @dev Retirar stake (solo si no está activo como jurado)
     */
    function withdrawStake() external {
        require(!jurors[msg.sender].isActive, "Debe desactivarse primero");
        require(jurors[msg.sender].stakedAmount > 0, "No hay stake para retirar");
        
        uint256 amount = jurors[msg.sender].stakedAmount;
        jurors[msg.sender].stakedAmount = 0;
        
        payable(msg.sender).transfer(amount);
    }
    
    /**
     * @dev Obtener jurados elegibles para validación
     * @param _minReputation Reputación mínima requerida
     * @param _count Número de jurados necesarios
     */
    function getEligibleJurors(uint256 _minReputation, uint256 _count) 
        external 
        view 
        returns (address[] memory) 
    {
        address[] memory eligible = new address[](_count);
        uint256 found = 0;
        
        for (uint256 i = 0; i < activeJurors.length && found < _count; i++) {
            address juror = activeJurors[i];
            if (jurors[juror].reputation >= _minReputation && 
                jurors[juror].stakedAmount >= MIN_STAKE_REQUIRED) {
                eligible[found] = juror;
                found++;
            }
        }
        
        // Redimensionar array si no se encontraron suficientes jurados
        if (found < _count) {
            address[] memory result = new address[](found);
            for (uint256 i = 0; i < found; i++) {
                result[i] = eligible[i];
            }
            return result;
        }
        
        return eligible;
    }
    
    // View functions
    function getJurorProfile(address _juror) external view returns (JurorProfile memory) {
        return jurors[_juror];
    }
    
    function isEligibleJuror(address _juror, uint256 _minReputation) external view returns (bool) {
        return jurors[_juror].isActive && 
               jurors[_juror].reputation >= _minReputation &&
               jurors[_juror].stakedAmount >= MIN_STAKE_REQUIRED;
    }
    
    function getActiveJurorsCount() external view returns (uint256) {
        return activeJurors.length;
    }
    
    function getJurorAccuracy(address _juror) external view returns (uint256) {
        if (jurors[_juror].totalVotes == 0) return 0;
        return (jurors[_juror].correctVotes * 100) / jurors[_juror].totalVotes;
    }
    
    // Admin functions
    function addAuthorizedCaller(address _caller) external onlyOwner {
        authorizedCallers[_caller] = true;
    }
    
    function removeAuthorizedCaller(address _caller) external onlyOwner {
        authorizedCallers[_caller] = false;
    }
    
    function updateConstants(
        uint256 _minReputation,
        uint256 _reputationGain,
        uint256 _reputationLoss
    ) external onlyOwner {
        // Estas serían variables de estado en lugar de constantes para permitir actualizaciones
        // Se implementaría en una versión más avanzada
    }
}