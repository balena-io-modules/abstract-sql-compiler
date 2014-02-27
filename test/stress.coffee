expect = require('chai').expect
test = require('./test')
clientModel = require('./client-model.json')

filterString = [1..2000].map((i) -> 'id eq ' + i).join(' or ')
test.only '/pilot?$filter=' + filterString, (result) ->
	it 'should select from pilot with a very long where', ->
		expect(result.query).to.exist
