import * as _ from 'lodash';

import {
	AbstractSqlModel,
	AliasNode,
	BooleanTypeNodes,
	CastNode,
	ConcatenateNode,
	ConcatenateWithSeparatorNode,
	NullNode,
	NumberTypeNodes,
	ReferencedFieldNode,
	Relationship,
	RelationshipInternalNode,
	SelectNode,
	SelectQueryNode,
	TextTypeNodes,
	UnknownTypeNodes,
} from './AbstractSQLCompiler';

interface Dictionary<T> {
	[key: string]: T;
}

export type AliasValidNodeType =
	| ReferencedFieldNode
	| SelectQueryNode
	| NumberTypeNodes
	| BooleanTypeNodes
	| UnknownTypeNodes
	| NullNode;

export const aliasFields = (
	abstractSqlModel: AbstractSqlModel,
	resourceName: string,
	aliases: Dictionary<string | AliasValidNodeType>,
): SelectNode[1] => {
	const fieldNames = abstractSqlModel.tables[resourceName].fields.map(
		({ fieldName }) => fieldName,
	);
	const nonexistentFields = _.difference(Object.keys(aliases), fieldNames, [
		'$toResource',
	]);
	if (nonexistentFields.length > 0) {
		throw new Error(
			`Tried to alias non-existent fields: '${nonexistentFields.join(', ')}'`,
		);
	}
	return fieldNames.map(
		(fieldName): AliasNode<AliasValidNodeType> | ReferencedFieldNode => {
			const alias = aliases[fieldName];
			if (alias) {
				if (typeof alias === 'string') {
					return ['Alias', ['ReferencedField', resourceName, alias], fieldName];
				}
				return ['Alias', alias, fieldName];
			}
			return ['ReferencedField', resourceName, fieldName];
		},
	);
};

const $aliasRelationships = (
	relationships: Relationship,
	resourceRegex: RegExp,
	toResourceName: string,
	inAliasingScope = false,
) => {
	if (Array.isArray(relationships.$) && relationships.$.length === 2) {
		const mapping = relationships.$;
		if (resourceRegex.test(mapping[1]![0])) {
			mapping[1]![0] = mapping[1]![0].replace(
				resourceRegex,
				`$1${toResourceName}$3`,
			);
			if (resourceRegex.test(mapping[0])) {
				mapping[0] = mapping[0].replace(resourceRegex, `$1${toResourceName}$3`);
			}

			relationships.$ = mapping;
		}
		if (inAliasingScope && resourceRegex.test(mapping[1]![1])) {
			mapping[1]![1] = mapping[1]![1].replace(
				resourceRegex,
				`$1${toResourceName}$3`,
			);
		}
	}
	_.forEach(relationships, (relationshipOrMapping, key) => {
		if (key === '$') {
			return;
		}
		let relationship = relationshipOrMapping as Relationship;
		const parentRelationships = relationships as RelationshipInternalNode;

		let startedAliasing = false;
		if (resourceRegex.test(key)) {
			relationship = _.cloneDeep(relationship);
			const aliasedKey = key.replace(resourceRegex, `$1${toResourceName}$3`);

			parentRelationships[aliasedKey] = relationship;
			// When have previously aliased the root of the current relation subtree,
			// remove unneeded references to the original resource, to completely replace it.
			if (inAliasingScope) {
				delete parentRelationships[key];
			}
			startedAliasing = true;
		}

		$aliasRelationships(
			relationship,
			resourceRegex,
			toResourceName,
			inAliasingScope || startedAliasing,
		);
	});
};

export const aliasRelationships = (
	relationships: Relationship,
	resourceName: string,
	toResourceName: string,
) =>
	$aliasRelationships(
		relationships,
		new RegExp(`(^|-)(${resourceName})(-|$)`, 'g'),
		toResourceName,
	);

export const renameField = (
	abstractSqlModel: AbstractSqlModel,
	resourceName: string,
	path: string[],
	from: string,
	to: string,
) => {
	for (const field of abstractSqlModel.tables[resourceName].fields) {
		if (field.fieldName === from) {
			field.fieldName = to;
		}
	}
	for (const index of abstractSqlModel.tables[resourceName].indexes) {
		index.fields = index.fields.map((field) => {
			if (field === from) {
				return to;
			}
			return field;
		});
	}

	const relationship = abstractSqlModel.relationships[resourceName];

	const orig = _.get(relationship, path);
	orig[to] = orig[from];
	delete orig[from];

	_.set(relationship, to, relationship[from]);
	delete relationship[from];
	_.set(relationship, [to, '$'], [to]);
};

export const renameResourceField = (
	abstractSql: AbstractSqlModel,
	resource: string,
	fromFieldName: string,
	toFieldName: string,
) => {
	renameField(
		abstractSql,
		`${resource}-has-${fromFieldName}`,
		[...resource.split('-'), 'has'],
		fromFieldName,
		toFieldName,
	);
	renameField(
		abstractSql,
		`${resource}-has-${fromFieldName}`,
		['has'],
		fromFieldName,
		toFieldName,
	);
};

const sqlConcatFactory = (
	...transformers: Array<
		(node: TextTypeNodes | string) => TextTypeNodes | string
	>
) => {
	return function sqlConcat(
		[start, ...strings]: TemplateStringsArray,
		...nodes: Array<TextTypeNodes | string>
	) {
		const concats: ConcatenateNode = ['Concatenate'];
		const addNode = (node: (typeof nodes)[number]) => {
			node = transformers.reduce((acc, transformer) => transformer(acc), node);
			if (typeof node === 'string') {
				if (node.length > 0) {
					concats.push(['EmbeddedText', node]);
				}
			} else {
				concats.push(node);
			}
		};
		addNode(start);
		for (let i = 0; i < strings.length; i++) {
			addNode(nodes[i]);
			addNode(strings[i]);
		}

		return concats;
	};
};

// ~Similar to oneLineTrim from common-tags
export const oneLineTrimSqlConcat = sqlConcatFactory((node) =>
	typeof node === 'string' ? node.replace(/\s*\n\s*/g, '') : node,
);

export const splitStringParts = (field: UnknownTypeNodes, separator = '.') =>
	oneLineTrimSqlConcat`"${[
		'Replace',
		field,
		['EmbeddedText', separator],
		['EmbeddedText', '","'],
	]}"`;

export const joinTextParts = (
	separator: string,
	...parts: Array<[showPart: BooleanTypeNodes, partValue: UnknownTypeNodes]>
): ConcatenateWithSeparatorNode => {
	if (parts.length < 2) {
		throw new Error('joinTextParts requires at least two parts to join');
	}
	return [
		'ConcatenateWithSeparator',
		['EmbeddedText', separator],
		...parts.map(
			([showPart, partValue]): CastNode => [
				'Cast',
				['Case', ['When', showPart, partValue], ['Else', ['Null']]],
				'Text',
			],
		),
	];
};

export const joinTextPartsAndPrefix = (
	prefix: string,
	separator: string,
	...parts: Array<[showPart: BooleanTypeNodes, partValue: UnknownTypeNodes]>
): ConcatenateNode | ConcatenateWithSeparatorNode => {
	const joinedParts = joinTextParts(separator, ...parts);
	if (prefix === '') {
		return joinedParts;
	}

	return [
		'Concatenate',
		[
			'Cast',
			[
				'Case',
				[
					'When',
					['Or', ...parts.map(([showPart]) => showPart)],
					['EmbeddedText', prefix],
				],
				['Else', ['EmbeddedText', '']],
			],
			'Text',
		],
		joinedParts,
	];
};

export const overrideFieldType = (
	abstractSqlModel: AbstractSqlModel,
	resourceName: string,
	fieldName: string,
	newFieldType: string,
) => {
	const targetField = abstractSqlModel.tables[resourceName].fields.find(
		(field) => field.fieldName === fieldName,
	);
	if (targetField == null) {
		throw new Error(
			`Could not find field "${fieldName}" on resource "${resourceName}" while trying to change its type to "${newFieldType}"`,
		);
	}
	if (targetField.dataType === newFieldType) {
		throw new Error(
			`Field "${fieldName}" on resource "${resourceName}" is already of type "${newFieldType}"`,
		);
	}
	targetField.dataType = newFieldType;
};

export const reduceDecimalStringAccuracy = (
	resourceName: string,
	fieldName: string,
	targetAccuracy: number,
): UnknownTypeNodes => [
	'Case',
	[
		'When',
		[
			'Equals',
			[
				'Coalesce',
				['ReferencedField', resourceName, fieldName],
				['EmbeddedText', ''],
			],
			['EmbeddedText', ''],
		],
		['ReferencedField', resourceName, fieldName],
	],
	[
		'Else',
		[
			'Cast',
			[
				'Divide',
				[
					'Round',
					[
						'Multiply',
						['Cast', ['ReferencedField', resourceName, fieldName], 'Real'],
						['Number', targetAccuracy],
					],
				],
				['Number', targetAccuracy],
			],
			'Text',
		],
	],
];
