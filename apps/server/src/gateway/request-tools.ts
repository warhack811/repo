import type {
	ModelCallableTool,
	ModelCallableToolArrayParameter,
	ModelCallableToolParameter,
	ModelCallableToolScalarParameter,
} from '@runa/types';

interface JsonSchemaScalarProperty {
	readonly description?: string;
	readonly type: ModelCallableToolScalarParameter['type'];
}

interface JsonSchemaArrayProperty {
	readonly description?: string;
	readonly items: {
		readonly type: ModelCallableToolArrayParameter['items']['type'];
	};
	readonly type: 'array';
}

export type ToolJsonSchemaProperty = JsonSchemaArrayProperty | JsonSchemaScalarProperty;

export interface ToolJsonSchemaObject {
	readonly properties: Readonly<Record<string, ToolJsonSchemaProperty>>;
	readonly required?: readonly string[];
	readonly type: 'object';
}

function toJsonSchemaProperty(parameter: ModelCallableToolParameter): ToolJsonSchemaProperty {
	if (parameter.type === 'array') {
		return {
			description: parameter.description,
			items: {
				type: parameter.items.type,
			},
			type: 'array',
		};
	}

	return {
		description: parameter.description,
		type: parameter.type,
	};
}

export function buildToolJsonSchema(tool: ModelCallableTool): ToolJsonSchemaObject {
	const parameters = tool.parameters ?? {};
	const properties = Object.fromEntries(
		Object.entries(parameters).map(([name, parameter]) => [name, toJsonSchemaProperty(parameter)]),
	);
	const required = Object.entries(parameters)
		.filter(([, parameter]) => parameter.required === true)
		.map(([name]) => name);

	return {
		properties,
		required: required.length > 0 ? required : undefined,
		type: 'object',
	};
}
