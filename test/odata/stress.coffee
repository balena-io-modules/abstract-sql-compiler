test = require('./test')
_ = require 'lodash'
{ pilotFields } = require('./fields')
pilotFields = pilotFields.join(', ')

filterIDs = [1..5000]
filterBindsString = _.map(filterIDs, _.constant('?')).join(', ')
filterBinds = _.map filterIDs, (n, i) ->
	return ['Bind', i]

filterString = filterIDs.map((i) -> 'id eq ' + i).join(' or ')
test '/pilot?$filter=' + filterString, 'GET', filterBinds, (result, sqlEquals) ->
	it 'should select from pilot with a long IN clause', ->
		sqlEquals result.query, '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE "pilot"."id" IN (''' + filterBindsString + ')'

filterString = filterIDs.map((i) -> 'id ne ' + i).join(' and ')
test '/pilot?$filter=' + filterString, 'GET', filterBinds, (result, sqlEquals) ->
	it 'should select from pilot with a long NOT IN clause', ->
		sqlEquals result.query, '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE "pilot"."id" NOT IN (''' + filterBindsString + ')'
