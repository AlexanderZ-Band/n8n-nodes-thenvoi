import { diagnosticContext } from '@lib/utils/logging';
import { ITriggerFunctions, ITriggerResponse, NodeOperationError } from 'n8n-workflow';
import { testBandCredentials } from '@lib/utils/authValidation';
import { nodeDescription } from './config/nodeConfig';
import { initializeRoomModeTrigger } from './handlers/events/roomModes/roomModeController';
import { BandCredentials } from '@lib/types';
import { getTriggerConfig } from './utils/configFactory';
import { getSafeErrorMessage, logError, validateBandAuth } from '@lib/utils';
import { validateConfig, validateCredentials } from './utils/validation';
import { RoomManager } from './managers/RoomManager';

export class BandTrigger {
	description = nodeDescription;

	methods = { credentialTest: { bandApiTest: testBandCredentials } };

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const context = diagnosticContext(this);
		try {
			const credentials = (await context.getCredentials('bandApi')) as BandCredentials;
			validateCredentials(credentials, context);
			await validateBandAuth(context, credentials);

			const config = getTriggerConfig(context, credentials.agentId);
			validateConfig(config, context);

			const roomManager = new RoomManager(config, context, credentials);
			return await initializeRoomModeTrigger(roomManager);
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}

			logError(context.logger, 'Band Trigger: Failed to initialize', error);

			throw new NodeOperationError(
				context.getNode(),
				`Failed to initialize Band trigger: ${getSafeErrorMessage(error)}`,
			);
		}
	}
}
