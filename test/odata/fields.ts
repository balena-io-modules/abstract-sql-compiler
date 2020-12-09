export const pilotFields = [
	'"pilot"."created at" AS "created_at"',
	'"pilot"."modified at" AS "modified_at"',
	'"pilot"."id"',
	'"pilot"."person"',
	'"pilot"."is experienced" AS "is_experienced"',
	'"pilot"."name"',
	'"pilot"."age"',
	'"pilot"."favourite colour" AS "favourite_colour"',
	'"pilot"."is on-team" AS "is_on__team"',
	'"pilot"."licence"',
	'"pilot"."hire date" AS "hire_date"',
	'"pilot"."was trained by-pilot" AS "was_trained_by__pilot"',
];

export const pilotCanFlyPlaneFields = [
	'"pilot-can fly-plane"."created at" AS "created_at"',
	'"pilot-can fly-plane"."modified at" AS "modified_at"',
	'"pilot-can fly-plane"."pilot"',
	'"pilot-can fly-plane"."can fly-plane" AS "can_fly__plane"',
	'"pilot-can fly-plane"."id"',
];

export const licenceFields = [
	'"licence"."created at" AS "created_at"',
	'"licence"."modified at" AS "modified_at"',
	'"licence"."id"',
	'"licence"."name"',
];

export const planeFields = [
	'"plane"."created at" AS "created_at"',
	'"plane"."modified at" AS "modified_at"',
	'"plane"."id"',
	'"plane"."name"',
];

export const teamFields = [
	'"team"."created at" AS "created_at"',
	'"team"."modified at" AS "modified_at"',
	'"team"."favourite colour" AS "favourite_colour"',
];

export const aliasFields = (alias: string, fields: string[]) =>
	fields.map((field) => field.replace(/^".*?"/, '"' + alias + '"'));

export const aliasPilotLicenceFields = aliasFields(
	'licence.is of-pilot',
	pilotFields,
);
export const aliasLicenceFields = aliasFields('pilot.licence', licenceFields);
export const aliasPlaneFields = aliasFields(
	'pilot.pilot-can fly-plane.plane',
	planeFields,
);
export const aliasPilotCanFlyPlaneFields = aliasFields(
	'pilot.pilot-can fly-plane',
	pilotCanFlyPlaneFields,
);
