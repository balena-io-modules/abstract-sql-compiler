exports.pilotFields = [
	'"pilot"."created at" AS "created_at"'
	'"pilot"."id"'
	'"pilot"."is experienced" AS "is_experienced"'
	'"pilot"."name"'
	'"pilot"."age"'
	'"pilot"."favourite colour" AS "favourite_colour"'
	'"pilot"."team"'
	'"pilot"."licence"'
	'"pilot"."hire date" AS "hire_date"'
]
exports.pilotCanFlyPlaneFields = [
	'"pilot-can_fly-plane"."created at" AS "created_at"'
	'"pilot-can_fly-plane"."pilot"'
	'"pilot-can_fly-plane"."plane"'
	'"pilot-can_fly-plane"."id"'
]
exports.licenceFields = [
	'"licence"."created at" AS "created_at"'
	'"licence"."id"'
	'"licence"."name"'
]
exports.planeFields = [
	'"plane"."created at" AS "created_at"'
	'"plane"."id"'
	'"plane"."name"'
]
exports.teamFields = [
	'"team"."created at" AS "created_at"'
	'"team"."favourite colour" AS "favourite_colour"'
]
