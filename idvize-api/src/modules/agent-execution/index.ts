/**
 * Agent Execution Module — Registers adapters and exports controller.
 */

import { registerAdapter } from './tool-broker.service';
import { entraAdapter } from './adapters/entra.adapter';
import { sailpointAdapter } from './adapters/sailpoint.adapter';
import { servicenowAdapter } from './adapters/servicenow.adapter';
import { appConnectorAdapter } from './adapters/app-connector.adapter';

// Register all tool adapters
registerAdapter(entraAdapter);
registerAdapter(sailpointAdapter);
registerAdapter(servicenowAdapter);
registerAdapter(appConnectorAdapter);

export { default as agentExecutionController } from './agent-execution.controller';
