# app_template - WORK IN PROGRESS

A node.js application template for quick deployment or prototyping.

The template provides functionality and connectivity for some popular messaging, data storage and communications platforms.
It was written as an exercise in learning node.js, version control and testing out ideas in the course of my working life.

It will be quite obvious from a cursory glance at the code that I am in no way a developer of any significance, however I've found it a fun way to while away some free time. 

# Table of Contents

* [Summary](#summary)
* [Usage](#usage)
   * [Servers](#servers)
      * [TCP Server](#tcp-server)
      * [HTTP Server](#http-server)
      * [SMTP](#smtp)
   * [clients](#clients)
      * [StatsD](#statsd)
      * [Elasticserach](#elasticsearch-client)
      * [IRC Bot](#ircbot)
      * [TCP Client](#tcp-client)
      * [HTTP Client](#http-client)
      * [Redis Client](#redis-client)
      * [AMQP Client](#amqp-client)
* [Required Modules](#required_modules)

# Summary

# Usage
## Servers
### TCP Server

#### Config
```
{
    "server": {
		"tcp": {
			"port": [ 2003 ]
		}
	}
}
```
The key *port* is an array of port numbers your app should listen on.

#### Example code, app.js function start:
```
server.start_tcp_servers(oSettings);
```
Once a TCP server is listening, after calling *start_tcp_servers*, all connection requests are handled by *router.tcp_route*.  This
function decides how to handle the TCP connection data and will call the appropriate function from *handlers.js* 

#### Example code, router.js:
Calls handler function based on request path:
```
var handle_tcp = {
	2023:	handlers.fnPort_2023
};
```
In the example above, data received on TCP port 2023 is routed to handler function handlers.fnPort_2023 for processing.

### HTTP Server

#### Config
```
{
    "server": {
		"http": {
			"port": [ 2003 ]
		}
	}
}
```

The key *port* is an array of port numbers your app should listen on.

#### Example code, app.js function start:
```
server.start_http_servers(oSettings);
```

Once an HTTP server is listening, after calling *start_http_servers*, all connection requests are handled by *router.http_route*.  This
function decides how to handle the HTTP request and will call the appropriate function from *handlers.js*

#### Example code, router.js:
Calls handler function based on request path:
```
var handle = {
	"/" : 				handlers.start,
  	"/health":  		handlers.appHealth,
  	"/list":			handlers.list,
  	"/add": 	        handlers.add,
  	"/delete":          handlers.delete
};
```

### SMTP

## Clients
### StatsD

### Elasticsearch

### IRC Bot

### TCP Client

### HTTP Client

### Redis Client

Uses the NPM module [node_redis](https://github.com/NodeRedis/node_redis) version 0.12.1

#### Config
```
{
    "client": {
        "redis": {
		  "redis01": {
				"server":	"redis.example.com",
				"port":		6379,
				"db":		3,
				"config": [
					{
						"parameter":	"zset-max-ziplist-entries",
						"value":		3000
					},
					{
						"parameter":	"zset-max-ziplist-value",
						"value":		256
					}
				]
					
			}
			
		}
	}
}
```

Example code, app.js:
```
client.start_redis_clients(oSettings, function() {
	console.log('Redis connections started');
});
```
__ToDo: add publish/subscribe methods__

### AMQP Client

Uses the NPM module [amqplib](http://squaremo.github.io/amqp.node/) version 0.2.0 

#### Publisher

#### Config
```
{
	"client": {
		"publisher": {
			"amqpHost":   	"rabbitmq.example.com",
	        "amqpUser":     "shandy",
	        "amqpPassword": "secret",
	        "amqpPort" :    5672,
	        "amqpvHost" :   "app1",
	        "exchange":     {
	            "name":         "app_ex",
	            "type":         "direct",
	            "routingKey":   "test",
	            "durable":      false,
	            "autoDelete":   false,
	            "confirm":      true
	        },
	        "publisher":    true,
	        "consumer":     false
		}
	}
}
```
The configuration above specifies a connection named *publisher*, which connects to the RabbitMQ server *rabbitmq.example.com* 
on the port *5672* using credentials username *shandy* and password *secret*.  

The Vhost *app1* should already exist.

The exchange *app_ex* will be created if it doesn't already exist.  The exchange configuration specified should match an already 
existing exchange, otherwise the app will bail.  Messages published using this connection will use the routing key *test*.

#### Consumer

Config
======
```
{
    "client": {
    	"consumer": {
    		"amqpHost":   	"rabbitmq.example.com",
            "amqpUser":     "shandy",
            "amqpPassword": "secret",
            "amqpPort" :    5672,
            "amqpvHost" :   "app1",
            "exchange":     {
                "name":         "app_ex",
                "type":         "direct",
                "durable":      false,
                "autoDelete":   false,
                "confirm":      true
            },
            "queue":    {
                "name":         "consumer_test",
                "routingKey":   "test",
                "durable":      false,
                "autoDelete":   true
            },
            "publisher":    false,
            "consumer":     true
    	}
    }
}
```
The configuration above specifies a connection named *consumer*, which connects to the RabbitMQ server *rabbitmq.example.com* 
on the port *5672* using credentials username *shandy* and password *secret*.

The Vhost *app1* should already exist.

The exchange *app_ex* will be created if it doesn't already exist.  The exchange configuration specified should match an already 
existing exchange, if not the app will bail. 

A queue named *consumer_test* will be created if one doesn't already exist and bound to the exchange *app_ex*, listening for 
messages with the routing key *test*.  Should the queue already exist then the consumer will join other conusmers listening, 
receiving messages when RabbitMQ routes them.



Example code, app.js function start:
```
client.start_amqp_clients(oSettings.client.amqp, parseMessage, function() {
	// Start services, call functions reliant on AMQP client connections
	console.log("completed function start_amqp_clients");
});

function parseMessage(queue, message) {
	console.log('Consumer queue: '+queue+'received message: '+message.content.toString());
}

```
When calling start_amqp_clients, the second parameter *parseMessage* is a function that should accept a queue name and the received message.  
In this example they are just printed to stdout.

__N.B. you could enable both publisher and consumer, but then you'd just consume any messages you published.  Not sure thats 
useful.__


# Required Modules