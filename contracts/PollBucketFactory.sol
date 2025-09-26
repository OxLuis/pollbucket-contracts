// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PollPool.sol";
import "./ReputationSystem.sol";
import "./JurySystem.sol";
import "./PlatformGovernance.sol";

/**
 * @title PollBucketFactory
 * @dev Factory para deployar y configurar todos los contratos de PollBucket
 */
contract PollBucketFactory {
    
    struct DeployedContracts {
        address pollPool;
        address reputationSystem;
        address jurySystem;
        address platformGovernance;
        address deployer;
        uint256 deploymentTime;
    }
    
    DeployedContracts public deployedContracts;
    
    event PlatformDeployed(
        address indexed deployer,
        address pollPool,
        address reputationSystem,
        address jurySystem,
        address platformGovernance
    );
    
    /**
     * @dev Deployar toda la plataforma PollBucket
     */
    function deployPlatform() external returns (
        address pollPool,
        address reputationSystem,
        address jurySystem,
        address platformGovernance
    ) {
        // 1. Deploy ReputationSystem
        ReputationSystem repSystem = new ReputationSystem();
        
        // 2. Deploy JurySystem (necesita ReputationSystem, PollPool se setea después)
        JurySystem jury = new JurySystem(address(repSystem), address(0));
        
        // 3. Deploy PollPool (necesita ReputationSystem y JurySystem)
        PollPool pool = new PollPool(address(repSystem), address(jury));
        
        // 4. Actualizar JurySystem con la dirección de PollPool
        jury.updatePollPool(address(pool));
        
        // 5. Deploy PlatformGovernance
        PlatformGovernance governance = new PlatformGovernance(
            address(pool),
            address(repSystem),
            address(jury)
        );
        
        // 6. Configurar permisos
        repSystem.addAuthorizedCaller(address(jury));
        repSystem.transferOwnership(msg.sender);
        jury.transferOwnership(address(governance));
        pool.transferOwnership(address(governance));
        governance.transferOwnership(msg.sender);
        
        // 7. Guardar información del deployment
        deployedContracts = DeployedContracts({
            pollPool: address(pool),
            reputationSystem: address(repSystem),
            jurySystem: address(jury),
            platformGovernance: address(governance),
            deployer: msg.sender,
            deploymentTime: block.timestamp
        });
        
        emit PlatformDeployed(
            msg.sender,
            address(pool),
            address(repSystem),
            address(jury),
            address(governance)
        );
        
        return (
            address(pool),
            address(repSystem),
            address(jury),
            address(governance)
        );
    }
    
    /**
     * @dev Obtener direcciones de contratos deployados
     */
    function getDeployedContracts() external view returns (DeployedContracts memory) {
        return deployedContracts;
    }
}