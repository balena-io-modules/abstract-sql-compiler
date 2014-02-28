expect = require('chai').expect
test = require('./test')
clientModel = require('./client-model.json')
{pilotFields} = require('./fields')
pilotFields = pilotFields.join(', ')

filterIDs = [1..2000]
filterString = filterIDs.map((i) -> 'id eq ' + i).join(' or ')
test '/pilot?$filter=' + filterString, (result) ->
	it 'should select from pilot with a very long where', ->
		expect(result.query).to.equal '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE "pilot"."id" IN (''' + filterIDs.join(', ') + ')'
