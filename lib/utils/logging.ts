import { Logger } from 'n8n-workflow';

const LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const FACT_FIELDS = [
	'status',
	'itemIndex',
	'inputLength',
	'outputLength',
	'promptCount',
	'textLength',
] as const;

/** Node diagnostics carry fixed events and counts, never user payloads or free-form errors. */
export function diagnosticContext<T extends { logger: Logger }>(context: T): T {
	const nativeLogger = context.logger;
	// Shadow views allow overriding n8n’s immutable logger properties without mutating native contexts.
	const logger = new Proxy(Object.create(nativeLogger) as Logger, {
		get(_target, property) {
			if (typeof property === 'string' && LEVELS.has(property)) {
				return (message: string, metadata?: Record<string, unknown>) => {
					const facts = Object.fromEntries(
						FACT_FIELDS.flatMap((key) => {
							const value = metadata?.[key];
							return typeof value === 'number' && Number.isFinite(value) ? [[key, value]] : [];
						}),
					);
					const emit = Reflect.get(nativeLogger, property, nativeLogger);
					return emit.call(nativeLogger, message, facts);
				};
			}
			const value = Reflect.get(nativeLogger, property, nativeLogger);
			return typeof value === 'function' ? value.bind(nativeLogger) : value;
		},
	});
	return new Proxy(Object.create(context) as T, {
		get(_target, property) {
			if (property === 'logger') return logger;
			const value = Reflect.get(context, property, context);
			return typeof value === 'function' ? value.bind(context) : value;
		},
	});
}
