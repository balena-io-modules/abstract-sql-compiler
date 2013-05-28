exports.pilotFields = [
	'"pilot"."id"'
	'"pilot"."is experienced" AS "is_experienced"'
	'"pilot"."name"'
	'"pilot"."age"'
	'"pilot"."favourite colour" AS "favourite_colour"'
	'"pilot"."licence"'
]
exports.pilotCanFlyPlaneFields = [
	'"pilot-can_fly-plane"."pilot"'
	'"pilot-can_fly-plane"."plane"'
	'"pilot-can_fly-plane"."id"'
]