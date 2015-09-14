/*
 * project:	app_template
 * author: 	amora
 * 
 */

// Include modules
var url 		= require('url');
var handlers 	= require('./handlers');

var handle_http = {
	"/" : 				handlers.start,
  	"/health":  		handlers.appHealth
};

var handle_tcp = {
//	port:	handlers.<function>
//	2023:	handlers.fnPort_2023,
};

var handle_amqp = {
	// queue:	handlers.<function>
	// test_queue:	handlers.amqp_test_queue
};

function http_route(pathname, response, request) {
  if (typeof handle_http[pathname] === 'function') {
    handle_http[pathname](response, request);
  } else {
  	handlers.sendfile(response, pathname);
  }
}

function tcp_route(localPort, data) {
	if ( config.settings.server.tcp.port.indexOf(localPort) >= 0 ) {
		if (typeof handle_tcp[localPort] === 'function') {
			handle_tcp[localPort](data);
		}
	}
}

function amqp_route(queue, message) {
	if (typeof handle_amqp[queue] === 'function') {
		handler_amqp[queue](message);
	}
}

// Export variables/functions
exports.http_route = http_route;
exports.tcp_route = tcp_route;
exports.amqp_route = amqp_route;
