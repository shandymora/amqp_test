/*
 * project:	app_template
 * author: 	amora
 * 
 */

// Include modules
var config		= require('./config');
var router		= require('./router');
var net			= require('net');
var exec 		= require('child_process').exec;
var $			= require('jquery');
var merge		= require('merge');
var StatsD		= require('node-statsd').StatsD;
// var irc 		= require("irc");
var utility		= require('./utility');
// var redis		= require('redis');
var amqp 		= require('amqplib/callback_api');

// Logging parameters
var logger = config.app_data.logger;
var currentDir = config.currentDir;

// StatsD 
function statsd(oSettings) {
	this.client = {};
	
	this.start = function() {
		self.client = new StatsD(oSettings.server);
		
		self.client.socket.on('error', function(error) {
			if (logger.logLevel.error == true) { logger.log.error('Error from statsd_client', { error: error } ); }
		});
	};
	
	this.stop = function() {
		
	};
	
	this.get_config = function() {
		return ({
			server:	oSettings.server,
			prefix: self.statsd_prefix
		});
	};
	
	this.prefix = oSettings.prefix+'.'+config.my_hostname+'.';
	
	var self = this;
	self.start();
	
}

// Elasticsearch
function elasticsearch(options) {
	
	this.conn_options = {
		sMethod:	'POST',
		oSettings:	{},
		sPayload:	'',
		dataType:	'json'
	};
	
	$.extend(true, this.conn_options, options);
	
	this.send = function(send_options, done) {
		
		if (send_options) {
			$.extend(true, self.conn_options, send_options);
		}
		
		$.ajax({
		    type: 	self.conn_options.sMethod,
		    url: 	self.conn_options.oSettings.url,
		    data: 	self.conn_options.sPayload, 				// or JSON.stringify ({name: 'jonas'}),
		    success: function(data, status, xhr) {
		    	var responseStatus = xhr.statusCode();
				if (logger.logLevel.debug == true) { logger.log.debug('xhr.statusCode: '+JSON.stringify(responseStatus.status,undefined,2)); }
				
				var responseHeader = xhr.getResponseHeader("Content-Type");		
				if (logger.logLevel.debug == true) { logger.log.debug('xhr.Content-Type: '+JSON.stringify(responseHeader,undefined,2)); }
		 
		 		if (logger.logLevel.info == true) { logger.log.info('Successfully indexed message', {data:data}); }
		 		
		    	done(false, responseStatus.status, data);
		    },
		    error: function(xhr, status, err) {
		    	if (logger.logLevel.warn == true) { logger.log.warn('Unable to post message', { error: err } ); }
		    	
		    	var responseStatus = xhr.statusCode();
				if (logger.logLevel.error == true) { logger.log.error('ERROR - xhr.statusCode: '+JSON.stringify(responseStatus.status,undefined,2)); }
				
				var responseHeader = xhr.getResponseHeader("Content-Type");		
				if (logger.logLevel.error == true) { logger.log.error('ERROR: xhr.Content-Type: '+JSON.stringify(responseHeader,undefined,2)); }
		    	done(true, responseStatus.status, err);
		    },
		    contentType: "application/json",
		    dataType: 'json'
		});
	};
	
	this.close = function(done) {
		
	};
	
	var self = this;
	if (logger.logLevel.info == true) { logger.log.info('Created Elasticsearch client', { url: this.conn_options.oSettings.url } ); }
	
}

// IRC
function ircBot(oSettings) {

	this.bot =		{};
	
	this.start = function() {
		
		// Create the bot
		self.bot = new irc.Client(oSettings.server, oSettings.botName, {
			channels : oSettings.channels });
		
		// Listen for bot errors
		self.bot.addListener("error", function(message) {
			if (logger.logLevel.error == true) { logger.log.error('IRC BOT error: ', message); }
		});
		if (logger.logLevel.info == true) { logger.log.info(oSettings.botName+' joined channel '+oSettings.channels.join(", ")); }
	};
	
	this.sendMessage = function(message) {
		
		self.bot.say(oSettings.channels, message );
		utility.statsd.client.increment(utility.statsd.prefix+'app.client.ircBot.say_count');
	};
	
	this.stop = function() {
		
	};
	
	var self = this;
	self.start();
	
};

// TCP
function tcpConn (oSettings) {
	
	this.connected 	= false;
	this.error		= false;
	var conn = {};
	var retryInterval = 3000;
	var retryCount = 1;
	var maxRetries = 30;
	
	var server = '';
	
	var self = this;
	
	connect();
	
	function connect() {
		conn = net.createConnection(oSettings.port, oSettings.host);
		conn.setKeepAlive(true);
		
		conn.on('connect', function(socket) { 
			retryCount = 0; 
			if (logger.logLevel.info == true) { logger.log.info('connected to '+oSettings.host+' on port '+oSettings.port); }
			server = oSettings.host;
			self.connected = true;
		});
		
		conn.on('error', function(err) { 
			if (logger.logLevel.info == true) { logger.log.info('Error in connecting to '+oSettings.host+' on port '+oSettings.port, {error: err}); }
			self.connected = false;
			self.error = true;
		});
		conn.on('close', function() { 
			if (logger.logLevel.info == true) { logger.log.info('connection to '+oSettings.host+' on port '+oSettings.port+' closed'); }
			self.connected = false;
			reconnect(); 
		});
		
		function reconnect() {
			if (retryCount >= maxRetries) { 
				if (logger.logLevel.info == true) { logger.log.info('Max retries to '+oSettings.host+' on port '+oSettings.port+' have been exceeded, giving up.'); }
				self.connected = false;
				conn.end();
			} else {
				retryCount += 1; 
				setTimeout(connect, retryInterval);
			}
			
		}
	};
	
	this.write = function(line, done) {
		conn.write(line);
		done();
	};
	
	this.close = function(done) {
		conn.end();
		done();
	};
}

function httpConn (options, done) {

/*	
	var conn_options = {
		sMethod:	'POST',
		oSettings:	{},
		sPayload:	'',
		dataType:	'json'
	};
*/	
	var conn_options = {
		hostname: 'localhost',
		port: 80,
		path: '/',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': postData.length
		}
	};
		
	//$.extend(true, conn_options, options);
	conn_options = merge(true, options);
	
	try {
	/*
		$.ajax({
		    type: 	conn_options.sMethod,
		    url: 	conn_options.oSettings.url,
		    data: 	conn_options.sPayload, 
		    success: function(data, status, xhr) { 
	
				var responseStatus = xhr.statusCode();
				if (logger.logLevel.debug == true) { logger.log.debug('xhr.statusCode: '+JSON.stringify(responseStatus.status,undefined,2)); }
				
				var responseHeader = xhr.getResponseHeader("Content-Type");		
				if (logger.logLevel.debug == true) { logger.log.debug('xhr.Content-Type: '+JSON.stringify(responseHeader,undefined,2)); }
		 
		    	done(false, responseStatus.status, data);
	
		    },
		    error: function(xhr, status, err) {
		    	if (logger.logLevel.warn == true) { logger.log.warn('Unable to post HTTP message to: '+conn_options.oSettings.url); }
	    	
		    	var responseStatus = xhr.statusCode();
	//			if (logger.logLevel.error == true) { logger.log.error('ERROR - xhr.statusCode: '+JSON.stringify(responseStatus.status,undefined,2)); }
				
				var responseHeader = xhr.getResponseHeader("Content-Type");		
	//			if (logger.logLevel.error == true) { logger.log.error('ERROR: xhr.Content-Type: '+JSON.stringify(responseHeader,undefined,2)); }
		    	done(true, responseStatus.status, err);
		    },
		    contentType: "application/json",
		    dataType: conn_options.dataType
		});
	*/
		

		var req = http.request(conn_options, function(res) {
			
			// res is instance of http.ClientRequest
			
			var data = '';
  			console.log('STATUS: ' + res.statusCode);
  			console.log('HEADERS: ' + JSON.stringify(res.headers,undefined,2));
  			console.log('METHOD: '+ JSON.stringify(res.method,undefined,2));
  			
  			res.setEncoding('utf8');
  			res.on('data', function (chunk) {
				console.log('BODY: ' + chunk);
				data += chunk;
  			});
  			
  			res.on('end', function() {
    			console.log('No more data in response.');
    			console.log('DATA: '+JSON.stringify(data,undefined,2));
  			});
		});

		req.on('error', function(e) {
  			console.log('problem with request: ' + e.message);
		});
		
		req.end();
		
	} catch(error) {
		console.log('BIG ASS HTTP ERROR: '+JSON.stringify(error,undefined,2));
	}


	
}

function redisConn (oSettings, ready_callback) {
	

	var oOptions = {
		server:		'localhost',
		port:		6379,
		db:			0
	};
	
	$.extend(true, oOptions, oSettings);
	
	var connect_options = {
		retry_max_delay:	10000
	};
	
	this.connected 	= false;
	this.error		= false;
	
	this.client = redis.createClient(oOptions.port, oOptions.server, connect_options);
	
	this.client.select(oOptions.db, function() {});
	
	
	this.client.on("error", function (err) {
		if (logger.logLevel.error == true) { logger.log.error('Redis Error on server: '+oSettings.server); }
		self.connected = false;
		self.error = true;
		console.log('Redis Error: '+err);
  	});
  	
	this.client.on('ready', function() {
		if (logger.logLevel.info == true) { logger.log.info('Connected to Redis server: '+oSettings.server); }
		self.connected = true;
		self.setOptions(function() {
			if ( ready_callback ) { ready_callback(); }
		});
	});
	
	this.client.on('drain', function() {
		if (logger.logLevel.info == true) { logger.log.info('Drain detected on Redis server: '+oSettings.server); }
	});
	
	this.client.on('end', function() {
		if (logger.logLevel.warn == true) { logger.log.warn('Connection to Redis server ended'); }
		self.connected = false;
	});
	
	this.setOptions = function(done) {
		if ( config.health.cluster.is_master ) {
			if (logger.logLevel.info == true) { logger.log.info('Checking and setting Redis DB options on server: '+oOptions.server); }
			
			if ( 'config' in oOptions ) {
				config_count = 0;
				oOptions.config.forEach( function(option) {
					send_set_command('CONFIG', ['SET', option.parameter, option.value], function(err, reply) {
						if (err) {
							if (logger.logLevel.error == true) { logger.log.error('Cannot set option', {error:err}); }
						}
						config_count += 1;	
						if ( config_count == oOptions.config.length ) {
							// Processed all config options
							send_set_command('CONFIG', ['SET', 'save', ''], function(err, reply) {
								if (done) { done(); }
							});
						}
					});
				});
			}
			
		} else {
			// I am not master, don't do anything.
			if (done) { done(); }
		}
	};
	
	function send_set_command(command, params, done) {
		self.client.send_command(command, params, function(err, reply) {
			if (logger.logLevel.info == true) { logger.log.info(oOptions.server+' SET '+command+' '+params+': '+reply); }
			done(err, reply);
		});	
	}
	
	var self = this;
}

function start_redis_clients(oSettings, callback) {
	if ( 'redis' in oSettings.client ) {
		if ( 'enabled' in oSettings.client.redis && oSettings.client.redis.enabled == true ) {
			var name_count = 1;
			for (var name in oSettings.client.redis) {
				
				config.app_data.redis_clients[name] = new redisConn(oSettings.client.redis[name], function() {
					if ( name_count == Object.keys(oSettings.client.redis).length ) {
						if (logger.logLevel.info == true) { logger.log.info('Finished connecting to all Redis servers.'); }
						if ( callback ) { callback(); }
					}
					name_count += 1;
				});
			}
		}
		
	}
}

function amqpConn(settings) {
	
	// Determine queue name
	var queue_name = '';
	
	if ( settings.consumer == true && 'queue' in settings ) {
		if ( 'name' in settings.queue ) { queue_name = settings.queue.name; } 
		else { queue_name = settings.exchange.name+'_'+config.my_hostname; }
	}
		
	var consumer = {
		ch:			{},
		queue:  	queue_name,
		timeout:	1000,
		backoff:	1
	};
	
	var publisher = {
		ch:			{},
		timeout:	1000,
		backoff:	1
	};
	
	this.connection = {};
	
	
	this.publish = function(message) {
		if ( 'publisher' in settings && 'routingKey' in settings.exchange ) {
			if ( settings.publisher == true ) {
				publisher.ch.publish(settings.exchange.name, settings.exchange.routingKey, new Buffer ( message ) );
				return;
			}
		}
	};
	
	// Methods
	this.connect = function(done) {
		amqp.connect('amqp://'+settings.amqpUser+':'+settings.amqpPassword+
			'@'+settings.amqpHost+':'+settings.amqpPort+'/'+settings.amqpvHost+'?heartbeat=20', function(err, conn) {
		
			if ( err != null ) { 
				if (logger.logLevel.error == true) { logger.log.error('ERROR: '+err); } 
				console.log('ERROR: '+err);
				process.exit(1); 
			}
			if (logger.logLevel.info == true) { logger.log.info('Connection to '+settings.amqpHost+' succeeded'); }
		  
			conn.on('error', function (err) {
			  	if (logger.logLevel.error == true) { logger.log.error('amqp connection had an error: ', { error : err }); }
			});
			conn.on('close', function (err) {
				if (logger.logLevel.warn == true) { logger.log.warn('amqp connection closed'); }
			});
			conn.on('end', function (err) {
			  	if (logger.logLevel.warn == true) { logger.log.warn('amqp connection ended'); }
			});
			
			self.connection = conn;
			done(false);
		});
	};
	
	this.consumerConn = function(done) {
	  if (logger.logLevel.info == true) { logger.log.info('Consumer Connection established'); }
	  var ok = self.connection.createChannel(on_open);
	  
	  function on_open(err, ch) {
	    if (err != null) { if (logger.logLevel.error == true) { logger.log.error('ERROR: creating channel'); process.exit(1); } }
	    else {
	    	
		    if (logger.logLevel.info == true) { logger.log.info('Created Consumer channel'); }
			consumer.ch = ch;
			
		    // Create the queue
		    consumer.ch.assertQueue(consumer.queue, {durable:settings.queue.durable, autoDelete:settings.queue.autoDelete }, function(err, ok) {
		    	if (err != null) { if (logger.logLevel.error == true) { logger.log.error('ERROR asserting queue'); process.exit(1); } }
		        else {
		
			        if (logger.logLevel.info == true) { logger.log.info('Created Consumer queue: '+consumer.queue); }
			        
			        // Create/connect to the exchange
			        consumer.ch.assertExchange(settings.exchange.name, settings.exchange.type, { durable:settings.exchange.durable, autoDelete:settings.exchange.autoDelete, confirm:settings.exchange.confirm }, function(err, ok) {
			        	if (err != null) { if (logger.logLevel.error == true) { logger.log.error('ERROR: '+err); } process.exit(1); } 
			      		if (logger.logLevel.info == true) { logger.log.info('Consumer - Created/Connected exchange: '+settings.exchange.name); }
			        
		      
		      
				        // Bind the queue to the exchange
				       	consumer.ch.bindQueue(consumer.queue, settings.exchange.name, '', {}, function(err, ok) {
				            if (err != null) { 
				            	if (logger.logLevel.error == true) { 
				            		logger.log.error('bindQueue ERROR: ');
				            		process.exit(1); 
				            	} 
				            }
				            else {
				
					            if (logger.logLevel.info == true) { logger.log.info(consumer.queue+' bound to exchange: '+settings.exchange.name); }
					            // Listen for messages and process
					            consumer.ch.consume(consumer.queue, function(msg) {
					                if (msg !== null) {
					             		if (logger.logLevel.info == true) { logger.log.info('Received message', { msg: msg }); }
					                	consumer.ch.ack(msg);
					                	
					                	// done(consumer.queue, msg);
					                	router.amqp_route(consumer.queue, msg);
					                  	
					                }		// if err on ch.consume
					            });			// ch.consume function call
					         }				// else, if err on ch.bindQueue
				    	});				// ch.bindQueue function all
				    	
				    });	
				    	
		        }	
	      	});				// ch.assertQueue function call
	    }					// else, if err on_open
	    
	    // Handle channel errors
	    consumer.ch.on('error', function(err) {
	    	if (logger.logLevel.error == true) { logger.log.error('Consumer channel had an error'); }
	    });
	    consumer.ch.on('close', function(err) {
	    	if (logger.logLevel.warn == true) { logger.log.warn('Consumer channel closed'); }
	    	
	    	setTimeout( function() {
	    		self.consumerConn(done);
				consumer.backoff += 1;
	    	}, consumer.timeout*consumer.backoff);
	    	
	    });
	    consumer.ch.on('end', function(err) {
	    	if (logger.logLevel.warn == true) { logger.log.warn('Consumer channel ended'); }
	    });
	    
	    
	  }						// on_open function
	};
	
	this.publisherConn = function(done) {
		  if (logger.logLevel.info == true) { logger.log.info('Publisher Connection established'); }
		  var ok = self.connection.createChannel(on_open);
		  
		  // Channel created
		  function on_open(err, ch) {
		    if (err != null) { if (logger.logLevel.error == true) { logger.log.error('ERROR: '+err); } process.exit(1); }
		    else {
		      if (logger.logLevel.info == true) { logger.log.info('Created Publisher channel'); }
			  publisher.ch = ch;
			  
		      // Create/connect to the exchange
		      publisher.ch.assertExchange(settings.exchange.name, settings.exchange.type, { durable:settings.exchange.durable, autoDelete:settings.exchange.autoDelete, confirm:settings.exchange.confirm }, function(err, ok) {
		        if (err != null) { if (logger.logLevel.error == true) { logger.log.error('ERROR: '+err); } process.exit(1); } 
		      	if (logger.logLevel.info == true) { logger.log.info('Publisher - Created/Connected exchange: '+settings.exchange.name); }
		      	if (done) { done(); }
		      });
		    }
		    
		    // Handle channel errors
		    publisher.ch.on('error', function(err) {
		    	if (logger.logLevel.error == true) { logger.log.error('Publisher channel had an error: ', { error : err } ); }
		    });
		    publisher.ch.on('close', function(err) {
		    	if (logger.logLevel.warn == true) { logger.log.warn('Publisher channel closed'); }
		    	setTimeout( function() {
		    		if (done) { self.publisherConn(done); }
		    		else { self.publisherConn(); }	
					publisher.backoff += 1;
		    	}, publisher.timeout*self.publisher.backoff);
		    	
		    });
		    publisher.ch.on('end', function(err) {
		    	if (logger.logLevel.warn == true) { logger.log.warn('Publisher channel ended'); }
		    });
		  }
	};

	var self = this;
}

function start_amqp_clients(oSettings, consumer_action, done) {
	
	var name_count = 0;
	if ( 'amqp' in oSettings.client ) {
		if ( 'enabled' in oSettings.client.amqp && oSettings.client.amqp.enabled == true ) {
			for (var name in oSettings.client.amqp) {
				amqp_setup(name);
			}
		}
	}
	
	function amqp_setup(name) {
		config.app_data.amqp_clients[name] = new amqpConn(oSettings.client.amqp[name]);
		config.app_data.amqp_clients[name].connect( function(err) {
			if (err) {
				if (logger.logLevel.info == true) { logger.log.info(name+" - Connection failed"); }
			} else {
				if (logger.logLevel.info == true) { logger.log.info(name+" - Connection established"); }
				
				if ( oSettings.client.amqp[name].publisher) {
					// Be a publisher
					config.app_data.amqp_clients[name].publisherConn(function() {
						if (logger.logLevel.info == true) { logger.log.info(name+" is a publisher"); }
					});
				}
					
				if ( oSettings.client.amqp[name].consumer) {
					// Be a consumer
					config.app_data.amqp_clients[name].consumerConn(function(message) {
						if (consumer_action) { consumer_action(message); }
					});
				}
				
				name_count += 1;
				
				if ( name_count == Object.keys(oSettings.client.amqp).length ) {
					if (logger.logLevel.info == true) { logger.log.info('Finished connecting all AMQP clients.'); }
					if ( done ) { done(); }
				}
					
			}
			
		});
	}
}

exports.tcpConn = tcpConn;
exports.httpConn = httpConn;
exports.statsd = statsd;
exports.elasticsearch = elasticsearch;
exports.ircBot = ircBot;
exports.redisConn = redisConn;
exports.start_redis_clients = start_redis_clients;
exports.start_amqp_clients = start_amqp_clients;