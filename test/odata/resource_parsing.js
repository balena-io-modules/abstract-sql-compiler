import { expect } from 'chai';
import test from './test';
import * as ODataParser from '@balena/odata-parser';
import {
	pilotFields,
	teamFields,
	aliasFields,
	aliasPlaneFields,
	aliasPilotLicenceFields,
	aliasLicenceFields,
} from './fields';
const aliasPilotFields = aliasFields(
	'plane.pilot-can fly-plane.pilot',
	pilotFields,
).join(', ');
const aliasPlaneFieldsStr = aliasPlaneFields.join(', ');
const aliasPilotLicenceFieldsStr = aliasPilotLicenceFields.join(', ');
const aliasLicenceFieldsStr = aliasLicenceFields.join(', ');
const pilotFieldsStr = pilotFields.join(', ');
const teamFieldsStr = teamFields.join(', ');

test('/pilot', (result, sqlEquals) => {
	it('should select from pilot', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"`,
		);
	});
});

test('/pilot(1)', 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select from pilot with id', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
		);
	});
});

test("/pilot('TextKey')", 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select from pilot with id', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
		);
	});
});

test('/pilot(1)/licence', 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select from the licence of pilot with id', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${aliasLicenceFieldsStr}
FROM "pilot",
	"licence" AS "pilot.licence"
WHERE "pilot"."licence" = "pilot.licence"."id"
AND ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
		);
	});
});

test('/licence(1)/is_of__pilot', 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select from the pilots of licence with id', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${aliasPilotLicenceFieldsStr}
FROM "licence",
	"pilot" AS "licence.is of-pilot"
WHERE "licence"."id" = "licence.is of-pilot"."licence"
AND ("licence"."id") IS NOT NULL AND ("licence"."id") = (?)`,
		);
	});
});

test(
	'/pilot(1)/can_fly__plane/plane',
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from the plane of pilot with id', () => {
			sqlEquals(
				result.query,
				`\
SELECT ${aliasPlaneFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
	"plane" AS "pilot.pilot-can fly-plane.plane"
WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
			);
		});
	},
);

test(
	'/plane(1)/can_be_flown_by__pilot/pilot',
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from the pilots of plane with id', () => {
			sqlEquals(
				result.query,
				`\
SELECT ${aliasPilotFields}
FROM "plane",
	"pilot-can fly-plane" AS "plane.pilot-can fly-plane",
	"pilot" AS "plane.pilot-can fly-plane.pilot"
WHERE "plane.pilot-can fly-plane"."pilot" = "plane.pilot-can fly-plane.pilot"."id"
AND "plane"."id" = "plane.pilot-can fly-plane"."can fly-plane"
AND ("plane"."id") IS NOT NULL AND ("plane"."id") = (?)`,
			);
		});
	},
);

test('/pilot(1)', 'DELETE', [['Bind', 0]], (result, sqlEquals) => {
	it('should delete the pilot with id 1', () => {
		sqlEquals(
			result.query,
			`\
DELETE FROM "pilot"
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
		);
	});
});

test(
	'/pilot(1)',
	'PUT',
	[
		[
			['Bind', ['pilot', 'id']],
			['Bind', 0],
		],
		[
			['Bind', ['pilot', 'id']],
			['Bind', 0],
		],
	],
	(result, sqlEquals) => {
		it('should insert/update the pilot with id 1', () => {
			sqlEquals(
				result[0].query,
				`\
INSERT INTO "pilot" ("id")
SELECT "$insert"."id"
FROM (
	SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS TIMESTAMP) AS "modified at", CAST(? AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS BOOLEAN) AS "is experienced", CAST(NULL AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMP) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM (
		SELECT "$insert".*
	) AS "pilot"
	WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
)`,
			);
			sqlEquals(
				result[1].query,
				`\
UPDATE "pilot"
SET "created at" = DEFAULT,
	"modified at" = DEFAULT,
	"id" = ?,
	"person" = DEFAULT,
	"is experienced" = DEFAULT,
	"name" = DEFAULT,
	"age" = DEFAULT,
	"favourite colour" = DEFAULT,
	"is on-team" = DEFAULT,
	"licence" = DEFAULT,
	"hire date" = DEFAULT,
	"was trained by-pilot" = DEFAULT
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
			);
		});
	},
);
test(
	'/pilot',
	'POST',
	[['Bind', ['pilot', 'name']]],
	{ name: 'Peter' },
	(result, sqlEquals) => {
		it('should insert/update the pilot with id 1', () => {
			sqlEquals(
				result.query,
				`\
INSERT INTO "pilot" ("name")
VALUES (?)`,
			);
		});
	},
);
test('/pilot', 'POST', (result, sqlEquals) => {
	it('should insert a pilot with default values', () => {
		sqlEquals(
			result.query,
			`\
INSERT INTO "pilot" DEFAULT VALUES`,
		);
	});
});

(function () {
	const bindings = [
		['Bind', ['pilot', 'is_experienced']],
		['Bind', 0],
	];
	const testFunc = (result, sqlEquals) => {
		it('should update the pilot with id 1', () => {
			sqlEquals(
				result.query,
				`\
UPDATE "pilot"
SET "is experienced" = ?
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
			);
		});
	};
	test('/pilot(1)', 'PATCH', bindings, { is_experienced: true }, testFunc);
	test('/pilot(1)', 'MERGE', bindings, { is_experienced: true }, testFunc);
})();

test(
	'/pilot__can_fly__plane(1)',
	'DELETE',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should delete the pilot with id 1', () => {
			sqlEquals(
				result.query,
				`\
DELETE FROM "pilot-can fly-plane"
WHERE ("pilot-can fly-plane"."id") IS NOT NULL AND ("pilot-can fly-plane"."id") = (?)`,
			);
		});
	},
);

test(
	'/pilot__can_fly__plane(1)',
	'PUT',
	[
		[
			['Bind', ['pilot-can fly-plane', 'id']],
			['Bind', 0],
		],
		[
			['Bind', ['pilot-can fly-plane', 'id']],
			['Bind', 0],
		],
	],
	(result, sqlEquals) => {
		it('should insert/update the pilot-can fly-plane with id 1', () => {
			sqlEquals(
				result[0].query,
				`\
INSERT INTO "pilot-can fly-plane" ("id")
SELECT "$insert"."id"
FROM (
	SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS TIMESTAMP) AS "modified at", CAST(NULL AS INTEGER) AS "pilot", CAST(NULL AS INTEGER) AS "can fly-plane", CAST(? AS INTEGER) AS "id"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM (
		SELECT "$insert".*
	) AS "pilot-can fly-plane"
	WHERE ("pilot-can fly-plane"."id") IS NOT NULL AND ("pilot-can fly-plane"."id") = (?)
)`,
			);
			sqlEquals(
				result[1].query,
				`\
UPDATE "pilot-can fly-plane"
SET "created at" = DEFAULT,
	"modified at" = DEFAULT,
	"pilot" = DEFAULT,
	"can fly-plane" = DEFAULT,
	"id" = ?
WHERE ("pilot-can fly-plane"."id") IS NOT NULL AND ("pilot-can fly-plane"."id") = (?)`,
			);
		});
	},
);
test(
	'/pilot__can_fly__plane',
	'POST',
	[
		['Bind', ['pilot-can fly-plane', 'pilot']],
		['Bind', ['pilot-can fly-plane', 'can_fly__plane']],
	],
	{ pilot: 2, can_fly__plane: 3 },
	(result, sqlEquals) => {
		it('should insert/update the pilot-can fly-plane with id 1', () => {
			sqlEquals(
				result.query,
				`\
INSERT INTO "pilot-can fly-plane" ("pilot", "can fly-plane")
VALUES (?, ?)`,
			);
		});
	},
);
test('/pilot__can_fly__plane', 'POST', (result, sqlEquals) => {
	it('should insert a "pilot-can fly-plane" with default values', () => {
		sqlEquals(
			result.query,
			`\
INSERT INTO "pilot-can fly-plane" DEFAULT VALUES`,
		);
	});
});

(function () {
	const bindings = [
		['Bind', ['pilot-can fly-plane', 'pilot']],
		['Bind', 0],
	];
	const testFunc = (result, sqlEquals) => {
		it('should update the pilot with id 1', () => {
			sqlEquals(
				result.query,
				`\
UPDATE "pilot-can fly-plane"
SET "pilot" = ?
WHERE ("pilot-can fly-plane"."id") IS NOT NULL AND ("pilot-can fly-plane"."id") = (?)`,
			);
		});
	};
	test('/pilot__can_fly__plane(1)', 'PATCH', bindings, { pilot: 1 }, testFunc);
	test('/pilot__can_fly__plane(1)', 'MERGE', bindings, { pilot: 1 }, testFunc);
})();

test('/pilot(1)/$links/licence', 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select the list of licence ids, for generating the links', () => {
		sqlEquals(
			result.query,
			`\
SELECT "pilot"."licence" AS "licence"
FROM "pilot"
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
		);
	});
});

test(
	'/pilot(1)/can_fly__plane/$links/plane',
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select the list of plane ids, for generating the links', () => {
			sqlEquals(
				result.query,
				`\
SELECT "pilot.pilot-can fly-plane"."can fly-plane" AS "plane"
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
			);
		});
	},
);

test.skip('/pilot(1)/favourite_colour/red', () => {
	it("should select the red component of the pilot's favourite colour");
});

test.skip('/method(1)/child?foo=bar', () => {
	it('should do something..');
});

test("/team('purple')", 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select the team with the "favourite colour" id of "purple"', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${teamFieldsStr}
FROM "team"
WHERE ("team"."favourite colour") IS NOT NULL AND ("team"."favourite colour") = (?)`,
		);
	});
});

test(
	'/team',
	'POST',
	[['Bind', ['team', 'favourite_colour']]],
	{ favourite_colour: 'purple' },
	(result, sqlEquals) => {
		it('should insert a team', () => {
			sqlEquals(
				result.query,
				`\
INSERT INTO "team" ("favourite colour")
VALUES (?)`,
			);
		});
	},
);

test('/pilot/$count/$count', (result) => {
	it('should fail because it is invalid', () => {
		expect(result).to.be.instanceOf(ODataParser.SyntaxError);
	});
});

test('/pilot/$count', (result, sqlEquals) => {
	it('should select count(*) from pilot', () => {
		sqlEquals(
			result.query,
			`\
SELECT COUNT(*) AS "$count"
FROM "pilot"`,
		);
	});
});

test('/pilot(5)/$count', (result) => {
	it('should fail because it is invalid', () => {
		expect(result).to.be.instanceOf(ODataParser.SyntaxError);
	});
});

test('/pilot?$filter=id eq 5/$count', (result) => {
	it('should fail because it is invalid', () => {
		expect(result).to.be.instanceOf(ODataParser.SyntaxError);
	});
});

test(
	'/pilot/$count?$filter=id gt 5',
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where pilot/id > 5 ', () => {
			sqlEquals(
				result.query,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE "pilot"."id" > ?`,
			);
		});
	},
);

test(
	'/pilot/$count?$filter=id eq 5 or id eq 10',
	'GET',
	[
		['Bind', 0],
		['Bind', 1],
	],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where id in (5,10)', () => {
			sqlEquals(
				result.query,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE (("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
OR ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?))`,
			);
		});
	},
);

test(
	'/pilot/$count?$filter=id eq 5 or id eq null',
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where id in (5,10)', () => {
			sqlEquals(
				result.query,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE (("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
OR "pilot"."id" IS NULL)`,
			);
		});
	},
);

test('/pilot(5)/licence/$count', 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select count(*) the licence from pilot where pilot/id', () => {
		sqlEquals(
			result.query,
			`\
SELECT COUNT(*) AS "$count"
FROM "pilot",
	"licence" AS "pilot.licence"
WHERE "pilot"."licence" = "pilot.licence"."id"
AND ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
		);
	});
});

test('/pilot/$count?$orderby=id asc', (result, sqlEquals) => {
	it('should select count(*) from pilot and ignore orderby', () => {
		sqlEquals(
			result.query,
			`\
SELECT COUNT(*) AS "$count"
FROM "pilot"`,
		);
	});
});

test('/pilot/$count?$skip=5', (result, sqlEquals) => {
	it('should select count(*) from pilot and ignore skip', () => {
		sqlEquals(
			result.query,
			`\
SELECT COUNT(*) AS "$count"
FROM "pilot"`,
		);
	});
});

test('/pilot/$count?$top=5', (result, sqlEquals) => {
	it('should select count(*) from pilot and ignore top', () => {
		sqlEquals(
			result.query,
			`\
SELECT COUNT(*) AS "$count"
FROM "pilot"`,
		);
	});
});

test('/pilot/$count?$top=5&$skip=5', (result, sqlEquals) => {
	it('should select count(*) from pilot and ignore top and skip', () => {
		sqlEquals(
			result.query,
			`\
SELECT COUNT(*) AS "$count"
FROM "pilot"`,
		);
	});
});

test('/pilot/$count?$select=id', (result, sqlEquals) => {
	it('should select count(*) from pilot and ignore select', () => {
		sqlEquals(
			result.query,
			`\
SELECT COUNT(*) AS "$count"
FROM "pilot"`,
		);
	});
});
