exports.pilotFields = [
	'"pilot"."id"'
	'"pilot"."is experienced" AS "is_experienced"'
	'"pilot"."name"'
	'"pilot"."age"'
	'"pilot"."favourite colour" AS "favourite_colour"'
	'"pilot"."team"'
	'"pilot"."licence"'
]
exports.pilotCanFlyPlaneFields = [
	'"pilot-can_fly-plane"."pilot"'
	'"pilot-can_fly-plane"."plane"'
	'"pilot-can_fly-plane"."id"'
]
exports.licenceFields = [
	'"licence"."id"'
	'"licence"."name"'
]
exports.planeFields = [
	'"plane"."id"'
	'"plane"."name"'
]
exports.teamFields = [
	'"team"."favourite colour" AS "favourite_colour"'
]
