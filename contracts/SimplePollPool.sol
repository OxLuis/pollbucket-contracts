// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimplePollPool
 * @dev Contrato simplificado para crear y manejar pools de preguntas sin sistema de jurados
 */
contract SimplePollPool is ReentrancyGuard, Ownable {
    enum PoolStatus {
        Open,
        Closed,
        Resolved,
        Cancelled
    }

    struct Pool {
        uint256 id;
        address creator;
        string question;
        string[] options;
        uint256 openTime;
        uint256 closeTime;
        uint256 totalStake;
        uint256 creatorCommission; // Porcentaje en basis points (100 = 1%)
        PoolStatus status;
        uint256 winningOption;
        bool rewardsDistributed;
        uint256 maxParticipants; // Máximo número de participantes
        uint256 currentParticipants; // Número actual de participantes
        uint256 fixedBetAmount; // Monto fijo que todos deben pagar para votar
    }

    struct Bet {
        address bettor;
        uint256 amount;
        uint256 option;
        uint256 timestamp;
    }

    // State variables
    uint256 public nextPoolId = 1;
    uint256 public minimumFixedBetAmount = 0.05 ether; // Monto mínimo configurable por owner
    uint256 public platformFee = 300; // 3% in basis points
    uint256 public creatorCommission = 500; // 5% in basis points - solo owner puede modificar
    uint256 public transactionFee = 200; // 2% in basis points - comisión de transacción configurable por owner
    address public feeRecipient; // Dirección donde se depositarán las comisiones de transacción

    mapping(uint256 => Pool) public pools;
    mapping(uint256 => Bet[]) public poolBets;
    mapping(uint256 => mapping(uint256 => uint256)) public optionTotals; // poolId => option => total
    mapping(address => uint256[]) public userPools;
    mapping(address => mapping(uint256 => uint256[])) public userBets; // user => poolId => betIds
    mapping(uint256 => mapping(address => bool)) public poolParticipants; // poolId => user => hasParticipated

    // Para identificación y búsqueda de pools
    uint256[] public allPoolIds; // Array de todos los IDs de pools
    mapping(PoolStatus => uint256[]) public poolsByStatus; // Pools por estado
    mapping(address => uint256[]) public poolsByCreator; // Pools por creador

    // Events
    event PoolCreated(uint256 indexed poolId, address indexed creator, string question);
    event BetPlaced(uint256 indexed poolId, address indexed bettor, uint256 option, uint256 amount);
    event PoolClosed(uint256 indexed poolId);
    event PoolResolved(uint256 indexed poolId, uint256 winningOption);
    event RewardsDistributed(uint256 indexed poolId, uint256 totalRewards);
    event MinimumFixedBetAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event TransactionFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event TransactionFeeCollected(address indexed recipient, uint256 amount);

    constructor() {
        // Constructor vacío - no necesita otros contratos
        feeRecipient = msg.sender; // Por defecto, la dirección que despliega el contrato
    }

    /**
     * @dev Crear un nuevo pool de preguntas
     * @param _question Texto de la pregunta
     * @param _options Array de opciones de respuesta
     * @param _closeTime Timestamp de cierre del pool
     * @param _maxParticipants Máximo número de participantes (0 = sin límite)
     * @param _fixedBetAmount Monto fijo que todos deben pagar para votar
     */
    function createPool(
        string memory _question,
        string[] memory _options,
        uint256 _closeTime,
        uint256 _maxParticipants,
        uint256 _fixedBetAmount
    ) external payable nonReentrant {
        require(_fixedBetAmount >= minimumFixedBetAmount, "Monto fijo debe ser >= monto minimo establecido");
        require(_options.length >= 2, "Minimo 2 opciones requeridas");
        require(_closeTime > block.timestamp, "Tiempo de cierre debe ser futuro");
        require(_maxParticipants == 0 || _maxParticipants >= 2, "Minimo 2 participantes si hay limite");

        // Calcular comisión y monto total requerido
        (uint256 feeAmount, uint256 totalRequired) = _calculateTransactionFee(_fixedBetAmount);
        require(
            msg.value == totalRequired,
            "Debe pagar el monto fijo + comision de transaccion"
        );

        // Transferir comisión
        _transferTransactionFee(feeAmount);

        uint256 poolId = nextPoolId++;

        pools[poolId] = Pool({
            id: poolId,
            creator: msg.sender,
            question: _question,
            options: _options,
            openTime: block.timestamp,
            closeTime: _closeTime,
            totalStake: _fixedBetAmount,
            creatorCommission: creatorCommission,
            status: PoolStatus.Open,
            winningOption: 0,
            rewardsDistributed: false,
            maxParticipants: _maxParticipants,
            currentParticipants: 1,
            fixedBetAmount: _fixedBetAmount
        });

        // Registrar pool para búsqueda e identificación
        allPoolIds.push(poolId);
        poolsByStatus[PoolStatus.Open].push(poolId);
        poolsByCreator[msg.sender].push(poolId);

        // Registrar la apuesta inicial del creador (opción 0 por defecto)
        poolBets[poolId].push(
            Bet({
                bettor: msg.sender,
                amount: _fixedBetAmount,
                option: 0,
                timestamp: block.timestamp
            })
        );

        optionTotals[poolId][0] += _fixedBetAmount;
        userPools[msg.sender].push(poolId);
        userBets[msg.sender][poolId].push(0);
        poolParticipants[poolId][msg.sender] = true;

        emit PoolCreated(poolId, msg.sender, _question);
    }

    /**
     * @dev Apostar en un pool existente
     * @param _poolId ID del pool
     * @param _option Opción seleccionada
     */
    function placeBet(uint256 _poolId, uint256 _option) external payable nonReentrant {
        Pool storage pool = pools[_poolId];
        require(pool.status == PoolStatus.Open, "Pool no esta abierto");
        require(block.timestamp < pool.closeTime, "Pool cerrado");
        require(_option < pool.options.length, "Opcion invalida");

        // Calcular comisión y monto total requerido
        (uint256 feeAmount, uint256 totalRequired) = _calculateTransactionFee(pool.fixedBetAmount);
        require(
            msg.value == totalRequired,
            "Debe pagar el monto fijo + comision de transaccion"
        );

        // Transferir comisión
        _transferTransactionFee(feeAmount);

        // Verificar límite de participantes
        bool isNewParticipant = !poolParticipants[_poolId][msg.sender];
        if (isNewParticipant && pool.maxParticipants > 0) {
            require(pool.currentParticipants < pool.maxParticipants, "Pool lleno");
        }

        uint256 betId = poolBets[_poolId].length;

        poolBets[_poolId].push(
            Bet({
                bettor: msg.sender,
                amount: pool.fixedBetAmount,
                option: _option,
                timestamp: block.timestamp
            })
        );

        pool.totalStake += pool.fixedBetAmount;
        optionTotals[_poolId][_option] += pool.fixedBetAmount;
        userBets[msg.sender][_poolId].push(betId);

        // Registrar nuevo participante si es necesario
        if (isNewParticipant) {
            poolParticipants[_poolId][msg.sender] = true;
            pool.currentParticipants++;
        }

        emit BetPlaced(_poolId, msg.sender, _option, pool.fixedBetAmount);
    }

    /**
     * @dev Apostar múltiples veces en un pool (misma opción o diferentes)
     * @param _poolId ID del pool
     * @param _options Array de opciones seleccionadas (puede repetirse la misma opción)
     * @notice El monto total debe ser igual a fixedBetAmount * cantidad de opciones
     */
    function placeMultipleBets(
        uint256 _poolId,
        uint256[] memory _options
    ) external payable nonReentrant {
        require(_options.length > 0, "Debe especificar al menos una opcion");
        
        Pool storage pool = pools[_poolId];
        require(pool.status == PoolStatus.Open, "Pool no esta abierto");
        require(block.timestamp < pool.closeTime, "Pool cerrado");
        
        uint256 totalBetAmount = pool.fixedBetAmount * _options.length;
        
        // Calcular comisión y monto total requerido
        (uint256 feeAmount, uint256 totalRequired) = _calculateTransactionFee(totalBetAmount);
        require(
            msg.value == totalRequired,
            "Debe pagar (fixedBetAmount * cantidad) + comision de transaccion"
        );

        // Transferir comisión (una sola vez para toda la transacción)
        _transferTransactionFee(feeAmount);

        // Verificar límite de participantes solo para el primer voto si es nuevo participante
        bool isNewParticipant = !poolParticipants[_poolId][msg.sender];
        if (isNewParticipant && pool.maxParticipants > 0) {
            require(
                pool.currentParticipants < pool.maxParticipants,
                "Pool lleno"
            );
        }

        // Validar todas las opciones
        for (uint256 i = 0; i < _options.length; i++) {
            require(_options[i] < pool.options.length, "Opcion invalida");
        }

        // Registrar todas las apuestas (cada una con el fixedBetAmount completo)
        for (uint256 i = 0; i < _options.length; i++) {
            uint256 betId = poolBets[_poolId].length;

            poolBets[_poolId].push(
                Bet({
                    bettor: msg.sender,
                    amount: pool.fixedBetAmount,
                    option: _options[i],
                    timestamp: block.timestamp
                })
            );

            pool.totalStake += pool.fixedBetAmount;
            optionTotals[_poolId][_options[i]] += pool.fixedBetAmount;
            userBets[msg.sender][_poolId].push(betId);

            emit BetPlaced(_poolId, msg.sender, _options[i], pool.fixedBetAmount);
        }

        // Registrar nuevo participante si es necesario (solo una vez)
        if (isNewParticipant) {
            poolParticipants[_poolId][msg.sender] = true;
            pool.currentParticipants++;
        }
    }

    /**
     * @dev Cerrar un pool (solo creador o cuando expire el tiempo)
     * @param _poolId ID del pool a cerrar
     */
    function closePool(uint256 _poolId) external {
        Pool storage pool = pools[_poolId];
        require(
            msg.sender == pool.creator || block.timestamp >= pool.closeTime,
            "Solo creador o tiempo vencido"
        );
        require(pool.status == PoolStatus.Open, "Pool ya cerrado");

        pool.status = PoolStatus.Closed;

        // Actualizar tracking de estados
        _updatePoolStatusTracking(_poolId, PoolStatus.Open, PoolStatus.Closed);

        emit PoolClosed(_poolId);
    }

    /**
     * @dev Resolver pool estableciendo la opción ganadora (solo creador)
     * @param _poolId ID del pool
     * @param _winningOption Opción ganadora
     */
    function resolvePool(uint256 _poolId, uint256 _winningOption) external {
        Pool storage pool = pools[_poolId];
        require(msg.sender == pool.creator, "Solo el creador puede resolver");
        require(pool.status == PoolStatus.Closed, "Pool debe estar cerrado");
        require(_winningOption < pool.options.length, "Opcion invalida");

        pool.status = PoolStatus.Resolved;
        pool.winningOption = _winningOption;

        // Actualizar tracking de estados
        _updatePoolStatusTracking(_poolId, PoolStatus.Closed, PoolStatus.Resolved);

        emit PoolResolved(_poolId, _winningOption);
    }    
/**
     * @dev Distribuir recompensas a los ganadores
     * @param _poolId ID del pool
     */
    function distributeRewards(uint256 _poolId) external nonReentrant {
        Pool storage pool = pools[_poolId];
        require(pool.status == PoolStatus.Resolved, "Pool no resuelto");
        require(!pool.rewardsDistributed, "Recompensas ya distribuidas");

        uint256 totalPot = pool.totalStake;
        uint256 platformFeeAmount = (totalPot * platformFee) / 10000;
        uint256 creatorFeeAmount = (totalPot * pool.creatorCommission) / 10000;
        uint256 availableRewards = totalPot - platformFeeAmount - creatorFeeAmount;

        uint256 winningTotal = optionTotals[_poolId][pool.winningOption];
        require(winningTotal > 0, "No hay ganadores");

        // Distribuir a ganadores
        Bet[] memory bets = poolBets[_poolId];
        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].option == pool.winningOption) {
                uint256 reward = (bets[i].amount * availableRewards) / winningTotal;
                payable(bets[i].bettor).transfer(reward);
            }
        }

        // Pagar comisiones
        if (creatorFeeAmount > 0) {
            payable(pool.creator).transfer(creatorFeeAmount);
        }

        if (platformFeeAmount > 0) {
            payable(owner()).transfer(platformFeeAmount);
        }

        pool.rewardsDistributed = true;
        emit RewardsDistributed(_poolId, availableRewards);
    }

    /**
     * @dev Función helper para calcular la comisión basada en el monto deseado
     * @param _desiredAmount Monto que el usuario quiere apostar (sin comisión)
     * @return feeAmount Monto de la comisión
     * @return totalRequired Monto total que el usuario debe enviar (monto deseado + comisión)
     */
    function _calculateTransactionFee(uint256 _desiredAmount) internal view returns (uint256 feeAmount, uint256 totalRequired) {
        if (transactionFee > 0 && _desiredAmount > 0) {
            feeAmount = (_desiredAmount * transactionFee) / 10000;
            totalRequired = _desiredAmount + feeAmount;
        } else {
            feeAmount = 0;
            totalRequired = _desiredAmount;
        }
    }

    /**
     * @dev Función helper para transferir la comisión de transacción
     * @param _feeAmount Monto de la comisión a transferir
     */
    function _transferTransactionFee(uint256 _feeAmount) internal {
        if (_feeAmount > 0) {
            address recipient = feeRecipient != address(0) ? feeRecipient : owner();
            payable(recipient).transfer(_feeAmount);
            emit TransactionFeeCollected(recipient, _feeAmount);
        }
    }

    /**
     * @dev Función helper para actualizar tracking de estados
     */
    function _updatePoolStatusTracking(uint256 _poolId, PoolStatus _oldStatus, PoolStatus _newStatus) internal {
        // Remover del array del estado anterior
        uint256[] storage oldStatusArray = poolsByStatus[_oldStatus];
        for (uint256 i = 0; i < oldStatusArray.length; i++) {
            if (oldStatusArray[i] == _poolId) {
                oldStatusArray[i] = oldStatusArray[oldStatusArray.length - 1];
                oldStatusArray.pop();
                break;
            }
        }

        // Agregar al array del nuevo estado
        poolsByStatus[_newStatus].push(_poolId);
    }

    // View functions
    function getPool(uint256 _poolId) external view returns (Pool memory) {
        return pools[_poolId];
    }

    function getPoolBets(uint256 _poolId) external view returns (Bet[] memory) {
        return poolBets[_poolId];
    }

    function getUserPools(address _user) external view returns (uint256[] memory) {
        return userPools[_user];
    }

    function getUserBets(address _user, uint256 _poolId) external view returns (uint256[] memory) {
        return userBets[_user][_poolId];
    }

    function hasUserParticipated(uint256 _poolId, address _user) external view returns (bool) {
        return poolParticipants[_poolId][_user];
    }

    function getPoolParticipantCount(uint256 _poolId) external view returns (uint256, uint256) {
        Pool memory pool = pools[_poolId];
        return (pool.currentParticipants, pool.maxParticipants);
    }

    function getAllPoolIds() external view returns (uint256[] memory) {
        return allPoolIds;
    }

    function getPoolsByStatus(PoolStatus _status) external view returns (uint256[] memory) {
        return poolsByStatus[_status];
    }

    function getPoolsByCreator(address _creator) external view returns (uint256[] memory) {
        return poolsByCreator[_creator];
    }

    function getTotalPoolsCount() external view returns (uint256) {
        return allPoolIds.length;
    }

    function getActivePoolsCount() external view returns (uint256) {
        return poolsByStatus[PoolStatus.Open].length;
    }

    function getPoolFixedBetAmount(uint256 _poolId) external view returns (uint256) {
        return pools[_poolId].fixedBetAmount;
    }

    /**
     * @dev Obtener información completa de un pool
     */
    function getPoolInfo(uint256 _poolId) external view returns (
        uint256 totalAvax,
        uint256 currentParticipants,
        uint256 maxParticipants,
        uint256 daysRemaining,
        uint256 hoursRemaining,
        uint256 minutesRemaining,
        PoolStatus status,
        uint256 fixedBetAmount
    ) {
        Pool memory pool = pools[_poolId];
        
        totalAvax = pool.totalStake;
        currentParticipants = pool.currentParticipants;
        maxParticipants = pool.maxParticipants;
        status = pool.status;
        fixedBetAmount = pool.fixedBetAmount;
        
        // Calcular tiempo restante solo si el pool está abierto
        if (pool.status == PoolStatus.Open && block.timestamp < pool.closeTime) {
            uint256 timeRemaining = pool.closeTime - block.timestamp;
            daysRemaining = timeRemaining / 86400;
            hoursRemaining = (timeRemaining % 86400) / 3600;
            minutesRemaining = (timeRemaining % 3600) / 60;
        } else {
            daysRemaining = 0;
            hoursRemaining = 0;
            minutesRemaining = 0;
        }
    }

    // Admin functions
    function setMinimumFixedBetAmount(uint256 _minimumFixedBetAmount) external onlyOwner {
        require(_minimumFixedBetAmount > 0, "Monto minimo debe ser mayor a 0");
        uint256 oldAmount = minimumFixedBetAmount;
        minimumFixedBetAmount = _minimumFixedBetAmount;
        emit MinimumFixedBetAmountUpdated(oldAmount, _minimumFixedBetAmount);
    }

    function setTransactionFee(uint256 _transactionFee) external onlyOwner {
        require(_transactionFee <= 1000, "Comision maxima 10%");
        uint256 oldFee = transactionFee;
        transactionFee = _transactionFee;
        emit TransactionFeeUpdated(oldFee, _transactionFee);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Direccion no puede ser cero");
        address oldRecipient = feeRecipient;
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
    }

    /**
     * @dev Calcular el monto total requerido para apostar un monto deseado (incluyendo comisión)
     * @param _desiredAmount Monto que se desea apostar
     * @return totalRequired Monto total que debe enviarse (monto deseado + comisión)
     * @return feeAmount Monto de la comisión
     */
    function calculateRequiredAmount(uint256 _desiredAmount) external view returns (uint256 totalRequired, uint256 feeAmount) {
        (feeAmount, totalRequired) = _calculateTransactionFee(_desiredAmount);
    }

    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 1000, "Fee maximo 10%");
        platformFee = _platformFee;
    }

    function setCreatorCommission(uint256 _creatorCommission) external onlyOwner {
        require(_creatorCommission <= 1000, "Comision maxima 10%");
        creatorCommission = _creatorCommission;
    }

    function emergencyPause(uint256 _poolId) external onlyOwner {
        Pool storage pool = pools[_poolId];
        PoolStatus oldStatus = pool.status;
        pool.status = PoolStatus.Cancelled;

        // Actualizar tracking si no estaba ya cancelado
        if (oldStatus != PoolStatus.Cancelled) {
            _updatePoolStatusTracking(_poolId, oldStatus, PoolStatus.Cancelled);
        }
    }

    // Función para recibir AVAX
    receive() external payable {}
}