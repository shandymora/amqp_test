/*
 * project:	app_template
 * author: 	amora
 * 
 */

// Include modules
var http 		= require('http');
var url 		= require('url');
var net			= require('net');
var $			= require('jquery');
var config		= require('./config');
var router		= require('./router');
// var simplesmtp 	= require("simplesmtp");
// var MailParser  = require("mailparser").MailParser;
var client		= require('./client');
var utility		= require('./utility');

// Logging parameters
var currentDir = config.currentDir;
var logger = config.app_data.logger;

// HTTP
function http_server(port) {

	var http_app_server = {};
	
	this.start = function() {
		http_app_server = http.createServer(onRequest).listen(port);
		if (logger.logLevel.info == true) { logger.log.info('HTTP Server has started on port '+port); }
	};
	
	this.stop = function(callback) {
		http_app_server.close( function() {
			if (logger.logLevel.info == true) { logger.log.info('HTTP Server has stopped'); }
			callback();
		});
	};

	function onRequest(request, response) {
		utility.statsd.client.increment(utility.statsd.prefix+'app.server.http_server.request');
    	var pathname = url.parse(request.url).pathname;
    	router.http_route(pathname, response, request);
  	}

  	var self = this;
	self.start();
}


// SMTP
function smtp_server(settings, done) {
	
	var smtp_app_server = {};
	this.client_connection = {};
	var message = '';
	
	
	this.start = function() {

		smtp_app_server = simplesmtp.createServer(
			{
				SMTPBanner:				settings.banner,
				disableDNSValidation:	true,
				disableSTARTTLS:		true
			}
		);
		
		smtp_app_server.listen(settings.port, 
		
			function(err) {
				if (err) {
					if (logger.logLevel.error == true) { logger.log.error('SMTP Server has an error', {error:err}); }
				}
			}
		);
		
		smtp_app_server.on('startData', function(connection) {
			connection.message = '';
			
		});
		
		smtp_app_server.on('data', function(connection, chunk) {
			if (chunk !== null) {
				connection.message += chunk;
				
	      	}
		});
		
		smtp_app_server.on('dataReady', function(connection, callback) {

			var mailparser = new MailParser();
			mailparser.end(connection.message);
			
			// setup an event listener when the parsing finishes
			mailparser.on("end", function(mail_object){
	
				var parsedMessage = {
					from: 		connection.from,
					to:			connection.to,
					date:		connection.date,
					host:		connection.host,
					text:		mail_object.text,
					headers:	mail_object.headers,
					subject:	mail_object.subject,
					messageId:	mail_object.messageId,
					priority:	mail_object.priority
				};
				
				utility.statsd.client.increment(utility.statsd.prefix+'app.server.smtp_server.message_parsed_count');
				
				if (logger.logLevel.info == true) { logger.log.info('received mail', {message:parsedMessage}); }
				
				// Send response back to client
				callback(null, null);
				
				done(parsedMessage);
			});
			
		});
		
		smtp_app_server.on('close', function(connection) {
//			console.log('SMTP Client Connection closed');
		});
		
		smtp_app_server.on('error', function(connection) {
			if (logger.logLevel.error == true) { logger.log.error('SMTP Server has an error'); }
		});
		
		if (logger.logLevel.info == true) { logger.log.info('SMTP Server has started'); }
	
	};
	
	this.stop = function(callback) {
		smtp_app_server.end( function() {
			if (logger.logLevel.info == true) { logger.log.info('SMTP Server has stopped'); }
			callback();
		});
	};
	
	var self = this;
	self.start();	
	
	
}

//TCP
function tcp_server(port) {
	var tcp_server = {};
	
	this.start = function() {
		tcp_server = net.createServer().listen(port);
		if (logger.logLevel.info == true) { logger.log.info('TCP Server has started on port '+port); }
		
		tcp_server.on('connection', function(socket) {
			if (logger.logLevel.info == true) { logger.log.info('Connection from client:'+socket.remoteAddress+':'+socket.remotePort); }
			utility.statsd.client.increment(utility.statsd.prefix+'app.server.tcp_server.connection');
			socket.on('data', function(data) {
				 router.tcp_route(socket.localPort, data);
			});
			
			socket.on('end', function() { 
				if (logger.logLevel.info == true) { logger.log.info('Client disconnected from TCP server, port:'+port); }
			});
			
			socket.on('error', function(err) {
				if (logger.logLevel.error == true) { logger.log.error('Socket error from client'); }
				socket.destroy();
			});
			
		});
		
		tcp_server.on('close', function() { 
			if (logger.logLevel.info == true) { logger.log.info('Server on port '+port+' closed'); }
		});
		
		tcp_server.on('error', function(err) { 
			if (logger.logLevel.info == true) { logger.log.info('Error occurred', {error:err}); }
		});
		
	};
	
	this.stop = function() {
		
	};
	
	this.write = function() {
		
	};
	
		 
	
	var self = this;
	self.start();
}

function start_tcp_servers(oSettings) {
	if ( 'tcp' in oSettings.server ) {
		if ( 'enabled' in oSettings.server.tcp && oSettings.server.tcp.enabled == true ) {
			if ( utility.isArray(oSettings.server.tcp.port) ) {
				oSettings.server.tcp.port.forEach( function(port) {
					config.app_data.tcp_servers[port.toString()] = new tcp_server(port);
				});
			} else {
				config.app_data.tcp_servers[oSettings.server.tcp.port.toString()] = new tcp_server(oSettings.server.tcp.port);
			}
		}
			
	}
}

function start_http_servers(oSettings, callback) {
	if ( 'http' in oSettings.server ) {
		if ( 'enabled' in oSettings.server.http && oSettings.server.http.enabled == true ) {
			if ( utility.isArray(oSettings.server.http.port) ) {
				oSettings.server.http.port.forEach( function(port) {
					config.app_data.http_servers[port.toString()] = new http_server(port);
				});
			} else {
				config.app_data.http_servers[oSettings.server.http.port.toString()] = new http_server(oSettings.server.http.port);
			}
		}
	}
}

// Export variables/functions
exports.http_server = http_server;
exports.smtp_server = smtp_server;
exports.tcp_server = tcp_server;
exports.start_tcp_servers = start_tcp_servers;
exports.start_http_servers = start_http_servers;