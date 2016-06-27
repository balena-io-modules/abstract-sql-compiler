exports.pilotFields = pilotFields = [
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
exports.pilotCanFlyPlaneFields = pilotCanFlyPlaneFields = [
	'"pilot-can_fly-plane"."created at" AS "created_at"'
	'"pilot-can_fly-plane"."pilot"'
	'"pilot-can_fly-plane"."plane"'
	'"pilot-can_fly-plane"."id"'
]
exports.licenceFields = licenceFields = [
	'"licence"."created at" AS "created_at"'
	'"licence"."id"'
	'"licence"."name"'
]
exports.planeFields = planeFields = [
	'"plane"."created at" AS "created_at"'
	'"plane"."id"'
	'"plane"."name"'
]
exports.teamFields = [
	'"team"."created at" AS "created_at"'
	'"team"."favourite colour" AS "favourite_colour"'
]

exports.aliasFields = aliasFields = (alias, fields) ->
	for field in fields
		field.replace(/^".*?"/, '"' + alias + '"')

exports.aliasPilotLicenceFields = aliasFields('licence.pilot', pilotFields)
exports.aliasLicenceFields = aliasFields('pilot.licence', licenceFields)
exports.aliasPlaneFields = aliasFields('pilot.pilot-can_fly-plane.plane', planeFields)
exports.aliasPilotCanFlyPlaneFields = aliasFields('pilot.pilot-can_fly-plane', pilotCanFlyPlaneFields)
