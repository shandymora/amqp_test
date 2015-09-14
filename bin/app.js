/*
 * project:	app_template
 * author: 	amora
 * 
 */

// Include modules
var config		= require('./config');
var $			= require('jquery');
var client		= require('./client');
var server		= require('./server');
var utility		= require('./utility');

// Logging parameters
var currentDir = config.currentDir;
var logger = config.app_data.logger;

function start(oSettings) {
	
	// Setup app cluster
	clusterApp(oSettings.app.cluster, function() {
		// Do something useful
	});
	
	// Initialize statsd client
	utility.statsd = new client.statsd(oSettings.client.statsd);
	// Setup timer to send health stats every 60s
	utility.send_health_stats('app');
	
	// start http servers
	server.start_http_servers(oSettings);
	
	// start tcp servers
	server.start_tcp_servers(oSettings);

	// Connect to Redis
	client.start_redis_clients(oSettings, function() {
		// Start services, call functions reliant on redis client connections
	});
	
	// start amqp clients
	client.start_amqp_clients(oSettings, parseMessage, function() {
		// Start services, call functions reliant on AMQP client connections
		console.log("completed function start_amqp_clients");
	});
	
	/*
	 * 	Reload config
	 */
	if ( config.settings.app.auto_reload_config == true ) {
		// Refresh config
		setInterval( function() {
			if (logger.logLevel.info == true) { logger.log.info('Refreshing config'); }
			// Read in config file
			utility.readConfig(config.configFile);
			
			// Re-configure app based on updated config
			
		}, 60000);
	}
	
}

function parseMessage(queue, message) {
	console.log('Consumer queue: '+queue+'received message: '+message.content.toString());
}

function parse_data(data) {
	console.log("received some data from a TCP server");
}

function isMaster(node, done) {
	client.httpConn(
		{
			oSettings: {
				url:		'http://'+node+':'+config.settings.server.http.port+'/health?cluster=is_master',
				sMethod:	'GET'
			}
		}, 
		function(err, statusCode, response) {
			if (err) {
				if (logger.logLevel.error == true) { logger.log.error('isMaster error', {node: node, response: response, statuscode: statusCode}); }
				
				// Record whether node is up
				if ( node in config.health.cluster.nodes) {
					config.health.cluster.nodes[node].available = false;
				} else {
					config.health.cluster.nodes[node] = {
						available:	false
					};
				}
				
				done(false, node); 
			}
			else {
				
				// Record whether node is up
				if ( node in config.health.cluster.nodes) {
					config.health.cluster.nodes[node].available = true;
				} else {
					config.health.cluster.nodes[node] = {
						available:	true
					};
				}
				
				if ( response.is_master == true ) {
					done(true, node);
				} else {
					done(false, node);
				}
			
				
			}
		});

}

function clusterApp(oSettings, done) {
	// Schedule regular checks of all nodes
	setInterval( function() {
		node_index = 0;
		found_master = false;
		oSettings.nodes.forEach( function(node) {
			if ( node != config.my_hostname   ) { 
				// Get node status
				isMaster(node, function(masterFound, checked_node) {
					if (masterFound) {
						
						if ( checked_node != config.health.cluster.master ) {
							// New master found
							if (logger.logLevel.debug == true) { logger.log.debug('New master: '+checked_node); }
							if ( 'ircBot' in config.settings.client ) {
								for (var bot in config.settings.client.ircBot) {
									app_clients[bot].sendMessage('New master: '+checked_node);
								}
							}
						}
					
						config.health.cluster.master = checked_node;
						config.health.cluster.is_master = false;
						found_master = true;
//						if (logger.logLevel.debug == true) { logger.log.debug('Set master: '+checked_node); }
					}
					node_index += 1;
					
					if ( node_index == oSettings.nodes.length ) {
						if ( ! found_master ) {
							// I will be master as I didn't find any
							config.health.cluster.master = config.my_hostname;
							config.health.cluster.is_master = true;
						}
					}
				});
			} else {
				node_index += 1;
			}
			
		});
	}, oSettings.heartbeat);
	
	// Determine master	
	// Are any nodes already up, what are their state?
	var node_index = 0;
	var found_master = false;
	oSettings.nodes.forEach( function(node) {
		if ( node != config.my_hostname   ) { 
			// Get node status
			isMaster(node, function(masterFound, checked_node) {
				if (masterFound) {
					
					if ( checked_node != config.health.cluster.master ) {
						// New master found
						if (logger.logLevel.debug == true) { logger.log.debug('New master: '+checked_node); }
						if ( 'ircBot' in config.settings.client ) {
							for (var bot in config.settings.client.ircBot) {
								config.app_data.ircBots[bot].sendMessage('New master: '+checked_node);
							}
						}
							
					}
					
					config.health.cluster.master = checked_node;
					config.health.cluster.is_master = false;
					found_master = true;
/*
					if (logger.logLevel.debug == true) { logger.log.debug('Set master: '+checked_node); }
					for (var bot in oSettings.client.ircBot) {
						app_clients[bot].sendMessage('Set master: '+checked_node);
					}
*/
				} 
				node_index += 1;
				
				if ( node_index == oSettings.nodes.length ) {
					if ( ! found_master ) {
						// I will be master as I didn't find any
						config.health.cluster.master = config.my_hostname;
						config.health.cluster.is_master = true;
						if ( 'ircBot' in config.settings.client ) {
							for (var bot in config.settings.client.ircBot) {
								config.app_data.ircBots[bot][bot].sendMessage('I am master');
							}
						}
					}
					if ( done ) { done(); }
				}
			});
			
		} else {
			node_index += 1;
			if ( node_index == oSettings.nodes.length ) {
				if ( ! found_master ) {
					// I will be master as I didn't find any
					config.health.cluster.master = config.my_hostname;
					config.health.cluster.is_master = true;
					if ( 'ircBot' in config.settings.client ) {
						for (var bot in config.settings.client.ircBot) {
							config.app_data.ircBots[bot][bot].sendMessage('I am master');
						}
					}
				}
				if ( done ) { done(); }
			}
		}
		
	});
	
	
}

function exceptionHandler() {
	process.on('uncaughtException', function(err) {
	    // handle and log the error safely
	    console.log('BIG ASS UNHANDLED EXCEPTION: '+JSON.stringify(err,undefined,2));
	});
}

// Module exports
exports.start = start;
