expect = require('chai').expect
test = require('./test')
clientModel = require('../client-model.json')
{pilotFields} = require('./fields')
pilotFields = pilotFields.join(', ')

filterIDs = [1..3]
filterString = filterIDs.map((i) -> 'id eq ' + i).join(' or ')
test '/pilot?$filter=' + filterString, (result) ->
	it 'should select from pilot with a long IN clause', ->
		expect(result.query).to.equal '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE "pilot"."id" IN (''' + filterIDs.join(', ') + ')'

filterString = filterIDs.map((i) -> 'id ne ' + i).join(' and ')
test '/pilot?$filter=' + filterString, (result) ->
	it 'should select from pilot with a long NOT IN clause', ->
		expect(result.query).to.equal '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE "pilot"."id" NOT IN (''' + filterIDs.join(', ') + ')'
