test = require('./test')
{ pilotFields } = require('./fields')
pilotFields = pilotFields.join(', ')


test '/pilot?$top=5', (result, sqlEquals) ->
	it 'should select from pilot limited by 5', ->
		sqlEquals result.query, '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			LIMIT 5'''


test '/pilot?$skip=100', (result, sqlEquals) ->
	it 'should select from pilot offset by 100', ->
		sqlEquals result.query, '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			OFFSET 100'''


test '/pilot?$top=5&$skip=100', (result, sqlEquals) ->
	it 'should select from pilot limited by 5 and offset by 100', ->
		sqlEquals result.query, '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			LIMIT 5
			OFFSET 100'''