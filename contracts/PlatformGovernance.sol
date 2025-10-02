// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IPollPool.sol";
import "./interfaces/IReputationSystem.sol";
import "./interfaces/IJurySystem.sol";

/**
 * @title PlatformGovernance
 * @dev Contrato de administración y configuración de la plataforma PollBucket
 */
contract PlatformGovernance is Ownable, Pausable {
    
    struct PlatformMetrics {
        uint256 totalPools;
        uint256 activePools;
        uint256 totalVolume;
        uint256 totalJurors;
        uint256 totalValidations;
        uint256 platformRevenue;
    }
    
    struct PlatformConfig {
        uint256 minimumStake;
        uint256 platformFee;
        uint256 maxCreatorCommission;
        uint256 minReputationForJury;
        uint256 validationPeriod;
        uint256 jurorReward;
        bool emergencyMode;
    }
    
    IPollPool public pollPool;
    IReputationSystem public reputationSystem;
    IJurySystem public jurySystem;
    
    PlatformConfig public config;
    PlatformMetrics public metrics;
    
    mapping(address => bool) public administrators;
    mapping(uint256 => bool) public suspendedPools;
    
    // Events
    event ConfigUpdated(string parameter, uint256 oldValue, uint256 newValue);
    event AdministratorAdded(address indexed admin);
    event AdministratorRemoved(address indexed admin);
    event PoolSuspended(uint256 indexed poolId, string reason);
    event EmergencyModeToggled(bool enabled);
    event MetricsUpdated();
    
    modifier onlyAdmin() {
        require(administrators[msg.sender] || msg.sender == owner(), "No es administrador");
        _;
    }
    
    modifier notInEmergency() {
        require(!config.emergencyMode, "Modo de emergencia activo");
        _;
    }
    
    constructor(
        address _pollPool,
        address _reputationSystem,
        address _jurySystem
    ) {
        pollPool = IPollPool(_pollPool);
        reputationSystem = IReputationSystem(_reputationSystem);
        jurySystem = IJurySystem(_jurySystem);
        
        // Configuración inicial
        config = PlatformConfig({
            minimumStake: 0.1 ether,
            platformFee: 300, // 3%
            maxCreatorCommission: 1000, // 10%
            minReputationForJury: 75,
            validationPeriod: 24 hours,
            jurorReward: 0.01 ether,
            emergencyMode: false
        });
        
        administrators[msg.sender] = true;
    }
    
    /**
     * @dev Actualizar configuración de la plataforma
     */
    function updateMinimumStake(uint256 _newStake) external onlyAdmin {
        uint256 oldValue = config.minimumStake;
        config.minimumStake = _newStake;
        emit ConfigUpdated("minimumStake", oldValue, _newStake);
    }
    
    function updatePlatformFee(uint256 _newFee) external onlyAdmin {
        require(_newFee <= 1000, "Fee maximo 10%");
        uint256 oldValue = config.platformFee;
        config.platformFee = _newFee;
        emit ConfigUpdated("platformFee", oldValue, _newFee);
    }
    
    function updateMaxCreatorCommission(uint256 _newMax) external onlyAdmin {
        require(_newMax <= 2000, "Comision maxima 20%");
        uint256 oldValue = config.maxCreatorCommission;
        config.maxCreatorCommission = _newMax;
        emit ConfigUpdated("maxCreatorCommission", oldValue, _newMax);
    }    
/**
     * @dev Suspender un pool específico
     */
    function suspendPool(uint256 _poolId, string memory _reason) external onlyAdmin {
        suspendedPools[_poolId] = true;
        emit PoolSuspended(_poolId, _reason);
    }
    
    /**
     * @dev Reactivar un pool suspendido
     */
    function reactivatePool(uint256 _poolId) external onlyAdmin {
        suspendedPools[_poolId] = false;
    }
    
    /**
     * @dev Activar/desactivar modo de emergencia
     */
    function toggleEmergencyMode() external onlyOwner {
        config.emergencyMode = !config.emergencyMode;
        
        if (config.emergencyMode) {
            _pause();
        } else {
            _unpause();
        }
        
        emit EmergencyModeToggled(config.emergencyMode);
    }
    
    /**
     * @dev Agregar administrador
     */
    function addAdministrator(address _admin) external onlyOwner {
        administrators[_admin] = true;
        emit AdministratorAdded(_admin);
    }
    
    /**
     * @dev Remover administrador
     */
    function removeAdministrator(address _admin) external onlyOwner {
        administrators[_admin] = false;
        emit AdministratorRemoved(_admin);
    }
    
    /**
     * @dev Actualizar métricas de la plataforma
     */
    function updateMetrics() external onlyAdmin {
        // En una implementación real, estas métricas se calcularían
        // basándose en eventos y estado de los contratos
        
        metrics.totalJurors = reputationSystem.getActiveJurorsCount();
        
        // Las otras métricas requerirían funciones adicionales en los contratos
        // o un sistema de indexación de eventos
        
        emit MetricsUpdated();
    }
    
    /**
     * @dev Retirar fondos de la plataforma (solo owner)
     */
    function withdrawPlatformFunds(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Fondos insuficientes");
        payable(owner()).transfer(_amount);
    }
    
    /**
     * @dev Función de emergencia para pausar toda la plataforma
     */
    function emergencyPause() external onlyAdmin {
        _pause();
        config.emergencyMode = true;
        emit EmergencyModeToggled(true);
    }
    
    /**
     * @dev Reanudar operaciones después de emergencia
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
        config.emergencyMode = false;
        emit EmergencyModeToggled(false);
    }
    
    // View functions
    function getPlatformConfig() external view returns (PlatformConfig memory) {
        return config;
    }
    
    function getPlatformMetrics() external view returns (PlatformMetrics memory) {
        return metrics;
    }
    
    function isPoolSuspended(uint256 _poolId) external view returns (bool) {
        return suspendedPools[_poolId];
    }
    
    function isAdministrator(address _user) external view returns (bool) {
        return administrators[_user];
    }
    
    /**
     * @dev Obtener estadísticas detalladas de la plataforma
     */
    function getDetailedStats() external view returns (
        uint256 totalPools,
        uint256 activePools,
        uint256 totalVolume,
        uint256 totalJurors,
        uint256 platformRevenue,
        bool emergencyMode
    ) {
        return (
            metrics.totalPools,
            metrics.activePools,
            metrics.totalVolume,
            metrics.totalJurors,
            metrics.platformRevenue,
            config.emergencyMode
        );
    }
    
    /**
     * @dev Verificar salud del sistema
     */
    function getSystemHealth() external view returns (
        bool isHealthy,
        string memory status,
        uint256 activeJurors,
        bool emergencyMode
    ) {
        uint256 jurorCount = reputationSystem.getActiveJurorsCount();
        bool healthy = jurorCount >= 10 && !config.emergencyMode;
        
        string memory statusMsg = healthy ? "Sistema operativo" : "Requiere atencion";
        
        return (healthy, statusMsg, jurorCount, config.emergencyMode);
    }
    
    // Funciones de actualización de contratos
    function updatePollPool(address _newPollPool) external onlyOwner {
        pollPool = IPollPool(_newPollPool);
    }
    
    function updateReputationSystem(address _newReputationSystem) external onlyOwner {
        reputationSystem = IReputationSystem(_newReputationSystem);
    }
    
    function updateJurySystem(address _newJurySystem) external onlyOwner {
        jurySystem = IJurySystem(_newJurySystem);
    }
    
    // Función para recibir AVAX
    receive() external payable {
        metrics.platformRevenue += msg.value;
    }
    
    fallback() external payable {
        metrics.platformRevenue += msg.value;
    }
}