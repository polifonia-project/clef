
var yasqe = YASQE(document.getElementById("yasqe"), {
	sparql: {
		showQueryButton: true,
		endpoint: myPublicEndpoint,
		requestMethod: "POST" // TODO: this does not work with GET
	}
});

// TODO change endpoint

var yasr = YASR(document.getElementById("yasr"), {
	//this way, the URLs in the results are prettified using the defined prefixes in the query
	getUsedPrefixes: yasqe.getPrefixesFromQuery
});

//link both together
yasqe.setValue("SELECT DISTINCT * WHERE {?s ?p ?o} LIMIT 10")
yasqe.options.sparql.callbacks.complete = yasr.setResponse;
