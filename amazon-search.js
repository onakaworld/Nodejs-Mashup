// Require
var util = require('util');
var socketio = require('socket.io').listen(8088);
var jsdom = require('jsdom');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');


// Amazon Key
var accessKey = 'xxxxx';
var secretKey = 'xxxxx';

// Amazon API URI
var amazonApiHost = 'ecs.amazonaws.jp';

// JSDOM
var jqueryJS = './jquery-1.7.min.js';


// Socket Open
socketio.sockets.on('connection',function(socket){
	socket.on('ItemSearch', function(data){
		itemSearch(data, function(data){
			socket.emit('ItemSearchResponse',JSON.parse(data));
		});
	});
});



/**
 * Call Amazon ItemSearch API
 * @param key-value pair JSON.
 * @param callback callbackfunction ex. function(data){}
 */
function itemSearch(param, callback) {

	var uri = createURI('ItemSearch',param);
	var option = 
		{
			host:amazonApiHost
			,path:uri.substring(util.format('http://%s',amazonApiHost).length ,uri.length)
		};

	http.get(option, function(res){
		var itemSearchJsonResult = '{"results":[';

		var xml = '';
		res.on('data',function(data){
			xml += data;
		});
		res.on('end',function(){
//			fs.writeFile('./amazon.xml',xml);
			var document = jsdom.jsdom();
			var window = document.createWindow();

			var jsonCount = 0;

			jsdom.jQueryify(window, jqueryJS, function(window, $){
				$(xml).find('Items > Item').each(function(){
					var jsondata = [];
					jsondata['ASIN'] = $(this).children('ASIN').text();
					jsondata['DetailPageURL'] = $(this).children('DetailPageURL').text();
					$(this).children('ItemAttributes').each(function(){
						jsondata['Author'] = $(this).children('Author').text();
						jsondata['Manufacturer'] = $(this).children('Manufacturer').text();
						jsondata['ProductGroup'] = $(this).children('ProductGroup').text();
						jsondata['Title'] = $(this).children('Title').text();
					});

					var jsonStr = '';
					var count = 0;
					for( var name in jsondata ) {
						var value = jsondata[name];

						if( count != 0 ) {
							jsonStr += ',';
						}
						else {
							++count;
						}

						if( value == null || value == '') {
							jsonStr += util.format('"%s":""' ,name);
						}
						else if( isNaN(jsondata[name]) == false ) {
							jsonStr += util.format('"%s":%s' ,name, value);
						}
						else {
							jsonStr += util.format('"%s":"%s"' ,name, value);
						}
					}
					
					if( jsonCount != 0 ) {
						itemSearchJsonResult += util.format(',{%s}\n', jsonStr);
					}
					else {
						itemSearchJsonResult += util.format('{%s}\n', jsonStr);
						++jsonCount;
					}
				});

				itemSearchJsonResult += ']}';
				callback(itemSearchJsonResult);
			});
		});
		res.on('error', function(ex){
			callback(ex);
		});
	});


}


/**
 * Create Amazon Search I.
 * @param operation ex.ItemSearch
 * @param keywords(JSON)
 * @return URI.
 */
function createURI(operation, param){

	var createUTCDate = function() {
		var date = new Date();

		var year 	= date.getUTCFullYear();
		var month 	= ('0' + (date.getUTCMonth() + 1)).slice(-2);
		var d 		= ('0' + date.getUTCDate()).slice(-2);
		var hour 	= ('0' + date.getUTCHours()).slice(-2);
		var minutes = ('0' + date.getUTCMinutes()).slice(-2);
		var second 	= ('0' + date.getUTCSeconds()).slice(-2);
		var milliSecond = ('00' + date.getUTCMilliseconds()).slice(-3);

		return encodeURIComponent(util.format('%s-%s-%sT%s:%s:%s.%sZ',year, month, d, hour, minutes, second, milliSecond));
	}

	var createSignature = function(signature) {
		var hmac = crypto.createHmac('SHA256', secretKey);
		hmac.update(signature);
		return encodeURIComponent(hmac.digest('base64'));
	}

	var paramArray = [];
	for( var name in param ) {
		paramArray.push(util.format('%s=%s',name, encodeURIComponent(param[name])));
	}
	paramArray.push(util.format('Operation=%s',operation));
	paramArray.push(util.format('Service=%s','AWSECommerceService'));
	paramArray.push(util.format('Timestamp=%s', createUTCDate()));
	paramArray.push(util.format('Version=%s','2011-08-02'));
	paramArray.push(util.format('AWSAccessKeyId=%s', accessKey));
	paramArray.push('AssociateTag=onakaworld001-22');
	paramArray.sort();

	var getParameter = paramArray.join('&');
	var signature = createSignature(util.format('GET\n%s\n/onca/xml\n%s' ,amazonApiHost ,getParameter));

	return util.format('http://%s/onca/xml?%s&Signature=%s' ,amazonApiHost ,getParameter, signature);
}

console.log('Starting... OK');

itemSearch({Keywords:'Node.js',SearchIndex:'All'}, function(data){/*util.debug(data)*/});
