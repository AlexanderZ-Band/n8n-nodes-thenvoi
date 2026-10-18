const { createRequire } = require('node:module');
const { join } = require('node:path');
if (!process.env.N8N_RUNTIME_ROOT)
	throw new Error('Set N8N_RUNTIME_ROOT to an isolated n8n 1.120.4 installation');
const runtimeRequire = createRequire(join(process.env.N8N_RUNTIME_ROOT, 'package.json'));
runtimeRequire('reflect-metadata');
const assert = require('node:assert/strict');
const { inspect } = require('node:util');
const { CredentialsTester } = runtimeRequire('n8n/dist/services/credentials-tester.service');
const additional = runtimeRequire('n8n/dist/workflow-execute-additional-data');
const { CredentialTestContext } = runtimeRequire('n8n-core');
const { BandTrigger } = require('../dist/nodes/BandTrigger/BandTrigger.node');
const { BandApi } = require('../dist/credentials/BandApi.credentials');
const { diagnosticContext } = require('../dist/lib/utils/logging');
const { NodeExecutionContext } = runtimeRequire(
	'n8n-core/dist/execution-engine/node-execution-context/node-execution-context',
);
const { peer, captureLogger } = require('./peer.cjs');
(async () => {
	const cleanup = [];
	const p = await peer({ after: (f) => cleanup.push(f) });
	const { logger, records } = captureLogger();
	const secret = 'runtime-synthetic-key +/&=';
	const native = new NodeExecutionContext(
		{ id: 'synthetic-workflow', name: 'synthetic', active: false },
		{ name: 'synthetic-node' },
		{ executionId: 'synthetic-execution' },
		'manual',
	);
	const view = diagnosticContext(native);
	assert.notEqual(view.logger, native.logger);
	view.logger.debug('Native execution context view validated', {
		inputLength: 1,
		ignored: 'synthetic-private-metadata',
	});
	assert.equal(view.getExecutionId(), 'synthetic-execution');
	assert.equal(view.getNode().name, 'synthetic-node');
	assert.equal(view.getWorkflow().id, 'synthetic-workflow');
	const node = new BandTrigger();
	const credentialType = new BandApi();
	assert.equal(credentialType.test, undefined);
	const original = node.methods.credentialTest.bandApiTest;
	let realContext = false;
	node.methods.credentialTest.bandApiTest = function (credentials) {
		realContext = this instanceof CredentialTestContext;
		return original.call(this, credentials);
	};
	const credentialTypes = {
		getByName: () => credentialType,
		getSupportedNodes: () => ['bandTrigger'],
		getParentTypes: () => [],
	};
	const nodeTypes = { getByName: () => node };
	const credentialsHelper = { applyDefaultsAndOverwrites: async (_, data) => data };
	// Isolate database-backed user/project metadata; dispatch/context/HTTP remain released product code.
	additional.getBase = async () => ({});
	const tester = new CredentialsTester(
		logger,
		{ error: () => {} },
		credentialTypes,
		nodeTypes,
		credentialsHelper,
	);
	assert.equal(
		tester.getCredentialTestFunction('bandApi'),
		node.methods.credentialTest.bandApiTest,
	);
	const result = await tester.testCredentials('synthetic-user', 'bandApi', {
		id: 'synthetic-id',
		name: 'synthetic',
		data: {
			apiKey: secret,
			serverUrl: p.serverUrl + '?API_KEY=legacy&token=old',
			agentId: 'agent',
			useHttps: true,
		},
	});
	assert.equal(result.status, 'OK');
	assert.equal(realContext, true);
	assert.equal(p.requests.length, 1);
	assert.equal(p.requests[0].url, '/api/v1/agent/me');
	assert.equal(p.requests[0].headers['x-api-key'], secret);
	assert.ok(!inspect([records, result], { depth: null }).includes(secret));
	console.log(
		JSON.stringify({
			n8n: runtimeRequire('n8n/package.json').version,
			n8nCore: runtimeRequire('n8n-core/package.json').version,
			credentialServiceDispatch: true,
			realCredentialTestContext: true,
			realExecutionContextView: true,
			httpHeaderOnly: true,
			legacyQueryRemoved: true,
			rawDiagnosticsClean: true,
			metadataBoundary: 'synthetic user/project defaults; no DB access',
			browserUI: 'not exercised',
		}),
	);
	for (const f of cleanup.reverse()) await f();
})()
	.then(() => process.exit(0))
	.catch(() => {
		console.error('Released n8n credential-service verification failed');
		process.exit(1);
	});
