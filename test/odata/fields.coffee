exports.pilotFields = [
	'"pilot"."created at" AS "created_at"'
	'"pilot"."id"'
	'"pilot"."person"'
	'"pilot"."is experienced" AS "is_experienced"'
	'"pilot"."name"'
	'"pilot"."age"'
	'"pilot"."favourite colour" AS "favourite_colour"'
	'"pilot"."team"'
	'"pilot"."licence"'
	'"pilot"."hire date" AS "hire_date"'
	'"pilot"."pilot"'
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

exports.aliasPilotFields = [
	'"plane.pilot-can_fly-plane.pilot"."created at" AS "created_at"'
	'"plane.pilot-can_fly-plane.pilot"."id"'
	'"plane.pilot-can_fly-plane.pilot"."person"'
	'"plane.pilot-can_fly-plane.pilot"."is experienced" AS "is_experienced"'
	'"plane.pilot-can_fly-plane.pilot"."name"'
	'"plane.pilot-can_fly-plane.pilot"."age"'
	'"plane.pilot-can_fly-plane.pilot"."favourite colour" AS "favourite_colour"'
	'"plane.pilot-can_fly-plane.pilot"."team"'
	'"plane.pilot-can_fly-plane.pilot"."licence"'
	'"plane.pilot-can_fly-plane.pilot"."hire date" AS "hire_date"'
	'"plane.pilot-can_fly-plane.pilot"."pilot"'
]
exports.aliasPilotLicenceFields = [
	'"licence.pilot"."created at" AS "created_at"'
	'"licence.pilot"."id"'
	'"licence.pilot"."person"'
	'"licence.pilot"."is experienced" AS "is_experienced"'
	'"licence.pilot"."name"'
	'"licence.pilot"."age"'
	'"licence.pilot"."favourite colour" AS "favourite_colour"'
	'"licence.pilot"."team"'
	'"licence.pilot"."licence"'
	'"licence.pilot"."hire date" AS "hire_date"'
	'"licence.pilot"."pilot"'
]
exports.aliasLicenceFields = [
	'"pilot.licence"."created at" AS "created_at"'
	'"pilot.licence"."id"'
	'"pilot.licence"."name"'
]
exports.aliasPlaneFields = [
	'"pilot.pilot-can_fly-plane.plane"."created at" AS "created_at"'
	'"pilot.pilot-can_fly-plane.plane"."id"'
	'"pilot.pilot-can_fly-plane.plane"."name"'
]
exports.aliasPilotCanFlyPlaneFields = [
	'"pilot.pilot-can_fly-plane"."created at" AS "created_at"'
	'"pilot.pilot-can_fly-plane"."pilot"'
	'"pilot.pilot-can_fly-plane"."plane"'
	'"pilot.pilot-can_fly-plane"."id"'
]